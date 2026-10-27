"""Estado del servicio: catálogo y configuración en caché, motor vigente, reentrenamiento y evaluación."""

import logging
import threading
import time
from typing import Any

import pandas as pd

from .almacen import Almacen
from .conocimiento import Conocimiento
from .datos import Repositorio
from .entrenamiento import entrenar_todo
from .evaluacion import evaluar_offline
from .motor import Motor, Recomendacion

log = logging.getLogger("recommender")


class Ocupado(Exception):
    """Ya hay un reentrenamiento o evaluación en curso."""


class Servicio:
    def __init__(self, repo: Repositorio, almacen: Almacen, semilla: int = 42, ttl_s: float = 30.0):
        self.repo = repo
        self.almacen = almacen
        self.semilla = semilla
        self.ttl_s = ttl_s
        self.motor: Motor | None = None
        self._catalogo: pd.DataFrame | None = None
        self._config: dict[str, Any] | None = None
        self._leido = 0.0
        self._lock_init = threading.Lock()
        self._lock_trabajo = threading.Lock()

    # ------------------------------------------------------------------ estado

    def iniciar(self) -> None:
        """Construye el motor con las boletas, las reglas vigentes y el último modelo guardado."""
        catalogo = self.repo.catalogo()
        conocimiento = Conocimiento.construir(catalogo, self.repo.boletas(), self.repo.reglas_vigentes())
        motor = Motor(conocimiento)
        vigente = self.repo.modelo_vigente()
        if vigente and vigente.get("artefacto"):
            try:
                artefacto = self.almacen.cargar(vigente["artefacto"])
                motor.modelos = artefacto["modelos"]
                motor.version_modelo = artefacto["version"]
            except Exception:  # sin modelo, el modo ML recurre a las reglas hasta el próximo reentrenamiento
                log.exception("No se pudo cargar el modelo %s", vigente.get("version"))
        self.motor = motor
        self._refrescar(forzar=True)
        log.info(
            "Motor listo: %d productos, %d reglas, modelo=%s",
            len(conocimiento.skus),
            len(conocimiento.reglas),
            motor.version_modelo,
        )

    def asegurar(self) -> Motor:
        if self.motor is None:
            with self._lock_init:
                if self.motor is None:
                    self.iniciar()
        assert self.motor is not None
        return self.motor

    def _refrescar(self, forzar: bool = False) -> None:
        if forzar or time.monotonic() - self._leido > self.ttl_s:
            self._catalogo = self.repo.catalogo().set_index("sku", drop=False)
            self._config = self.repo.configuracion()
            self._leido = time.monotonic()

    def config(self) -> dict[str, Any]:
        self._refrescar()
        assert self._config is not None
        return self._config

    def catalogo(self) -> pd.DataFrame:
        self._refrescar()
        assert self._catalogo is not None
        return self._catalogo

    def recargar(self) -> None:
        """Relee catálogo, configuración y reglas vigentes (lo llama el backend tras cambiar la configuración)."""
        motor = self.asegurar()
        motor.conocimiento.cambiar_reglas(self.repo.reglas_vigentes())
        self._refrescar(forzar=True)

    # ------------------------------------------------------------------ consultas

    def _productos(self, recs: list[Recomendacion]) -> list[dict[str, Any]]:
        cat = self.catalogo()
        salida = []
        for r in recs:
            if r.sku not in cat.index:
                continue
            p = cat.loc[r.sku]
            salida.append(
                {
                    "sku": r.sku,
                    "nombre": p["nombre"],
                    "marca": p["marca"],
                    "categoria": p["categoria"],
                    "subcategoria": p["subcategoria"],
                    "unidad": p["unidad"],
                    "uso": p["uso"],
                    "precio": float(p["precio"]),
                    "stock": int(p["stock"]),
                    "puntaje": r.puntaje,
                    "terminos": r.terminos,
                    "fuente": r.fuente,
                    "posicion": len(salida) + 1,
                }
            )
        return salida

    def recomendar(self, skus: list[str], k: int, modo: str | None, codigo_cliente: str | None) -> list[dict[str, Any]]:
        motor = self.asegurar()
        config = self.config()
        cat = self.catalogo()
        no_disponibles = set(cat.index[(~cat["activo"].astype(bool)) | (cat["stock"] <= 0)])
        historial = motor.conocimiento.historial.get(codigo_cliente, []) if codigo_cliente else None
        recs = motor.recomendar(skus, k, modo or config["modo_activo"], config, historial, no_disponibles)
        return self._productos(recs)

    def buscar(self, texto: str, k: int) -> list[dict[str, Any]]:
        motor = self.asegurar()
        cat = self.catalogo()
        inactivos = set(cat.index[~cat["activo"].astype(bool)])
        recs = [r for r in motor.buscar(texto, k + len(inactivos)) if r.sku not in inactivos][:k]
        return self._productos(recs)

    # ------------------------------------------------------------------ trabajos pesados

    def reentrenar(self) -> dict[str, Any]:
        if not self._lock_trabajo.acquire(blocking=False):
            raise Ocupado()
        try:
            config = self.repo.configuracion()
            boletas = self.repo.boletas()
            e = entrenar_todo(self.repo.catalogo(), boletas, config, self.semilla)
            referencia = self.almacen.guardar(
                f"reordenador-{e.meta['version']}.joblib",
                {"version": e.meta["version"], "modelos": e.motor.modelos, "meta": e.meta},
            )
            self.repo.guardar_reglas(e.reglas, e.meta["version"])
            self.repo.guardar_modelo(e.meta["version"], "lightgbm", e.meta, referencia)
            self.repo.actualizar_reordenador(e.meta)
            self.motor = e.motor
            self._refrescar(forzar=True)
            ap = e.meta["ap_validacion"]
            return {
                "status": "ok",
                "message": (
                    f"Modelo {e.meta['version']} entrenado con {e.meta['n_boletas']} comprobantes: {len(e.reglas)} reglas; "
                    f"AP de validación LightGBM {ap['lightgbm']:.4f} vs regresión logística {ap['regresion_logistica']:.4f}."
                ),
                "comprobantes": e.meta["n_boletas"],
                "reglas": len(e.reglas),
                "artefacto": referencia,
                "reordenador": e.meta,
            }
        finally:
            self._lock_trabajo.release()

    def evaluar(self) -> dict[str, Any]:
        if not self._lock_trabajo.acquire(blocking=False):
            raise Ocupado()
        try:
            resultado = evaluar_offline(
                self.repo.catalogo(),
                self.repo.boletas(),
                self.repo.configuracion(),
                self.semilla,
                dir_salida=self.almacen.directorio,
            )
            self.repo.guardar_evaluacion(resultado)
            return resultado
        finally:
            self._lock_trabajo.release()
