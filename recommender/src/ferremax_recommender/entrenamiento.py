"""Reentrenamiento: minería de reglas + reordenador validado con partición temporal (último 10 %)."""

from dataclasses import dataclass
from datetime import UTC, datetime

import pandas as pd

from . import reordenador as R
from . import variables as V
from .conocimiento import Conocimiento
from .motor import Motor
from .reglas import Regla, minar_reglas

VARIANTES = ("COMPLETO", "REGLAS")


def transacciones(boletas: pd.DataFrame) -> list[list[str]]:
    return [sorted(set(g)) for _, g in boletas.groupby("id_boleta", sort=True)["sku"]]


def minar(boletas: pd.DataFrame, config: dict) -> list[Regla]:
    return minar_reglas(
        transacciones(boletas), float(config["soporte_min"]), float(config["confianza_min"]), float(config["lift_min"])
    )


@dataclass
class Entrenado:
    motor: Motor
    reglas: list[Regla]
    meta: dict


def entrenar_todo(
    catalogo: pd.DataFrame, boletas: pd.DataFrame, config: dict, semilla: int, version: str | None = None
) -> Entrenado:
    """1) Valida el reordenador: reglas/CF/popularidad aprendidas del 90 % más antiguo, AP medida en el 10 % final.
    2) Reaprende reglas, CF y popularidad con todas las boletas para servir recomendaciones."""
    version = version or datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    entrenamiento, validacion = R.particion_temporal(boletas, 0.10)
    k_tr = Conocimiento.construir(catalogo, entrenamiento, minar(entrenamiento, config))
    resultados = {v: R.entrenar(k_tr, entrenamiento, validacion, v, semilla) for v in VARIANTES}

    reglas = minar(boletas, config)
    k_final = Conocimiento.construir(catalogo, boletas, reglas)
    motor = Motor(k_final, {v: r.lightgbm for v, r in resultados.items()}, version)

    def ficha(r: R.ResultadoEntrenamiento) -> dict:
        return {
            "n_ejemplos": r.n_ejemplos,
            "n_positivos": r.n_positivos,
            "n_contextos": r.n_contextos,
            "cobertura_candidatos": r.cobertura,
            "ap_validacion": {"regresion_logistica": r.ap_logistica, "lightgbm": r.ap_lightgbm},
            "importancias": r.importancias,
        }

    principal = resultados["COMPLETO"]
    fechas = pd.to_datetime(boletas["fecha"], utc=True)
    meta = {
        "tipo": "lightgbm",
        "version": version,
        "fecha": datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S"),
        "n_boletas": int(boletas["id_boleta"].nunique()),
        **{k: v for k, v in ficha(principal).items() if k != "importancias"},
        "validacion": "temporal: último 10 % de las boletas de entrenamiento",
        "variables": V.VARIABLES,
        "semilla": semilla,
        "n_reglas": len(reglas),
        "periodo": [fechas.min().strftime("%Y-%m-%d"), fechas.max().strftime("%Y-%m-%d")],
        "fuente_datos": config.get("fuente_datos"),
        "por_variante": {v: {"variables": V.VARIABLES_POR_VARIANTE[v], **ficha(r)} for v, r in resultados.items()},
    }
    return Entrenado(motor, reglas, meta)
