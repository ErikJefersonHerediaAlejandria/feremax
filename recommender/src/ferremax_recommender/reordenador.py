"""Reordenador supervisado: LightGBM, con regresión logística como línea base.

Ejemplos de entrenamiento ("dejar uno fuera"): por cada boleta con 2+ productos y cada producto p de ella,
contexto = boleta − {p}, objetivo = p. Se generan los candidatos del contexto; el candidato es positivo si es p.
"""

from dataclasses import dataclass

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from . import variables as V
from .conocimiento import Conocimiento


def canastas(boletas: pd.DataFrame, idx: dict[str, int]) -> list[tuple[str, list[int]]]:
    """(cliente, índices de producto) por boleta, en orden cronológico."""
    b = boletas[boletas["sku"].isin(idx)]
    salida = []
    for (_, _, cliente), g in b.groupby(["fecha", "id_boleta", "cliente_codigo"], sort=True):
        salida.append((cliente, sorted({idx[s] for s in g["sku"]})))
    return salida


def particion_temporal(boletas: pd.DataFrame, fraccion_final: float = 0.10) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Separa el último `fraccion_final` de las boletas (por fecha) del resto."""
    orden = boletas.drop_duplicates("id_boleta").sort_values(["fecha", "id_boleta"])["id_boleta"].tolist()
    corte = int(round(len(orden) * (1 - fraccion_final)))
    finales = set(orden[corte:])
    es_final = boletas["id_boleta"].isin(finales)
    return boletas[~es_final], boletas[es_final]


@dataclass
class Dataset:
    X: np.ndarray
    y: np.ndarray
    n_contextos: int
    cobertura: float  # fracción de contextos cuyo objetivo quedó entre los candidatos


def construir_dataset(k: Conocimiento, boletas: pd.DataFrame, variante: str) -> Dataset:
    Xs, ys = [], []
    n_ctx = cubiertos = 0
    for _, items in canastas(boletas, k.idx):
        if len(items) < 2:
            continue
        for objetivo in items:
            contexto = [i for i in items if i != objetivo]
            cand = V.construir(k, contexto, variante)
            n_ctx += 1
            if len(cand.indices) == 0:
                continue
            y = (cand.indices == objetivo).astype(int)
            cubiertos += int(y.any())
            Xs.append(cand.X)
            ys.append(y)
    X = np.vstack(Xs) if Xs else np.zeros((0, len(V.VARIABLES)))
    y = np.concatenate(ys) if ys else np.zeros(0, dtype=int)
    return Dataset(X, y, n_ctx, cubiertos / n_ctx if n_ctx else 0.0)


def nuevo_lightgbm(semilla: int) -> lgb.LGBMClassifier:
    return lgb.LGBMClassifier(
        n_estimators=300,
        learning_rate=0.05,
        num_leaves=15,
        min_child_samples=30,
        subsample=0.8,
        subsample_freq=1,
        colsample_bytree=0.9,
        reg_lambda=1.0,
        random_state=semilla,
        deterministic=True,
        force_row_wise=True,
        n_jobs=1,
        verbose=-1,
    )


def nueva_logistica(semilla: int):
    return make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, random_state=semilla))


@dataclass
class ResultadoEntrenamiento:
    lightgbm: lgb.LGBMClassifier
    logistica: object
    ap_lightgbm: float
    ap_logistica: float
    n_ejemplos: int
    n_positivos: int
    n_contextos: int
    cobertura: float
    importancias: dict[str, float]


def entrenar(
    k_entrenamiento: Conocimiento,
    boletas_entrenamiento: pd.DataFrame,
    boletas_validacion: pd.DataFrame,
    variante: str,
    semilla: int,
) -> ResultadoEntrenamiento:
    """Entrena con las boletas de entrenamiento y mide AP en las de validación (partición temporal)."""
    tr = construir_dataset(k_entrenamiento, boletas_entrenamiento, variante)
    va = construir_dataset(k_entrenamiento, boletas_validacion, variante)
    cols = [V.columna(v) for v in V.VARIABLES_POR_VARIANTE[variante]]
    gbm = nuevo_lightgbm(semilla).fit(tr.X[:, cols], tr.y)
    rl = nueva_logistica(semilla).fit(tr.X[:, cols], tr.y)
    ap = lambda m: float(average_precision_score(va.y, m.predict_proba(va.X[:, cols])[:, 1])) if va.y.any() else 0.0  # noqa: E731
    imp = gbm.booster_.feature_importance(importance_type="gain")
    total = float(imp.sum()) or 1.0
    return ResultadoEntrenamiento(
        lightgbm=gbm,
        logistica=rl,
        ap_lightgbm=round(ap(gbm), 4),
        ap_logistica=round(ap(rl), 4),
        n_ejemplos=int(len(tr.y)),
        n_positivos=int(tr.y.sum()),
        n_contextos=tr.n_contextos,
        cobertura=round(va.cobertura, 4),
        importancias={v: round(float(g) / total, 4) for v, g in zip(V.VARIABLES_POR_VARIANTE[variante], imp, strict=True)},
    )


def puntuar(modelo: lgb.LGBMClassifier, X: np.ndarray, variante: str) -> np.ndarray:
    cols = [V.columna(v) for v in V.VARIABLES_POR_VARIANTE[variante]]
    return modelo.predict_proba(X[:, cols])[:, 1]
