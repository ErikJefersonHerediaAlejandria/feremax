import pytest

from ferremax_recommender.conocimiento import Conocimiento
from ferremax_recommender.motor import Motor

CARRITOS = [["PIN-001"], ["TUB-001", "ACC-001"], ["CON-001", "FIE-001", "ALA-001"], ["ELE-001", "ELE-007", "ELE-004", "HER-004"]]


@pytest.mark.parametrize("modo", ["CONV", "ML"])
@pytest.mark.parametrize("carrito", CARRITOS)
def test_nunca_recomienda_lo_que_ya_esta_en_el_carrito(entrenado, modo, carrito):
    recs = entrenado.motor.recomendar(carrito, 5, modo, entrenado_config(entrenado))
    skus = [r.sku for r in recs]
    assert len(skus) == 5
    assert not set(skus) & set(carrito)
    assert len(set(skus)) == len(skus), "sin duplicados"


@pytest.mark.parametrize("variante", ["COMPLETO", "REGLAS"])
def test_ml_usa_el_reordenador_y_ordena_por_puntaje(entrenado, variante):
    cfg = {**entrenado_config(entrenado), "variante_ml": variante}
    recs = entrenado.motor.recomendar(["PIN-001"], 5, "ML", cfg)
    assert recs[0].fuente == "REORDENADOR"
    puntajes = [r.puntaje for r in recs if r.fuente == "REORDENADOR"]
    assert puntajes == sorted(puntajes, reverse=True)
    assert recs[0].sku == "PIN-007"  # imprimante: el complemento más fuerte de la pintura látex


def test_conv_usa_reglas_ordenadas_por_confianza_por_lift(entrenado):
    recs = entrenado.motor.recomendar(["TUB-001"], 5, "CONV", entrenado_config(entrenado))
    reglas = [r for r in recs if r.fuente == "REGLA"]
    assert reglas, "TUB-001 tiene reglas (codo, pegamento, teflón…)"
    assert [r.puntaje for r in reglas] == sorted([r.puntaje for r in reglas], reverse=True)


def test_completa_con_popularidad_si_no_hay_candidatos_suficientes(repo):
    sin_reglas = Motor(Conocimiento.construir(repo.catalogo(), repo.boletas(), reglas=[]))
    recs = sin_reglas.recomendar(["IFO-001"], 5, "CONV", repo.configuracion())
    assert len(recs) == 5
    assert {r.fuente for r in recs} <= {"POPULAR_CATEGORIA", "POPULARIDAD"}
    assert recs[0].fuente == "POPULAR_CATEGORIA"  # primero lo más vendido de Gasfitería
    assert all(r.puntaje is None for r in recs)


def test_excluye_productos_no_disponibles(entrenado):
    cfg = entrenado_config(entrenado)
    normal = [r.sku for r in entrenado.motor.recomendar(["PIN-001"], 5, "ML", cfg)]
    sin_stock = {normal[0], normal[1]}
    recs = [r.sku for r in entrenado.motor.recomendar(["PIN-001"], 5, "ML", cfg, no_disponibles=sin_stock)]
    assert len(recs) == 5 and not set(recs) & sin_stock


def test_contexto_vacio_devuelve_lo_mas_vendido(entrenado):
    recs = entrenado.motor.recomendar([], 5, "ML", entrenado_config(entrenado))
    assert [r.fuente for r in recs] == ["POPULARIDAD"] * 5
    assert recs[0].sku == "VAL-002"  # el más vendido del dataset sintético


def test_historial_del_cliente_amplia_el_contexto(entrenado):
    cfg = entrenado_config(entrenado)
    sin = [r.sku for r in entrenado.motor.recomendar(["HER-005"], 5, "ML", cfg)]
    con = [r.sku for r in entrenado.motor.recomendar(["HER-005"], 5, "ML", cfg, historial=["PIN-001", "PIN-007"])]
    assert sin != con
    assert "HER-005" not in con


def entrenado_config(entrenado) -> dict:
    return {
        "modo_activo": "ML",
        "k": 5,
        "soporte_min": 0.01,
        "confianza_min": 0.15,
        "lift_min": 1.2,
        "peso_contenido": 1.0,
        "variante_ml": "COMPLETO",
    }
