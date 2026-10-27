import pytest

from ferremax_recommender.metricas import mcnemar_exacto, precision_en_k, recall_en_k, resumen


def test_precision_y_recall_en_k():
    recs = ["a", "b", "c", "d", "e", "f"]
    relevantes = {"b", "e", "f", "z"}
    assert precision_en_k(recs, relevantes, 5) == pytest.approx(2 / 5)  # b, e (f queda fuera del top 5)
    assert recall_en_k(recs, relevantes, 5) == pytest.approx(2 / 4)
    assert precision_en_k(recs, set(), 5) == 0.0
    assert recall_en_k(recs, set(), 5) == 0.0
    # Con menos de k recomendaciones, la precisión sigue dividiéndose entre k
    assert precision_en_k(["b"], relevantes, 5) == pytest.approx(1 / 5)


def test_resumen_usa_desviacion_muestral():
    r = resumen([0.2, 0.4, 0.6, 0.8])
    assert r["n"] == 4
    assert r["media"] == pytest.approx(0.5)
    assert r["mediana"] == pytest.approx(0.5)
    assert r["de"] == pytest.approx(0.2582, abs=1e-4)  # ddof = 1
    assert (r["min"], r["max"]) == (0.2, 0.8)
    assert resumen([])["n"] == 0


def test_mcnemar_exacto():
    # 1 par solo acierta A, 9 solo B: p = 2 · P(X ≤ 1 | n=10, p=0.5) = 2 · 11/1024
    a = [True] * 5 + [True] * 1 + [False] * 9 + [False] * 3
    b = [True] * 5 + [False] * 1 + [True] * 9 + [False] * 3
    r = mcnemar_exacto(a, b)
    assert (r["ambos"], r["solo_primero"], r["solo_segundo"], r["ninguno"]) == (5, 1, 9, 3)
    assert r["p_valor"] == pytest.approx(22 / 1024, rel=1e-3)
    assert mcnemar_exacto([True, False], [True, False])["p_valor"] == 1.0
