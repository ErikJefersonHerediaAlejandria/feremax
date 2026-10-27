import pytest
from fastapi.testclient import TestClient

from ferremax_recommender.almacen import Almacen
from ferremax_recommender.api import crear_app
from ferremax_recommender.datos import RepositorioMemoria
from ferremax_recommender.servicio import Servicio

CLAVE = {"X-Internal-Key": "clave-test"}
CAMPOS = {
    "sku",
    "nombre",
    "marca",
    "categoria",
    "subcategoria",
    "unidad",
    "uso",
    "precio",
    "stock",
    "puntaje",
    "terminos",
    "fuente",
    "posicion",
}


@pytest.fixture(scope="module")
def cliente(repo_chico, tmp_path_factory):
    repo = RepositorioMemoria(repo_chico.catalogo_df.copy(), repo_chico.boletas_df)
    servicio = Servicio(repo, Almacen(tmp_path_factory.mktemp("artefactos")))
    with TestClient(crear_app(servicio, "clave-test")) as c:
        c.repo = repo  # type: ignore[attr-defined]
        yield c


@pytest.mark.parametrize("ruta", ["/recomendar", "/buscar-necesidad", "/reentrenar", "/evaluacion-offline", "/recargar"])
def test_rutas_protegidas_exigen_clave(cliente, ruta):
    assert cliente.post(ruta, json={}).status_code == 401
    assert cliente.post(ruta, json={}, headers={"X-Internal-Key": "otra"}).status_code == 401


def test_health_sin_clave(cliente):
    r = cliente.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_reentrenar_guarda_reglas_modelo_y_metadatos(cliente):
    r = cliente.post("/reentrenar", headers=CLAVE)
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["status"] == "ok" and cuerpo["comprobantes"] == 1500 and cuerpo["reglas"] > 0
    repo = cliente.repo
    assert len(repo.reglas) == cuerpo["reglas"]
    assert repo.modelo_vigente()["artefacto"].startswith("local://reordenador-")
    meta = repo.config["reordenador"]
    assert set(meta["ap_validacion"]) == {"regresion_logistica", "lightgbm"}
    assert meta["validacion"].startswith("temporal")
    assert cliente.get("/health").json()["modelo"] == meta["version"]


def test_recomendar_devuelve_producto_puntuado(cliente):
    r = cliente.post("/recomendar", json={"skus": ["PIN-001"], "k": 5, "modo": "ML"}, headers=CLAVE)
    assert r.status_code == 200
    datos = r.json()
    assert len(datos) == 5 and set(datos[0]) == CAMPOS
    assert [d["posicion"] for d in datos] == [1, 2, 3, 4, 5]
    assert all(d["sku"] != "PIN-001" and d["stock"] > 0 for d in datos)


def test_recomendar_no_ofrece_productos_sin_stock(cliente):
    cliente.repo.catalogo_df.loc[cliente.repo.catalogo_df["sku"] == "ACC-001", "stock"] = 0
    cliente.post("/recargar", headers=CLAVE)
    datos = cliente.post("/recomendar", json={"skus": ["TUB-001"], "k": 5, "modo": "CONV"}, headers=CLAVE).json()
    assert "ACC-001" not in [d["sku"] for d in datos]


def test_validacion_de_entrada(cliente):
    assert cliente.post("/recomendar", json={"skus": [], "k": 0}, headers=CLAVE).status_code == 422
    assert cliente.post("/recomendar", json={"skus": [], "modo": "OTRO"}, headers=CLAVE).status_code == 422
    assert cliente.post("/buscar-necesidad", json={"texto": ""}, headers=CLAVE).status_code == 422


def test_buscar_necesidad(cliente):
    datos = cliente.post("/buscar-necesidad", json={"texto": "pintar pared", "k": 3}, headers=CLAVE).json()
    assert len(datos) == 3 and datos[0]["fuente"] == "CONTENIDO" and datos[0]["terminos"]


def test_evaluacion_offline(cliente):
    r = cliente.post("/evaluacion-offline", headers=CLAVE)
    assert r.status_code == 200
    ev = r.json()
    assert ev["modos"] == ["POPULARIDAD", "CONV", "ML_REGLAS", "ML_COMPLETO"]
    for m in ev["modos"]:
        assert 0 <= ev["por_modo"][m]["precision5"]["media"] <= 1
        assert 0 <= ev["por_modo"][m]["recall5"]["media"] <= 1
    assert "CONV_vs_ML_COMPLETO" in ev["mcnemar_exacto"]
    assert ev["n_entrenamiento"] + ev["n_prueba_total"] == 1500
    assert len(cliente.repo.evaluaciones) == 1
