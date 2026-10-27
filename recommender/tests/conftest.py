from pathlib import Path

import pytest

from ferremax_recommender.datos import RepositorioMemoria
from ferremax_recommender.entrenamiento import entrenar_todo

DATA = Path(__file__).resolve().parents[2] / "data"


@pytest.fixture(scope="session")
def repo() -> RepositorioMemoria:
    return RepositorioMemoria.desde_archivos(DATA)


@pytest.fixture(scope="session")
def repo_chico(repo) -> RepositorioMemoria:
    """Las primeras 1.500 boletas: entrena en ~3 s, suficiente para tests de la API y de determinismo."""
    ids = repo.boletas_df["id_boleta"].drop_duplicates().iloc[:1500]
    b = repo.boletas_df[repo.boletas_df["id_boleta"].isin(ids)].reset_index(drop=True)
    return RepositorioMemoria(repo.catalogo_df.copy(), b)


@pytest.fixture(scope="session")
def entrenado(repo):
    return entrenar_todo(repo.catalogo(), repo.boletas(), repo.configuracion(), semilla=42, version="test")
