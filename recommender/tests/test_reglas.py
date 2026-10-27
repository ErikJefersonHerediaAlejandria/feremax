import pytest

from ferremax_recommender.reglas import Regla, filtrar, minar_reglas

# 10 boletas con soportes calculables a mano:
#   pintura 6/10, imprimante 5/10, rodillo 4/10, tubo 3/10, codo 3/10
#   {pintura, imprimante} 5/10, {pintura, rodillo} 3/10, {imprimante, rodillo} 2/10, {tubo, codo} 3/10
TRANSACCIONES = [
    ["pintura", "imprimante", "rodillo"],
    ["pintura", "imprimante", "rodillo"],
    ["pintura", "imprimante"],
    ["pintura", "imprimante"],
    ["pintura", "imprimante"],
    ["pintura", "rodillo"],
    ["rodillo"],
    ["tubo", "codo"],
    ["tubo", "codo"],
    ["tubo", "codo"],
]


def buscar(reglas: list[Regla], antecedente: tuple[str, ...], consecuente: str) -> Regla:
    return next(r for r in reglas if r.antecedente == antecedente and r.consecuente == (consecuente,))


def test_soporte_confianza_y_lift_coinciden_con_el_calculo_manual():
    reglas = minar_reglas(TRANSACCIONES, soporte_min=0.2, confianza_min=0.1, lift_min=0.0)
    r = buscar(reglas, ("imprimante",), "pintura")
    assert r.soporte == pytest.approx(0.5)
    assert r.confianza == pytest.approx(1.0)  # 5/5
    assert r.lift == pytest.approx(1.0 / 0.6)  # confianza / soporte(pintura)
    r = buscar(reglas, ("pintura",), "imprimante")
    assert r.confianza == pytest.approx(5 / 6)
    assert r.lift == pytest.approx((5 / 6) / 0.5)
    r = buscar(reglas, ("codo",), "tubo")
    assert (r.soporte, r.confianza, r.lift) == pytest.approx((0.3, 1.0, 1 / 0.3))
    r = buscar(reglas, ("imprimante", "pintura"), "rodillo")  # antecedente de 2 productos
    assert r.soporte == pytest.approx(0.2)
    assert r.confianza == pytest.approx(0.4)  # 2/5


def test_aplica_los_tres_umbrales():
    reglas = minar_reglas(TRANSACCIONES, soporte_min=0.25, confianza_min=0.6, lift_min=1.2)
    assert reglas, "debería haber reglas"
    for r in reglas:
        assert r.soporte >= 0.25 and r.confianza >= 0.6 and r.lift >= 1.2
    # {imprimante, rodillo} tiene soporte 0.2 < 0.25
    assert not any(set(r.antecedente) | set(r.consecuente) == {"imprimante", "rodillo"} for r in reglas)
    # pintura → rodillo: lift 0.5/0.4 = 1.25 pero confianza 0.5 < 0.6
    assert not any(r.antecedente == ("pintura",) and r.consecuente == ("rodillo",) for r in reglas)


def test_consecuente_unico_y_orden_por_confianza_por_lift():
    reglas = minar_reglas(TRANSACCIONES, soporte_min=0.2, confianza_min=0.1, lift_min=0.0)
    assert all(len(r.consecuente) == 1 for r in reglas)
    fuerzas = [r.confianza * r.lift for r in reglas]
    assert fuerzas == sorted(fuerzas, reverse=True)


def test_sin_transacciones_o_sin_pares_no_hay_reglas():
    assert minar_reglas([], 0.1, 0.1, 1.0) == []
    assert minar_reglas([["a"], ["b"], ["a"]], 0.1, 0.1, 1.0) == []


def test_filtrar_por_umbrales_actuales():
    reglas = minar_reglas(TRANSACCIONES, soporte_min=0.2, confianza_min=0.1, lift_min=0.0)
    assert all(r.lift >= 2 for r in filtrar(reglas, 0.0, 0.0, 2.0))
    assert len(filtrar(reglas, 0.0, 0.0, 2.0)) < len(reglas)
