"""Evaluación offline (capa 1): Precision@5 y Recall@5 por modo sobre el 10 % final de las boletas.

Protocolo "dado uno": por cada boleta de prueba con 2+ productos y cada producto p de ella, el contexto es {p}
(como al abrir el detalle o agregar el primer producto) y los relevantes son los demás productos de la boleta.
Todo lo que usa cada modo (reglas, CF, popularidad, reordenador) se aprende solo con el 90 % anterior.
"""

import csv
from datetime import UTC, datetime
from itertools import combinations
from pathlib import Path

import pandas as pd

from . import reordenador as R
from . import variables as V
from .entrenamiento import entrenar_todo
from .metricas import mcnemar_exacto, precision_en_k, recall_en_k, resumen

MODOS = ("POPULARIDAD", "CONV", "ML_REGLAS", "ML_COMPLETO")


def _recomendar(entrenado, modo: str, skus: list[str], k: int, config: dict) -> list[str]:
    m = entrenado.motor
    if modo == "POPULARIDAD":
        recs = m.populares([], [], set(m._indices(skus)), k)
    elif modo == "CONV":
        recs = m.recomendar(skus, k, "CONV", config)
    else:
        recs = m.recomendar(skus, k, "ML", {**config, "variante_ml": modo.removeprefix("ML_")})
    return [r.sku for r in recs]


def evaluar_offline(
    catalogo: pd.DataFrame,
    boletas: pd.DataFrame,
    config: dict,
    semilla: int,
    k: int = 5,
    dir_salida: Path | None = None,
) -> dict:
    entrenamiento, prueba = R.particion_temporal(boletas, 0.10)
    entrenado = entrenar_todo(catalogo, entrenamiento, config, semilla, version="evaluacion")
    kn = entrenado.motor.conocimiento

    filas = []
    aciertos: dict[str, list[bool]] = {m: [] for m in MODOS}
    prec: dict[str, list[float]] = {m: [] for m in MODOS}
    rec: dict[str, list[float]] = {m: [] for m in MODOS}
    cubiertos = n_ctx = 0
    canastas_prueba = R.canastas(prueba, kn.idx)
    for cliente, items in canastas_prueba:
        if len(items) < 2:
            continue
        for i in items:
            contexto = [kn.skus[i]]
            relevantes = {kn.skus[j] for j in items if j != i}
            n_ctx += 1
            cand = V.construir(kn, [i], "COMPLETO")
            cubiertos += int(any(kn.skus[c] in relevantes for c in cand.indices))
            fila = {"cliente": cliente, "contexto": contexto[0], "relevantes": "|".join(sorted(relevantes))}
            for modo in MODOS:
                recomendados = _recomendar(entrenado, modo, contexto, k, config)
                p = precision_en_k(recomendados, relevantes, k)
                r = recall_en_k(recomendados, relevantes, k)
                prec[modo].append(p)
                rec[modo].append(r)
                aciertos[modo].append(p > 0)
                fila[f"{modo}_recomendados"] = "|".join(recomendados)
                fila[f"{modo}_precision5"] = round(p, 4)
            filas.append(fila)

    ruta_csv = None
    if dir_salida is not None and filas:
        dir_salida.mkdir(parents=True, exist_ok=True)
        ruta = dir_salida / f"evaluacion-offline-{datetime.now(UTC):%Y%m%d%H%M%S}.csv"
        with ruta.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(filas[0]))
            w.writeheader()
            w.writerows(filas)
        ruta_csv = str(ruta)

    f_tr = pd.to_datetime(entrenamiento["fecha"], utc=True)
    f_te = pd.to_datetime(prueba["fecha"], utc=True)
    meta = entrenado.meta
    return {
        "fecha_corrida": datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S"),
        "n_prueba_evaluados": n_ctx,
        "n_prueba_total": int(prueba["id_boleta"].nunique()),
        "n_boletas_prueba_evaluadas": sum(1 for _, items in canastas_prueba if len(items) >= 2),
        "n_entrenamiento": int(entrenamiento["id_boleta"].nunique()),
        "n_comprobantes": int(boletas["id_boleta"].nunique()),
        "semilla": semilla,
        "particion": "temporal: último 10 % de las boletas como prueba",
        "protocolo": "dado uno: contexto = 1 producto de la boleta, relevantes = los demás",
        "k": k,
        "periodo_entrenamiento": [f_tr.min().strftime("%Y-%m-%d"), f_tr.max().strftime("%Y-%m-%d")],
        "periodo_prueba": [f_te.min().strftime("%Y-%m-%d"), f_te.max().strftime("%Y-%m-%d")],
        "umbrales": {u: float(config[u]) for u in ("soporte_min", "confianza_min", "lift_min")},
        "reglas_entrenadas": len(entrenado.reglas),
        "cf_productos": len(kn.skus),
        "cf_clientes": kn.n_clientes,
        "reordenador": {
            "tipo": "lightgbm",
            "n_ejemplos": meta["n_ejemplos"],
            "n_positivos": meta["n_positivos"],
            "ap_validacion": meta["ap_validacion"],
        },
        "cobertura_candidatos_prueba": round(cubiertos / n_ctx, 4) if n_ctx else 0.0,
        "peso_contenido": float(config.get("peso_contenido", 1.0)),
        "fuente_datos": config.get("fuente_datos"),
        "csv": ruta_csv,
        "modos": list(MODOS),
        "por_modo": {
            m: {"precision5": resumen(prec[m]), "recall5": resumen(rec[m]), "aciertos": int(sum(aciertos[m]))} for m in MODOS
        },
        "mcnemar_exacto": {f"{a}_vs_{b}": mcnemar_exacto(aciertos[a], aciertos[b]) for a, b in combinations(MODOS, 2)},
    }
