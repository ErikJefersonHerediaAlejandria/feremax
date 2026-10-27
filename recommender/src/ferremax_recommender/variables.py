"""Generación de candidatos y variables del reordenador (mismas 16 variables que v1)."""

from dataclasses import dataclass

import numpy as np

from .conocimiento import Conocimiento

VARIABLES = [
    "conf_max",
    "lift_max",
    "soporte_max",
    "n_reglas_activas",
    "cf_score",
    "cf_sim_max",
    "popularidad_norm",
    "fraccion_misma_categoria",
    "fraccion_misma_subcategoria",
    "log_ratio_precio",
    "similitud_contenido",
    "tam_B",
    "viene_de_reglas",
    "viene_de_cf",
    "viene_de_popularidad",
    "viene_de_contenido",
]
_I = {v: i for i, v in enumerate(VARIABLES)}

# Variables de contenido: el peso de contenido las escala (1 = neutro).
VARIABLES_CONTENIDO = ["similitud_contenido", "fraccion_misma_categoria", "fraccion_misma_subcategoria"]

# Variante REGLAS: el reordenador solo ve reglas, popularidad y tamaño del contexto.
VARIABLES_POR_VARIANTE = {
    "COMPLETO": VARIABLES,
    "REGLAS": [
        "conf_max",
        "lift_max",
        "soporte_max",
        "n_reglas_activas",
        "popularidad_norm",
        "tam_B",
        "viene_de_reglas",
        "viene_de_popularidad",
    ],
}
FUENTES_POR_VARIANTE = {
    "COMPLETO": ("reglas", "cf", "popularidad", "contenido"),
    "REGLAS": ("reglas", "popularidad"),
}
N_POR_FUENTE = 10


def variante_valida(variante: str | None) -> str:
    return variante if variante in VARIABLES_POR_VARIANTE else "COMPLETO"


@dataclass
class Candidatos:
    indices: np.ndarray  # índices de producto candidatos (ordenados)
    X: np.ndarray  # (n_candidatos, len(VARIABLES))


def construir(
    k: Conocimiento,
    contexto: list[int],
    variante: str = "COMPLETO",
    peso_contenido: float = 1.0,
    excluir: set[int] | None = None,
) -> Candidatos:
    """Candidatos (reglas + CF + popularidad + contenido, según la variante) y su matriz de variables."""
    variante = variante_valida(variante)
    fuentes = FUENTES_POR_VARIANTE[variante]
    ctx = sorted(set(contexto))
    ctx_set = set(ctx)
    prohibidos = ctx_set | (excluir or set())
    n = len(k.skus)

    conf = np.zeros(n)
    lift = np.zeros(n)
    sop = np.zeros(n)
    n_reglas = np.zeros(n)
    for c, r in k.reglas_activas(ctx_set):
        conf[c] = max(conf[c], r.confianza)
        lift[c] = max(lift[c], r.lift)
        sop[c] = max(sop[c], r.soporte)
        n_reglas[c] += 1

    cf_score = k.sim_cf[:, ctx].mean(axis=1) if ctx else np.zeros(n)
    cf_max = k.sim_cf[:, ctx].max(axis=1) if ctx else np.zeros(n)
    sim_cont = k.sim_contenido[:, ctx].mean(axis=1) if ctx else np.zeros(n)

    disponibles = np.array([i not in prohibidos for i in range(n)])
    origen = {f: np.zeros(n, dtype=bool) for f in ("reglas", "cf", "popularidad", "contenido")}
    if "reglas" in fuentes:
        origen["reglas"] = (n_reglas > 0) & disponibles

    def top(puntaje: np.ndarray) -> np.ndarray:
        marca = np.zeros(n, dtype=bool)
        orden = sorted((i for i in range(n) if disponibles[i] and puntaje[i] > 0), key=lambda i: (-puntaje[i], i))
        marca[orden[:N_POR_FUENTE]] = True
        return marca

    if "cf" in fuentes:
        origen["cf"] = top(cf_score)
    if "popularidad" in fuentes:
        origen["popularidad"] = top(k.popularidad)
    if "contenido" in fuentes:
        origen["contenido"] = top(sim_cont)

    elegidos = np.zeros(n, dtype=bool)
    for f in fuentes:
        elegidos |= origen[f]
    cand = np.flatnonzero(elegidos)

    X = np.zeros((len(cand), len(VARIABLES)))
    if len(cand) and ctx:
        X[:, _I["conf_max"]] = conf[cand]
        X[:, _I["lift_max"]] = lift[cand]
        X[:, _I["soporte_max"]] = sop[cand]
        X[:, _I["n_reglas_activas"]] = n_reglas[cand]
        X[:, _I["cf_score"]] = cf_score[cand]
        X[:, _I["cf_sim_max"]] = cf_max[cand]
        X[:, _I["popularidad_norm"]] = k.popularidad[cand]
        X[:, _I["fraccion_misma_categoria"]] = (k.categoria[cand][:, None] == k.categoria[ctx][None, :]).mean(axis=1)
        X[:, _I["fraccion_misma_subcategoria"]] = (k.subcategoria[cand][:, None] == k.subcategoria[ctx][None, :]).mean(axis=1)
        X[:, _I["log_ratio_precio"]] = np.log(np.maximum(k.precio[cand], 0.01) / max(k.precio[ctx].mean(), 0.01))
        X[:, _I["similitud_contenido"]] = sim_cont[cand]
        X[:, _I["tam_B"]] = len(ctx)
        for f in ("reglas", "cf", "popularidad", "contenido"):
            X[:, _I[f"viene_de_{f}"]] = origen[f][cand]
        for v in VARIABLES_CONTENIDO:
            X[:, _I[v]] *= peso_contenido
        # Las variables que la variante no usa quedan en 0 (el modelo de esa variante nunca las vio).
        for v in VARIABLES:
            if v not in VARIABLES_POR_VARIANTE[variante]:
                X[:, _I[v]] = 0.0
    return Candidatos(cand, X)


def columna(nombre: str) -> int:
    return _I[nombre]
