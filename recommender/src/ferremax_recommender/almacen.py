"""Artefactos del modelo: disco local y, si está configurado, el bucket privado de Supabase Storage."""

import io
from pathlib import Path

import httpx
import joblib


class Almacen:
    def __init__(self, directorio: Path, supabase_url: str | None = None, clave: str | None = None, bucket: str = "modelos"):
        self.directorio = directorio
        self.url = supabase_url.rstrip("/") if supabase_url else None
        self.clave = clave
        self.bucket = bucket

    @property
    def remoto(self) -> bool:
        return bool(self.url and self.clave)

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.clave}", "apikey": self.clave or ""}

    def guardar(self, nombre: str, objeto: object) -> str:
        """Guarda en disco y sube al bucket. Devuelve la referencia que se registra en `modelos.artefacto`."""
        self.directorio.mkdir(parents=True, exist_ok=True)
        joblib.dump(objeto, self.directorio / nombre, compress=3)
        if not self.remoto:
            return f"local://{nombre}"
        r = httpx.post(
            f"{self.url}/storage/v1/object/{self.bucket}/{nombre}",
            content=(self.directorio / nombre).read_bytes(),
            headers={**self._headers(), "Content-Type": "application/octet-stream", "x-upsert": "true"},
            timeout=60,
        )
        r.raise_for_status()
        return f"storage://{self.bucket}/{nombre}"

    def cargar(self, referencia: str) -> object:
        nombre = referencia.split("/")[-1]
        local = self.directorio / nombre
        if local.exists():
            return joblib.load(local)
        if referencia.startswith("storage://") and self.remoto:
            r = httpx.get(f"{self.url}/storage/v1/object/{self.bucket}/{nombre}", headers=self._headers(), timeout=60)
            r.raise_for_status()
            self.directorio.mkdir(parents=True, exist_ok=True)
            local.write_bytes(r.content)
            return joblib.load(io.BytesIO(r.content))
        raise FileNotFoundError(f"No se encontró el artefacto {referencia}")
