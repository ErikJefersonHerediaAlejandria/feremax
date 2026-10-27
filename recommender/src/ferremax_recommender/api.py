"""API interna del recomendador. Solo la consume el backend NestJS, con la cabecera X-Internal-Key."""

import logging
import secrets
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import __version__
from .almacen import Almacen
from .config import Ajustes, ajustes
from .datos import RepositorioPostgres
from .servicio import Ocupado, Servicio

log = logging.getLogger("recommender")


class RecomendarRequest(BaseModel):
    skus: list[str] = Field(default_factory=list, max_length=200)
    codigo_cliente: str | None = None
    k: int = Field(5, ge=1, le=50)
    modo: Literal["CONV", "ML"] | None = None


class BuscarRequest(BaseModel):
    texto: str = Field(min_length=1, max_length=300)
    k: int = Field(12, ge=1, le=52)


class ProductoPuntuado(BaseModel):
    sku: str
    nombre: str
    marca: str | None = None
    categoria: str | None = None
    subcategoria: str | None = None
    unidad: str | None = None
    uso: str | None = None
    precio: float
    stock: int
    puntaje: float | None = None
    terminos: list[str] = []
    fuente: str | None = None
    posicion: int


def crear_app(servicio: Servicio, clave: str) -> FastAPI:
    @asynccontextmanager
    async def ciclo(_: FastAPI):
        try:
            servicio.iniciar()
        except Exception:  # la base puede no estar lista aún: se reintenta en la primera petición
            log.exception("Inicio diferido del motor")
        yield

    app = FastAPI(
        title="FerreMax · Recommender", version=__version__, lifespan=ciclo, docs_url=None, redoc_url=None, openapi_url=None
    )

    def autorizar(x_internal_key: Annotated[str | None, Header()] = None) -> None:
        if not x_internal_key or not secrets.compare_digest(x_internal_key, clave):
            raise HTTPException(status_code=401, detail="Clave interna inválida")

    protegido = [Depends(autorizar)]

    @app.get("/health")
    def health():
        try:
            motor = servicio.asegurar()
        except Exception:
            raise HTTPException(status_code=503, detail="Motor no disponible") from None
        return {"status": "ok", "version": __version__, "modelo": motor.version_modelo, "reglas": len(motor.conocimiento.reglas)}

    @app.post("/recomendar", response_model=list[ProductoPuntuado], dependencies=protegido)
    def recomendar(req: RecomendarRequest):
        return servicio.recomendar(req.skus, req.k, req.modo, req.codigo_cliente)

    @app.post("/buscar-necesidad", response_model=list[ProductoPuntuado], dependencies=protegido)
    def buscar(req: BuscarRequest):
        return servicio.buscar(req.texto, req.k)

    @app.post("/reentrenar", dependencies=protegido)
    def reentrenar():
        try:
            return servicio.reentrenar()
        except Ocupado:
            raise HTTPException(status_code=409, detail="Ya hay un reentrenamiento o evaluación en curso") from None

    @app.post("/evaluacion-offline", dependencies=protegido)
    def evaluacion():
        try:
            return servicio.evaluar()
        except Ocupado:
            raise HTTPException(status_code=409, detail="Ya hay un reentrenamiento o evaluación en curso") from None

    @app.post("/recargar", dependencies=protegido)
    def recargar():
        servicio.recargar()
        return {"status": "ok"}

    return app


def _app_por_defecto(a: Ajustes) -> FastAPI:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    servicio = Servicio(
        RepositorioPostgres(a.database_url),
        Almacen(a.dir_artefactos, a.supabase_url, a.supabase_secret_key, a.bucket_modelos),
        semilla=a.semilla,
        ttl_s=a.ttl_catalogo_s,
    )
    return crear_app(servicio, a.recommender_key)


app = _app_por_defecto(ajustes())
