"""Estructuras aprendidas de los datos: popularidad, CF ítem-ítem, similitud de contenido e índice de reglas."""

from collections import defaultdict
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .reglas import Regla
from .texto import expandir, raices


def texto_producto(p: pd.Series) -> list[str]:
    """Raíces del producto para TF-IDF. El nombre pesa el doble que uso, categoría y subcategoría."""
    nombre = raices(str(p["nombre"] or ""))
    resto = raices(" ".join(str(p[c] or "") for c in ("uso", "categoria", "subcategoria", "marca")))
    return nombre + nombre + resto


@dataclass
class Conocimiento:
    skus: list[str]
    idx: dict[str, int]
    categoria: np.ndarray
    subcategoria: np.ndarray
    precio: np.ndarray
    popularidad: np.ndarray  # nº de boletas con el producto / máximo → [0, 1]
    sim_cf: np.ndarray  # coseno ítem-ítem sobre la matriz cliente × producto
    sim_contenido: np.ndarray  # coseno TF-IDF producto × producto
    reglas: list[Regla]
    vectorizador: TfidfVectorizer
    matriz_tfidf: sparse.csr_matrix
    raices_producto: list[set[str]]
    historial: dict[str, list[str]] = field(default_factory=dict)  # cliente → skus comprados (más frecuentes primero)
    n_boletas: int = 0
    n_clientes: int = 0
    reglas_por_consecuente: dict[int, list[tuple[frozenset[int], Regla]]] = field(default_factory=dict)

    @classmethod
    def construir(cls, catalogo: pd.DataFrame, boletas: pd.DataFrame, reglas: list[Regla]) -> "Conocimiento":
        catalogo = catalogo.sort_values("sku").reset_index(drop=True)
        skus = catalogo["sku"].tolist()
        idx = {s: i for i, s in enumerate(skus)}
        n = len(skus)
        b = boletas[boletas["sku"].isin(idx)].drop_duplicates(["id_boleta", "sku"])

        # Popularidad: proporción de boletas que contienen el producto, normalizada al más vendido.
        conteo = np.zeros(n)
        for sku, c in b.groupby("sku")["id_boleta"].nunique().items():
            conteo[idx[sku]] = c
        popularidad = conteo / conteo.max() if conteo.max() > 0 else conteo

        # CF ítem-ítem: coseno entre columnas de la matriz binaria cliente × producto.
        clientes = sorted(b["cliente_codigo"].unique())
        ic = {c: i for i, c in enumerate(clientes)}
        cp = b.drop_duplicates(["cliente_codigo", "sku"])
        m = sparse.csr_matrix(
            (np.ones(len(cp)), (cp["cliente_codigo"].map(ic).to_numpy(), cp["sku"].map(idx).to_numpy())),
            shape=(len(clientes), n),
        )
        sim_cf = cosine_similarity(m.T) if len(clientes) else np.zeros((n, n))
        np.fill_diagonal(sim_cf, 0.0)

        # Contenido: TF-IDF sobre nombre, uso, categoría, subcategoría y marca (raíces en español).
        docs = [texto_producto(p) for _, p in catalogo.iterrows()]
        vectorizador = TfidfVectorizer(analyzer=lambda d: d, sublinear_tf=True, norm="l2")
        tfidf = vectorizador.fit_transform(docs)
        sim_contenido = cosine_similarity(tfidf)
        np.fill_diagonal(sim_contenido, 0.0)

        historial = {
            c: g.groupby("sku").size().sort_values(ascending=False, kind="stable").index.tolist()
            for c, g in b.groupby("cliente_codigo")
        }
        k = cls(
            skus=skus,
            idx=idx,
            categoria=catalogo["categoria"].fillna("").to_numpy(dtype=object),
            subcategoria=catalogo["subcategoria"].fillna("").to_numpy(dtype=object),
            precio=catalogo["precio"].astype(float).to_numpy(),
            popularidad=popularidad,
            sim_cf=sim_cf,
            sim_contenido=sim_contenido,
            reglas=[],
            vectorizador=vectorizador,
            matriz_tfidf=tfidf.tocsr(),
            raices_producto=[set(d) for d in docs],
            historial=historial,
            n_boletas=int(b["id_boleta"].nunique()),
            n_clientes=len(clientes),
        )
        k.cambiar_reglas(reglas)
        return k

    def cambiar_reglas(self, reglas: list[Regla]) -> None:
        self.reglas = [r for r in reglas if all(s in self.idx for s in r.antecedente + r.consecuente)]
        indice: dict[int, list[tuple[frozenset[int], Regla]]] = defaultdict(list)
        for r in self.reglas:
            indice[self.idx[r.consecuente[0]]].append((frozenset(self.idx[s] for s in r.antecedente), r))
        self.reglas_por_consecuente = dict(indice)

    def reglas_activas(self, contexto: set[int]) -> list[tuple[int, Regla]]:
        """(consecuente, regla) cuyas premisas están todas en el contexto y cuyo consecuente no lo está."""
        return [
            (c, r) for c, lista in self.reglas_por_consecuente.items() if c not in contexto for ant, r in lista if ant <= contexto
        ]

    def buscar(self, texto: str, k: int) -> list[tuple[str, float, list[str]]]:
        """Búsqueda por necesidad: coseno TF-IDF entre la consulta (con sinónimos) y cada producto."""
        tokens, legible = expandir(texto)
        if not tokens:
            return []
        q = self.vectorizador.transform([tokens])
        if q.nnz == 0:
            return []
        puntajes = (self.matriz_tfidf @ q.T).toarray().ravel()
        orden = sorted(range(len(self.skus)), key=lambda i: (-puntajes[i], -self.popularidad[i], self.skus[i]))
        consulta = set(tokens)
        salida = []
        for i in orden[:k]:
            if puntajes[i] <= 0:
                break
            comunes = sorted(consulta & self.raices_producto[i], key=lambda r: tokens.index(r))
            salida.append((self.skus[i], round(float(puntajes[i]), 4), [legible.get(r, r) for r in comunes]))
        return salida
