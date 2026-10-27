import numpy as np

from ferremax_recommender import variables as V
from ferremax_recommender.entrenamiento import entrenar_todo


def test_entrenamiento_determinista_con_semilla_fija(repo_chico):
    cfg = repo_chico.configuracion()
    a = entrenar_todo(repo_chico.catalogo(), repo_chico.boletas(), cfg, semilla=42, version="a")
    b = entrenar_todo(repo_chico.catalogo(), repo_chico.boletas(), cfg, semilla=42, version="b")

    assert a.reglas == b.reglas
    for clave in ("n_ejemplos", "n_positivos", "n_contextos", "cobertura_candidatos", "ap_validacion", "por_variante"):
        assert a.meta[clave] == b.meta[clave], clave

    for variante in ("COMPLETO", "REGLAS"):
        cand = V.construir(a.motor.conocimiento, [a.motor.conocimiento.idx["TUB-001"]], variante)
        cols = [V.columna(v) for v in V.VARIABLES_POR_VARIANTE[variante]]
        pa = a.motor.modelos[variante].predict_proba(cand.X[:, cols])[:, 1]
        pb = b.motor.modelos[variante].predict_proba(cand.X[:, cols])[:, 1]
        np.testing.assert_array_equal(pa, pb)

    for carrito in (["PIN-001"], ["CON-001", "FIE-001"]):
        ra = [(r.sku, r.puntaje) for r in a.motor.recomendar(carrito, 5, "ML", cfg)]
        rb = [(r.sku, r.puntaje) for r in b.motor.recomendar(carrito, 5, "ML", cfg)]
        assert ra == rb


def test_lightgbm_supera_a_la_linea_base(entrenado):
    ap = entrenado.meta["ap_validacion"]
    assert ap["lightgbm"] > ap["regresion_logistica"]
    assert 0 < entrenado.meta["cobertura_candidatos"] <= 1
    assert entrenado.meta["n_positivos"] < entrenado.meta["n_ejemplos"]
