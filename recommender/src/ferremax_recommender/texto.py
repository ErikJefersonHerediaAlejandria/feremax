"""Normalización, stemming en español y sinónimos de ferretería para TF-IDF."""

import re
import unicodedata
from functools import lru_cache

import snowballstemmer

_stemmer = snowballstemmer.stemmer("spanish")

STOPWORDS = set(
    """a al algo con de del el en es esta este la las lo los mi mis o para por que se sin su sus un una uno unos
    unas y x mas muy como tengo quiero necesito busco hay donde me casa algun alguna cual cuales""".split()
)

# Necesidad del cliente → términos del catálogo. Claves y valores ya normalizados (minúsculas, sin tildes).
SINONIMOS: dict[str, list[str]] = {
    "pintar": ["pintura", "latex", "esmalte", "imprimante", "masking"],
    "pintura": ["latex", "esmalte", "imprimante"],
    "pared": ["tarugo"],
    "paredes": ["tarugo"],
    "gotera": ["sellador", "teflon", "silicona", "impermeabilizante"],
    "fuga": ["teflon", "sellado", "silicona", "valvula"],
    "gotea": ["teflon", "sellado", "valvula"],
    "goteo": ["teflon", "sellado", "valvula"],
    "filtracion": ["impermeabilizante", "silicona", "sellado"],
    "humedad": ["impermeabilizante", "sika"],
    "impermeabilizar": ["impermeabilizante", "sika"],
    "techo": ["impermeabilizante", "sika"],
    "cano": ["valvula", "tubo", "teflon"],
    "grifo": ["valvula", "teflon"],
    "llave": ["valvula", "termomagnetico"],
    "agua": ["tubo", "pvc", "codo", "tee", "valvula"],
    "tuberia": ["tubo", "pvc", "codo", "tee"],
    "desague": ["desague", "sal", "codo"],
    "bano": ["inodoro", "lavatorio", "sanitario"],
    "sanitario": ["inodoro", "lavatorio"],
    "wc": ["inodoro"],
    "luz": ["foco", "led", "interruptor"],
    "iluminar": ["foco", "led"],
    "lampara": ["foco", "led"],
    "enchufe": ["tomacorriente"],
    "toma": ["tomacorriente"],
    "electrica": ["cable", "interruptor", "tomacorriente", "aislante"],
    "electrico": ["cable", "interruptor", "tomacorriente", "aislante"],
    "cortocircuito": ["termomagnetico", "aislante"],
    "breaker": ["termomagnetico"],
    "taladrar": ["taladro", "broca", "tarugo"],
    "perforar": ["taladro", "broca"],
    "agujero": ["taladro", "broca", "tarugo"],
    "hueco": ["taladro", "broca", "tarugo"],
    "colgar": ["tarugo", "tornillo", "clavo", "broca"],
    "cuadro": ["tarugo", "clavo", "tornillo"],
    "repisa": ["tarugo", "tornillo", "broca"],
    "pegar": ["pegamento", "silicona", "cola"],
    "madera": ["clavo", "tornillo", "martillo", "sierra"],
    "mueble": ["clavo", "tornillo", "martillo", "pegamento"],
    "cortar": ["sierra", "amoladora", "alicate"],
    "medir": ["wincha", "flexometro"],
    "construir": ["cemento", "fierro", "alambre"],
    "obra": ["cemento", "fierro", "alambre"],
    "columna": ["fierro", "cemento", "alambre"],
    "losa": ["fierro", "cemento", "alambre"],
    "vaciar": ["cemento", "fierro"],
    "concreto": ["cemento", "fierro", "broca"],
    "oxido": ["esmalte", "aerosol"],
    "reja": ["esmalte", "aerosol"],
    "metal": ["esmalte", "aerosol"],
    "spray": ["aerosol"],
    "atornillar": ["destornillador", "tornillo"],
    "desarmar": ["destornillador", "alicate"],
}


def normalizar(texto: str) -> str:
    sin_tildes = "".join(c for c in unicodedata.normalize("NFD", texto.lower()) if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", sin_tildes).strip()


def palabras(texto: str) -> list[str]:
    """Palabras normalizadas útiles (sin stopwords, sin números sueltos, de 2+ letras)."""
    return [p for p in normalizar(texto).split() if len(p) >= 2 and not p.isdigit() and p not in STOPWORDS]


def singular(palabra: str) -> str:
    """Singular aproximado: Snowball da raíces distintas para "pared" (par) y "paredes" (pared)."""
    if len(palabra) > 4 and palabra.endswith("ces"):
        return palabra[:-3] + "z"  # luces → luz
    if len(palabra) > 4 and palabra.endswith("es") and palabra[-3] not in "aeiou":
        return palabra[:-2]  # paredes → pared
    if len(palabra) > 3 and palabra.endswith("s") and palabra[-2] in "aeiou":
        return palabra[:-1]  # tubos → tubo
    return palabra


@lru_cache(maxsize=4096)
def raiz(palabra: str) -> str:
    return _stemmer.stemWord(singular(palabra))


def raices(texto: str) -> list[str]:
    return [raiz(p) for p in palabras(texto)]


def expandir(texto: str) -> tuple[list[str], dict[str, str]]:
    """Raíces de la consulta más sus sinónimos.

    Devuelve (raíces, con repetición como peso; raíz → palabra legible). Las palabras originales pesan el doble
    que sus sinónimos."""
    tokens: list[str] = []
    legible: dict[str, str] = {}
    for p in palabras(texto):
        r = raiz(p)
        tokens += [r, r]
        legible.setdefault(r, p)
        for s in SINONIMOS.get(p, []):
            rs = raiz(s)
            tokens.append(rs)
            legible.setdefault(rs, s)
    return tokens, legible
