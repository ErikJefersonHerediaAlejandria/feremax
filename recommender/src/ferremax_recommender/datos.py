"""Acceso a datos. `RepositorioPostgres` para el servicio; `RepositorioMemoria` para tests y uso offline."""

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import pandas as pd

from .reglas import Regla

COLUMNAS_CATALOGO = ["sku", "nombre", "marca", "categoria", "subcategoria", "unidad", "uso", "precio", "stock", "activo"]

CONFIG_POR_DEFECTO: dict[str, Any] = {
    "modo_activo": "ML",
    "k": 5,
    "soporte_min": 0.01,
    "confianza_min": 0.15,
    "lift_min": 1.2,
    "peso_contenido": 1.0,
    "variante_ml": "COMPLETO",
    "fuente_datos": "sintetico",
    "reordenador": None,
}


class Repositorio(Protocol):
    def catalogo(self) -> pd.DataFrame: ...
    def boletas(self) -> pd.DataFrame: ...
    def configuracion(self) -> dict[str, Any]: ...
    def reglas_vigentes(self) -> list[Regla]: ...
    def guardar_reglas(self, reglas: list[Regla], version: str) -> None: ...
    def guardar_modelo(self, version: str, tipo: str, metricas: dict, artefacto: str | None) -> None: ...
    def modelo_vigente(self) -> dict[str, Any] | None: ...
    def actualizar_reordenador(self, meta: dict) -> None: ...
    def guardar_evaluacion(self, resultado: dict) -> None: ...


def a_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, default=str)


# --------------------------------------------------------------------------------------------- Postgres


def limpiar_url(url: str) -> str:
    """Quita los parámetros propios de Prisma (`schema`, `pgbouncer`), que libpq no acepta."""
    partes = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(partes.query) if k not in {"schema", "pgbouncer", "connection_limit"}]
    return urlunsplit(partes._replace(query=urlencode(query)))


class RepositorioPostgres:
    def __init__(self, url: str):
        self.url = limpiar_url(url)

    def _conectar(self):
        import psycopg

        # prepare_threshold=None: compatible con el pooler en modo transacción de Supabase.
        return psycopg.connect(self.url, prepare_threshold=None, options="-c timezone=UTC", connect_timeout=15)

    def _df(self, sql: str) -> pd.DataFrame:
        with self._conectar() as con, con.cursor() as cur:
            cur.execute(sql)
            cols = [c.name for c in cur.description]
            return pd.DataFrame(cur.fetchall(), columns=cols)

    def catalogo(self) -> pd.DataFrame:
        df = self._df(f"select {', '.join(COLUMNAS_CATALOGO)} from productos order by sku")
        df["precio"] = df["precio"].astype(float)
        return df

    def boletas(self) -> pd.DataFrame:
        return self._df(
            "select b.id_boleta, b.fecha, b.cliente_codigo, i.sku from boletas b "
            "join boleta_items i on i.id_boleta = b.id_boleta order by b.fecha, b.id_boleta, i.sku"
        )

    def configuracion(self) -> dict[str, Any]:
        df = self._df("select * from configuracion where id = 1")
        return {**CONFIG_POR_DEFECTO, **df.iloc[0].to_dict()} if len(df) else dict(CONFIG_POR_DEFECTO)

    def reglas_vigentes(self) -> list[Regla]:
        df = self._df("select antecedente, consecuente, soporte, confianza, lift from reglas_asociacion where vigente")
        return [Regla(tuple(f.antecedente), tuple(f.consecuente), f.soporte, f.confianza, f.lift) for f in df.itertuples()]

    def guardar_reglas(self, reglas: list[Regla], version: str) -> None:
        with self._conectar() as con, con.cursor() as cur:
            cur.execute("update reglas_asociacion set vigente = false where vigente")
            cur.executemany(
                "insert into reglas_asociacion (antecedente, consecuente, soporte, confianza, lift, vigente, version_modelo)"
                " values (%s, %s, %s, %s, %s, true, %s)",
                [(list(r.antecedente), list(r.consecuente), r.soporte, r.confianza, r.lift, version) for r in reglas],
            )

    def guardar_modelo(self, version: str, tipo: str, metricas: dict, artefacto: str | None) -> None:
        with self._conectar() as con, con.cursor() as cur:
            cur.execute("update modelos set vigente = false where vigente")
            cur.execute(
                "insert into modelos (version, tipo, fecha, metricas, artefacto, vigente) values (%s, %s, now(), %s, %s, true)",
                (version, tipo, a_json(metricas), artefacto),
            )

    def modelo_vigente(self) -> dict[str, Any] | None:
        df = self._df("select version, tipo, artefacto from modelos where vigente order by fecha desc limit 1")
        return df.iloc[0].to_dict() if len(df) else None

    def actualizar_reordenador(self, meta: dict) -> None:
        with self._conectar() as con, con.cursor() as cur:
            cur.execute("update configuracion set reordenador = %s, actualizada_en = now() where id = 1", (a_json(meta),))

    def guardar_evaluacion(self, resultado: dict) -> None:
        with self._conectar() as con, con.cursor() as cur:
            cur.execute("insert into evaluaciones_offline (fecha, resultado) values (now(), %s)", (a_json(resultado),))


# --------------------------------------------------------------------------------------------- Memoria


@dataclass
class RepositorioMemoria:
    """Repositorio en memoria a partir de los archivos de `data/` (o de DataFrames dados)."""

    catalogo_df: pd.DataFrame
    boletas_df: pd.DataFrame
    config: dict[str, Any] = field(default_factory=lambda: dict(CONFIG_POR_DEFECTO))
    reglas: list[Regla] = field(default_factory=list)
    modelos: list[dict[str, Any]] = field(default_factory=list)
    evaluaciones: list[dict] = field(default_factory=list)

    @classmethod
    def desde_archivos(cls, dir_data: Path) -> "RepositorioMemoria":
        productos = pd.DataFrame(json.loads((dir_data / "seed/productos.json").read_text(encoding="utf-8")))
        productos["activo"] = True
        boletas = pd.read_csv(dir_data / "sintetico/boletas.csv", parse_dates=["fecha"])
        items = pd.read_csv(dir_data / "sintetico/boleta_items.csv")
        df = boletas.merge(items[["id_boleta", "sku"]], on="id_boleta").sort_values(["fecha", "id_boleta", "sku"])
        return cls(productos[COLUMNAS_CATALOGO].copy(), df.reset_index(drop=True))

    def catalogo(self) -> pd.DataFrame:
        return self.catalogo_df.copy()

    def boletas(self) -> pd.DataFrame:
        return self.boletas_df

    def configuracion(self) -> dict[str, Any]:
        return dict(self.config)

    def reglas_vigentes(self) -> list[Regla]:
        return list(self.reglas)

    def guardar_reglas(self, reglas: list[Regla], version: str) -> None:
        self.reglas = list(reglas)

    def guardar_modelo(self, version: str, tipo: str, metricas: dict, artefacto: str | None) -> None:
        for m in self.modelos:
            m["vigente"] = False
        self.modelos.append({"version": version, "tipo": tipo, "metricas": metricas, "artefacto": artefacto, "vigente": True})

    def modelo_vigente(self) -> dict[str, Any] | None:
        return next((m for m in reversed(self.modelos) if m["vigente"]), None)

    def actualizar_reordenador(self, meta: dict) -> None:
        self.config["reordenador"] = meta

    def guardar_evaluacion(self, resultado: dict) -> None:
        self.evaluaciones.append({"fecha": datetime.now(UTC), "resultado": resultado})
