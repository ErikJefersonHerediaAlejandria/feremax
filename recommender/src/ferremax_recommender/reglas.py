"""Minería de reglas de asociación con FP-Growth (mlxtend)."""

from collections.abc import Iterable
from dataclasses import dataclass

import pandas as pd
from mlxtend.frequent_patterns import association_rules, fpgrowth
from mlxtend.preprocessing import TransactionEncoder


@dataclass(frozen=True)
class Regla:
    antecedente: tuple[str, ...]
    consecuente: tuple[str, ...]
    soporte: float
    confianza: float
    lift: float

    @property
    def fuerza(self) -> float:
        """Criterio de orden del modo CONV: confianza × lift."""
        return self.confianza * self.lift


def minar_reglas(
    transacciones: Iterable[Iterable[str]],
    soporte_min: float,
    confianza_min: float,
    lift_min: float,
    max_antecedente: int = 2,
) -> list[Regla]:
    """Reglas A → c (consecuente de un solo producto) que cumplen los tres umbrales, ordenadas por confianza × lift."""
    canastas = [sorted(set(t)) for t in transacciones]
    canastas = [c for c in canastas if c]
    if not canastas:
        return []
    te = TransactionEncoder()
    matriz = pd.DataFrame(te.fit(canastas).transform(canastas), columns=te.columns_)
    frecuentes = fpgrowth(matriz, min_support=soporte_min, use_colnames=True, max_len=max_antecedente + 1)
    if frecuentes.empty or frecuentes["itemsets"].map(len).max() < 2:
        return []
    tabla = association_rules(frecuentes, num_itemsets=len(canastas), metric="confidence", min_threshold=confianza_min)
    tabla = tabla[(tabla["consequents"].map(len) == 1) & (tabla["lift"] >= lift_min)]
    reglas = [
        Regla(
            antecedente=tuple(sorted(f["antecedents"])),
            consecuente=tuple(sorted(f["consequents"])),
            soporte=round(float(f["support"]), 6),
            confianza=round(float(f["confidence"]), 6),
            lift=round(float(f["lift"]), 6),
        )
        for _, f in tabla.iterrows()
    ]
    return sorted(reglas, key=lambda r: (-r.fuerza, r.antecedente, r.consecuente))


def filtrar(reglas: Iterable[Regla], soporte_min: float, confianza_min: float, lift_min: float) -> list[Regla]:
    return [r for r in reglas if r.soporte >= soporte_min and r.confianza >= confianza_min and r.lift >= lift_min]
