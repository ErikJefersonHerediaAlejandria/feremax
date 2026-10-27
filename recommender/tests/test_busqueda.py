import pytest


def skus(entrenado, texto: str, k: int = 5) -> list[str]:
    return [r.sku for r in entrenado.motor.buscar(texto, k)]


def test_pintar_encuentra_pinturas_latex(entrenado):
    top = skus(entrenado, "quiero pintar las paredes de mi sala", 5)
    assert {"PIN-001", "PIN-002"} <= set(top)


@pytest.mark.parametrize(
    "texto, esperado",
    [
        ("tengo una gotera en el techo", {"CON-004", "FER-001", "VAL-002"}),  # impermeabilizante, silicona, teflón
        ("se fue la luz y quiero cambiar el foco", {"ELE-008"}),
        ("necesito colgar un cuadro", {"FER-005", "CLO-001", "CLO-002", "FER-004"}),
        ("cortocircuito en el tablero", {"ELE-006"}),
        ("instalar un inodoro", {"IFO-001"}),
    ],
)
def test_sinonimos_de_ferreteria(entrenado, texto, esperado):
    assert esperado & set(skus(entrenado, texto, 5)), f"{texto!r} → {skus(entrenado, texto, 5)}"


def test_tildes_mayusculas_y_plurales_no_importan(entrenado):
    assert skus(entrenado, "TUBOS PVC") == skus(entrenado, "tubo pvc")
    assert skus(entrenado, "válvula") == skus(entrenado, "valvula")


def test_devuelve_terminos_coincidentes_y_puntaje_decreciente(entrenado):
    res = entrenado.motor.buscar("pintar pared", 5)
    assert all(r.terminos for r in res)
    assert "pintura" in res[0].terminos or "latex" in res[0].terminos
    puntajes = [r.puntaje for r in res]
    assert puntajes == sorted(puntajes, reverse=True) and all(p > 0 for p in puntajes)


def test_consulta_sin_coincidencias(entrenado):
    assert entrenado.motor.buscar("zzzz qwerty", 5) == []
    assert entrenado.motor.buscar("de la el", 5) == []
