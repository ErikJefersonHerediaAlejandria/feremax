from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Ajustes(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://ferremax@localhost:5433/ferremax_dev"
    recommender_key: str = "dev-key"
    port: int = 8001
    # Supabase Storage (opcional): si falta, los modelos solo se guardan en disco.
    supabase_url: str | None = None
    supabase_secret_key: str | None = None
    bucket_modelos: str = "modelos"
    dir_artefactos: Path = Path("artefactos")
    semilla: int = 42
    ttl_catalogo_s: float = 30.0


@lru_cache
def ajustes() -> Ajustes:
    return Ajustes()
