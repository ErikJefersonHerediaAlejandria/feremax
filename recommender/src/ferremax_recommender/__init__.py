"""FerreMax · servicio recomendador (reglas de asociación, CF, popularidad y reordenador LightGBM)."""

__version__ = "2.0.0"


def main() -> None:
    import uvicorn

    from .config import ajustes

    uvicorn.run("ferremax_recommender.api:app", host="0.0.0.0", port=ajustes().port)
