"""Motor de recomendación: modo CONV (reglas) y modo ML (candidatos + reordenador LightGBM)."""

from dataclasses import dataclass, field

from . import reordenador as R
from . import variables as V
from .conocimiento import Conocimiento
from .reglas import filtrar


@dataclass
class Recomendacion:
    sku: str
    puntaje: float | None
    fuente: str
    terminos: list[str] = field(default_factory=list)


@dataclass
class Motor:
    conocimiento: Conocimiento
    modelos: dict[str, object] = field(default_factory=dict)  # variante → LGBMClassifier
    version_modelo: str | None = None

    def _indices(self, skus: list[str]) -> list[int]:
        return sorted({self.conocimiento.idx[s] for s in skus if s in self.conocimiento.idx})

    def populares(self, contexto: list[int], ya: list[int], prohibidos: set[int], k: int) -> list[Recomendacion]:
        """Completa con lo más vendido de las categorías del contexto y luego con lo más vendido en general."""
        kn = self.conocimiento
        cats = {kn.categoria[i] for i in contexto}
        usados = set(ya) | prohibidos
        orden = sorted(range(len(kn.skus)), key=lambda i: (-kn.popularidad[i], kn.skus[i]))
        salida: list[Recomendacion] = []
        for fuente, condicion in (("POPULAR_CATEGORIA", lambda i: kn.categoria[i] in cats), ("POPULARIDAD", lambda i: True)):
            for i in orden:
                if len(ya) + len(salida) >= k:
                    return salida
                if i not in usados and condicion(i):
                    salida.append(Recomendacion(kn.skus[i], None, fuente))
                    usados.add(i)
        return salida

    def recomendar(
        self,
        skus: list[str],
        k: int,
        modo: str,
        config: dict,
        historial: list[str] | None = None,
        no_disponibles: set[str] | None = None,
    ) -> list[Recomendacion]:
        """Top-k para el contexto `skus` (∪ historial del cliente, si se da). Nunca devuelve lo que está en `skus`."""
        kn = self.conocimiento
        carrito = self._indices(skus)
        contexto = sorted(set(carrito) | set(self._indices(historial or [])))
        prohibidos = set(carrito) | set(self._indices(list(no_disponibles or [])))
        if not contexto:
            return self.populares([], [], prohibidos, k)

        elegidos: list[tuple[int, float, str]] = []
        variante = V.variante_valida(config.get("variante_ml"))
        modelo = self.modelos.get(variante)
        if modo == "ML" and modelo is not None:
            cand = V.construir(kn, contexto, variante, float(config.get("peso_contenido", 1.0)), excluir=prohibidos)
            if len(cand.indices):
                p = R.puntuar(modelo, cand.X, variante)
                orden = sorted(range(len(p)), key=lambda j: (-p[j], kn.skus[cand.indices[j]]))
                elegidos = [(int(cand.indices[j]), round(float(p[j]), 4), "REORDENADOR") for j in orden[:k]]
        else:
            # CONV (y ML sin modelo entrenado): reglas vigentes que cumplen los umbrales actuales, por confianza × lift.
            umbrales = (float(config["soporte_min"]), float(config["confianza_min"]), float(config["lift_min"]))
            mejor: dict[int, float] = {}
            vigentes = set(filtrar(kn.reglas, *umbrales))
            for c, r in kn.reglas_activas(set(contexto)):
                if r in vigentes and c not in prohibidos and r.fuerza > mejor.get(c, -1.0):
                    mejor[c] = r.fuerza
            orden = sorted(mejor, key=lambda c: (-mejor[c], kn.skus[c]))
            elegidos = [(c, round(mejor[c], 4), "REGLA") for c in orden[:k]]

        salida = [Recomendacion(kn.skus[i], s, f) for i, s, f in elegidos]
        return salida + self.populares(contexto, [i for i, _, _ in elegidos], prohibidos, k)

    def buscar(self, texto: str, k: int) -> list[Recomendacion]:
        return [Recomendacion(s, p, "CONTENIDO", t) for s, p, t in self.conocimiento.buscar(texto, k)]
