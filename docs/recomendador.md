# Motor de recomendación de FerreMax v2

Este documento describe los algoritmos, las variables, el protocolo de validación y las métricas del servicio
`recommender/`, como base para el capítulo de metodología de la tesis. Todos los resultados citados se obtuvieron
con el dataset **sintético** (`data/sintetico/`, 5.000 boletas, semilla 2026) y la semilla de modelado 42. Son
reproducibles con `uv run pytest` y con `POST /evaluacion-offline`.

## 1. Condiciones experimentales

| Condición | Descripción |
|---|---|
| **CONV** (convencional) | Reglas de asociación vigentes, ordenadas por confianza × lift. |
| **ML** | Candidatos de reglas, filtrado colaborativo, popularidad y contenido, reordenados por un clasificador LightGBM. |

En las dos condiciones:
- Nunca se recomienda un producto que ya está en el carrito (el contexto *B*), ni uno inactivo o sin stock.
- Si hay menos de *k* recomendaciones, se completa con lo más vendido de las categorías del carrito
  (`POPULAR_CATEGORIA`) y después con lo más vendido en general (`POPULARIDAD`).

## 2. Datos

- **Transacciones:** boletas (`boletas` + `boleta_items`). Cada boleta es un conjunto de SKU; se ignoran las
  cantidades.
- **Catálogo:** 52 productos con nombre, uso, categoría, subcategoría, marca y precio.
- **Orden temporal:** las boletas se ordenan por fecha y luego por `id_boleta`. Todas las particiones respetan ese orden.

## 3. Componentes

### 3.1 Reglas de asociación (FP-Growth)

- Implementación `mlxtend.frequent_patterns.fpgrowth`, con conjuntos de hasta 3 productos (antecedente de 1 o 2
  productos) y consecuente de un solo producto.
- Para una regla A → c:
  - soporte = P(A ∪ {c})
  - confianza = P(c | A)
  - lift = confianza / P(c)
- Una regla queda **vigente** si cumple los tres umbrales de `configuracion`: `soporte_min` (0,01), `confianza_min`
  (0,15) y `lift_min` (1,2).
- **Uso en CONV:** una regla está activa si A ⊆ B y c ∉ B. Cada producto c recibe la máxima confianza × lift entre
  sus reglas activas, y ese valor es el `puntaje` devuelto.
- **Resultado con el dataset sintético:** 280 reglas vigentes.

### 3.2 Filtrado colaborativo ítem-ítem

- Matriz binaria cliente × producto: 1 si el cliente compró el producto alguna vez.
- La similitud entre dos productos es el coseno entre sus columnas.
- Para un candidato c y un contexto B:
  - `cf_score` = media de sim(c, b) para b ∈ B
  - `cf_sim_max` = máximo de sim(c, b) para b ∈ B

### 3.3 Popularidad

`popularidad_norm` = número de boletas que contienen el producto, dividido entre el del producto más vendido.

### 3.4 Contenido (TF-IDF)

- **Texto de cada producto:** nombre (peso ×2), uso, categoría, subcategoría y marca.
- **Normalización:** minúsculas, sin tildes, sin stopwords y singularización aproximada. La singularización hace
  falta porque Snowball da raíces distintas para "pared" y "paredes". Después se aplica el stemming Snowball en
  español.
- **Vectorización:** TF-IDF con `sublinear_tf` y norma L2.
- `similitud_contenido` = media del coseno entre el candidato y los productos de B.

### 3.5 Búsqueda por necesidad

- La consulta se normaliza igual que los productos y se **expande con sinónimos de ferretería**. Por ejemplo,
  "pintar" agrega pintura, látex, esmalte e imprimante, y "gotera" agrega sellador, teflón, silicona e
  impermeabilizante.
- Las palabras originales pesan el doble que los sinónimos.
- El puntaje es el coseno TF-IDF entre la consulta y cada producto. `terminos` lista las palabras de la consulta o
  sus sinónimos que aparecen en el producto.
- Los empates se resuelven por popularidad.

## 4. Reordenador supervisado (condición ML)

### 4.1 Candidatos

| Fuente | Candidatos |
|---|---|
| Reglas | consecuentes de todas las reglas activas |
| CF | top 10 por `cf_score` |
| Popularidad | top 10 global |
| Contenido | top 10 por `similitud_contenido` |

### 4.2 Variables (16, las mismas de v1)

| Grupo | Variables |
|---|---|
| Reglas | `conf_max`, `lift_max`, `soporte_max`, `n_reglas_activas` |
| Filtrado colaborativo | `cf_score`, `cf_sim_max` |
| Popularidad | `popularidad_norm` |
| Contenido | `similitud_contenido`, `fraccion_misma_categoria`, `fraccion_misma_subcategoria` |
| Precio | `log_ratio_precio` = ln(precio candidato / precio medio de B) |
| Contexto | `tam_B` |
| Origen | `viene_de_reglas`, `viene_de_cf`, `viene_de_popularidad`, `viene_de_contenido` |

**Ponderación según la configuración:**

- `peso_contenido` (w) multiplica las tres variables de contenido. w = 1 es neutro, se usa al entrenar y no altera
  nada. w > 1 favorece a los productos parecidos a los del carrito; w < 1, a los distintos.
- `variante_ml`:
  - `COMPLETO` usa las 16 variables y las 4 fuentes de candidatos.
  - `REGLAS` usa solo reglas, popularidad y `tam_B` (8 variables), con candidatos de reglas y popularidad. Las demás
    variables valen 0.

  Se entrena un modelo por variante.

### 4.3 Ejemplos de entrenamiento ("dejar uno fuera")

Por cada boleta con 2 o más productos y cada producto p de ella:
- el contexto es B = boleta − {p};
- se generan los candidatos de B;
- el ejemplo del candidato p es positivo, y los demás son negativos.

La **cobertura de candidatos** es la fracción de contextos en los que p quedó entre los candidatos.

### 4.4 Modelos

| Modelo | Hiperparámetros |
|---|---|
| LightGBM (`LGBMClassifier`) | 300 árboles, `learning_rate` 0,05, `num_leaves` 15, `min_child_samples` 30, `subsample` 0,8, `colsample_bytree` 0,9, λ = 1 |
| Línea base: regresión logística | estandarización + `LogisticRegression` |

La puntuación de un candidato es la probabilidad estimada de que sea el producto que falta.

**Determinismo:** semilla 42, `deterministic=True`, `force_row_wise=True` y un solo hilo. El test
`test_entrenamiento_determinista_con_semilla_fija` comprueba que dos entrenamientos dan reglas, métricas y
predicciones idénticas.

### 4.5 Validación (partición temporal)

1. Se ordenan las boletas por fecha. El **último 10 %** es el conjunto de validación.
2. Reglas, CF, popularidad y contenido se aprenden **solo** con el 90 % anterior, y el reordenador se entrena con los
   contextos de ese 90 %.
3. Se mide la **AP** (Average Precision, área bajo la curva precisión–exhaustividad) de los dos modelos sobre los
   contextos de validación.
4. Para servir recomendaciones, reglas, CF y popularidad se vuelven a aprender con el 100 % de las boletas. El
   reordenador validado se conserva, porque sus variables tienen la misma definición.

**Resultados (dataset sintético, 5.000 boletas):**

| Variante | n_ejemplos | n_positivos | Cobertura | AP regresión logística | AP LightGBM |
|---|---|---|---|---|---|
| COMPLETO | 235.024 | 10.509 | 0,922 | 0,3337 | **0,4158** |
| REGLAS | 157.733 | 9.411 | 0,824 | 0,3397 | **0,4331** |

Variables más importantes (ganancia, COMPLETO): `conf_max` 39 %, `lift_max` 20 %, `cf_score` 13 %, `cf_sim_max` 8 %,
`similitud_contenido` 4 %.

## 5. Evaluación offline (capa 1)

- **Partición:** el último 10 % de las boletas por fecha es el conjunto de prueba (500 boletas, del 2026-07-14 al
  2026-09-29). Todo lo demás se aprende con las 4.500 anteriores, incluida la validación interna del reordenador.
- **Protocolo "dado uno":** por cada boleta de prueba con 2 o más productos y cada producto p de ella, el contexto es
  {p}, que simula abrir el detalle de un producto o agregar el primero al carrito. Los relevantes R son los demás
  productos de la boleta. Resultan 1.268 contextos.
- **Métricas por contexto:**
  - P@5 = |top5 ∩ R| / 5
  - R@5 = |top5 ∩ R| / |R|
  - acierto = (|top5 ∩ R| > 0)
- **Resumen por modo:** n, media, mediana, desviación estándar muestral, mínimo y máximo.
- **Comparación entre modos:** test de **McNemar exacto** sobre los aciertos pareados por contexto. Es un test
  binomial bilateral sobre los pares discordantes.

| Modo | P@5 media (DE) | R@5 media (DE) | Aciertos (de 1.268) |
|---|---|---|---|
| POPULARIDAD (referencia) | 0,111 (0,140) | 0,202 (0,274) | 559 |
| CONV | **0,302** (0,223) | 0,619 (0,370) | 1.047 |
| ML_REGLAS | 0,285 (0,213) | 0,590 (0,373) | 1.025 |
| ML_COMPLETO | 0,296 (0,207) | **0,627** (0,355) | **1.099** |

| McNemar | Ambos | Solo 1.º | Solo 2.º | Ninguno | p |
|---|---|---|---|---|---|
| CONV vs ML_COMPLETO | 1.035 | 12 | 64 | 157 | 1,0 × 10⁻⁹ |
| CONV vs ML_REGLAS | 997 | 50 | 28 | 193 | 0,017 |
| ML_REGLAS vs ML_COMPLETO | 1.006 | 19 | 93 | 150 | 6,7 × 10⁻¹³ |

**Lectura de los resultados:**
- ML_COMPLETO acierta en más contextos que CONV (1.099 frente a 1.047, p < 0,001) y tiene mayor recall.
- CONV tiene una P@5 media ligeramente mayor. Cuando las reglas aciertan, suelen poner más de un relevante en el
  top 5; ML diversifica más.
- Sin la información de CF y contenido (ML_REGLAS), el reordenador no supera a CONV.

Todo esto corresponde al dataset sintético y se debe recalcular con los datos reales de la empresa.

Cada corrida se guarda en `evaluaciones_offline` y genera un CSV por contexto en `recommender/artefactos/`.

## 6. Reproducibilidad

```bash
cd recommender
uv sync
uv run pytest                    # 46 tests: reglas, métricas @k, carrito excluido, determinismo, búsqueda, API
uv run uvicorn ferremax_recommender.api:app --port 8001
curl -X POST localhost:8001/reentrenar -H "X-Internal-Key: <clave>"
curl -X POST localhost:8001/evaluacion-offline -H "X-Internal-Key: <clave>"
```
