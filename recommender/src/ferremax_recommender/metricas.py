"""Métricas de evaluación: Precision@k, Recall@k, estadísticos descriptivos y test de McNemar exacto."""

from collections.abc import Sequence

import numpy as np
from scipy.stats import binomtest


def precision_en_k(recomendados: Sequence[str], relevantes: set[str], k: int) -> float:
    return len(set(recomendados[:k]) & relevantes) / k if k > 0 else 0.0


def recall_en_k(recomendados: Sequence[str], relevantes: set[str], k: int) -> float:
    return len(set(recomendados[:k]) & relevantes) / len(relevantes) if relevantes else 0.0


def resumen(valores: Sequence[float]) -> dict:
    """n, media, mediana y desviación estándar muestral (ddof = 1)."""
    v = np.asarray(valores, dtype=float)
    if len(v) == 0:
        return {"n": 0, "media": None, "mediana": None, "de": None, "min": None, "max": None}
    return {
        "n": int(len(v)),
        "media": round(float(v.mean()), 4),
        "mediana": round(float(np.median(v)), 4),
        "de": round(float(v.std(ddof=1)), 4) if len(v) > 1 else 0.0,
        "min": round(float(v.min()), 4),
        "max": round(float(v.max()), 4),
    }


def mcnemar_exacto(aciertos_a: Sequence[bool], aciertos_b: Sequence[bool]) -> dict:
    """Tabla 2×2 pareada y p-valor bilateral exacto (binomial sobre los pares discordantes)."""
    a = np.asarray(aciertos_a, dtype=bool)
    b = np.asarray(aciertos_b, dtype=bool)
    ambos = int((a & b).sum())
    solo_a = int((a & ~b).sum())
    solo_b = int((~a & b).sum())
    ninguno = int((~a & ~b).sum())
    discordantes = solo_a + solo_b
    p = binomtest(solo_a, discordantes, 0.5).pvalue if discordantes else 1.0
    return {"ambos": ambos, "solo_primero": solo_a, "solo_segundo": solo_b, "ninguno": ninguno, "p_valor": float(f"{p:.4g}")}
