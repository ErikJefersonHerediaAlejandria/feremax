# API FerreMax v2

- **Base:** `https://api.sosdigital.lat` en producción, `http://localhost:4000` en local.
- **Compatibilidad:** las 25 operaciones de `docs/openapi-v1.json` existen con los mismos nombres de ruta y de
  campo. Lo verifica `backend/test/e2e/contrato.e2e-spec.ts`.
- **Swagger** en `/api/docs`, solo fuera de producción.

## Convenciones

- **Errores:** `{"detail": "mensaje"}`. Las validaciones (422) usan el formato de FastAPI de v1:
  `{"detail": [{"type", "loc": ["body"|"query"|"path", campo], "msg"}]}`. Un campo no declarado se rechaza
  (`extra_forbidden`).
- **Sesión experimental:** la cabecera `x-sesion-evaluacion: <token_dispositivo>` vincula el navegador a la sesión
  activa.
  - **Con token válido:** la sesión decide la condición (`CONV`/`ML`), `id_sesion`, `codigo_cliente` y
    `escenario` de eventos y pedidos. Se ignora lo que mande el cliente.
  - **Sin token:** `id_sesion = "SIN-SESION"` y la condición es `configuracion.modo_activo`.
- **Admin:** cookie `ferremax_admin` (JWT, `HttpOnly; Secure; SameSite=Lax`, 8 h), emitida por `POST /api/admin/login`.
  También se acepta `Authorization: Bearer <token>`. Sin credencial válida, todas las rutas admin responden
  `401 {"detail":"Se requiere iniciar sesión en el panel"}`.
- **Rate limiting** por IP y minuto, configurable por variables de entorno:

  | Ruta | Límite por defecto | Variable |
  |---|---|---|
  | `POST /api/eventos` | 600 | `THROTTLE_EVENTOS` |
  | `POST /api/carrito/confirmar` | 20 | `THROTTLE_CONFIRMAR` |
  | `POST /api/admin/login` | 5 | `THROTTLE_LOGIN` |

  Al superarlo responde `429`.
- **`ProductoResponse`:** `{sku, nombre, marca, categoria, subcategoria, unidad, uso, precio, stock}`.
- **`ProductoPuntuado`:** `ProductoResponse` + `{puntaje, terminos[], fuente, posicion}`.
  - `fuente` ∈ `REGLA`, `REORDENADOR`, `POPULAR_CATEGORIA`, `POPULARIDAD`, `CONTENIDO`.
  - `puntaje` es `null` cuando la fuente es popularidad.

## Públicas

### `GET /api/health`
```json
{"status":"ok","version":"2.0.0","base_datos":"ok","recommender":"ok"}
```
Responde 503 si la base de datos no responde. Es una ruta nueva respecto de v1.

### `GET /api/productos?categoria=Gasfitería`
Productos activos, del más al menos vendido.
```json
[{"sku":"VAL-002","nombre":"Cinta teflón 3/4\" x 10m","marca":"Fast","categoria":"Gasfitería","subcategoria":"Accesorios PVC","unidad":"Und","uso":"Sellado de roscas en gasfitería","precio":2.5,"stock":118}]
```

### `GET /api/productos/{sku}`
Devuelve un `ProductoResponse`. Si no existe: `404 {"detail":"Producto no encontrado"}`.

### `GET /api/categorias`
```json
[{"categoria":"Construcción y Estructuras","subcategorias":["Cementos y Aditivos","Fierros y Aceros"]}]
```

### `POST /api/buscar-necesidad`
```json
// petición
{"texto":"tengo una gotera en el techo","k":4}
// respuesta
[{"sku":"CON-004","nombre":"Impermeabilizante Sika 1 5kg","precio":52,"stock":14,"puntaje":0.4091,"terminos":["impermeabilizante","sika"],"fuente":"CONTENIDO","posicion":1, "...": "..."}]
```
`k` vale 12 por defecto.

### `GET /api/recomendar?sku=PIN-001&k=5`
Devuelve `ProductoPuntuado[]`. `k` toma por defecto `configuracion.k`, y el modo sale de la sesión o de `modo_activo`.
Si el SKU no existe responde 404, y si falta `sku`, 422 con `loc: ["query","sku"]`.
```json
[{"sku":"PIN-007","nombre":"Imprimante para paredes 1 galón","puntaje":0.4472,"fuente":"REORDENADOR","posicion":1, "...": "..."}]
```

### `POST /api/recomendar/carrito`
```json
{"skus":["TUB-001","ACC-001"],"k":5}
```
Devuelve `ProductoPuntuado[]` y nunca incluye productos del carrito ni productos sin stock.

### `GET /api/recomendar/cliente/{codigo}?skus=PIN-001&skus=FER-003&k=5`
```json
{"base":"SIN_HISTORIAL","resultados":[ "ProductoPuntuado…" ]}
```
El contexto es historial del cliente ∪ carrito. El historial solo se usa si llega el `x-sesion-evaluacion` de la
sesión activa **de ese mismo cliente**, y en ese caso `base` es `"HISTORIAL_Y_CARRITO"`. La respuesta nunca incluye
el historial.

### `GET /api/sesiones/activa`
Con el token de la sesión activa:
```json
{"id_sesion":"SES-0001","codigo_cliente":"CLI-0007","escenario":"Pintar una habitación","condicion":"CONV","orden":"A","inicio":"2026-10-27T00:52:42.480Z"}
```
Sin token, o con un token inválido, responde el literal `null`.

### `POST /api/eventos`
```json
// petición
{"id_sesion":"SES-0001","codigo_cliente":"CLI-0007","escenario":null,"condicion":"CONV","tipo_evento":"RECOM_MOSTRADA","texto_consulta":null,"sku":"PIN-007","posicion_recom":1,"origen":"RECOMENDACION","timestamp":1793062363774}
// respuesta
{"status":"ok","id_evento":123}
```
- `tipo_evento` sigue el formato `MAYÚSCULAS_CON_GUIONES`. Los usados son `INICIO_BUSQUEDA`, `CONSULTA`,
  `RECOM_MOSTRADA`, `VER_DETALLE`, `CLIC_RECOMENDACION`, `PRODUCTO_AGREGADO` y `PRODUCTO_RETIRADO`.
- `CONFIRMACION_CARRITO` lo registra el servidor.
- `timestamp` se expresa en milisegundos.

### `POST /api/carrito/confirmar`
```json
// petición
{"id_sesion":"SES-0001","codigo_cliente":"CLI-0007","condicion":"CONV","timestamp":1793062363774,
 "items":[{"sku":"PIN-001","cantidad":1,"precio":48,"origen":"BUSQUEDA"},{"sku":"PIN-007","cantidad":2,"precio":34,"origen":"RECOMENDACION"}],
 "total":116,"entrega":"Recojo en tienda","pago":"Yape"}
// respuesta
{"id_pedido":1,"total":116,"estado":"Registrado","fecha":"2026-10-27T00:52:43.769Z","timestamp_confirmacion":1793062363774,
 "entrega":"Recojo en tienda","pago":"Yape","items":[{"sku":"PIN-001","nombre":"Pintura látex blanca 1 galón","cantidad":1,"precio":48,"subtotal":48,"origen":"BUSQUEDA"}]}
```
- Se **ignoran** `precio` y `total` del cliente: el total se recalcula con el catálogo.
- En una sola transacción se valida el stock, se descuenta, se crea el pedido, se registra
  `CONFIRMACION_CARRITO` con la hora del servidor y la sesión se marca como completa.
- **Errores:**
  - `400` con el carrito vacío
  - `404` si el producto no existe
  - `409 "Stock insuficiente para …"`; en ese caso no se descuenta nada

## Administración

### `POST /api/admin/login`
Petición `{"username":"admin","password":"…"}`. Responde `200 {"token":"…"}` con `Set-Cookie: ferremax_admin=…`,
o `401 {"detail":"Usuario o contraseña incorrectos"}`.

### `POST /api/admin/logout`
Borra la cookie: `{"status":"ok"}`. Es una ruta nueva respecto de v1.

### `GET /api/admin/verificar`
```json
{"valido":true,"username":"admin"}
```

### `GET /api/admin/config`
- **Público:** `{"k":5,"fuente_datos":"sintetico"}`. No revela la condición experimental.
- **Con sesión de admin:**
```json
{"id":1,"modo_activo":"ML","k":5,"soporte_min":0.01,"confianza_min":0.15,"lift_min":1.2,"peso_contenido":1,"variante_ml":"COMPLETO","fuente_datos":"sintetico",
 "reordenador":{"tipo":"lightgbm","version":"20261027003724","n_boletas":5000,"n_ejemplos":235024,"n_positivos":10509,"cobertura_candidatos":0.9219,"ap_validacion":{"regresion_logistica":0.3337,"lightgbm":0.4158}, "...": "..."}}
```

### `PUT /api/admin/config`
```json
{"modo_activo":"ML","k":5,"soporte_min":0.01,"confianza_min":0.15,"lift_min":1.2,"peso_contenido":1.0,"variante_ml":"COMPLETO"}
```
Rangos válidos:
- `k`: 1–20
- `soporte_min`: 0,001–1
- `confianza_min`: 0–1
- `lift_min`: 0–100
- `peso_contenido`: 0–5
- `variante_ml`: `COMPLETO` o `REGLAS`

Responde la configuración completa y pide al recommender recargarla.

### `GET /api/admin/reglas?vigentes=true`
Reglas del modelo vigente, ordenadas por confianza × lift. `vigentes=true` aplica además los umbrales actuales.
```json
[{"id":1,"antecedentes":"[\"ACC-004\",\"TUB-004\"]","consecuentes":"[\"ACC-003\"]","soporte":0.0132,"confianza":0.7857,"lift":18.797,"version_modelo":"20261027003724"}]
```

### `POST /api/admin/modelo/reentrenar`
```json
{"status":"ok","message":"Modelo 20261027003724 entrenado con 5000 comprobantes: 280 reglas; AP de validación LightGBM 0.4158 vs regresión logística 0.3337.","comprobantes":5000,"reglas":280,"artefacto":"storage://modelos/reordenador-….joblib","reordenador":{"…":"…"}}
```
Responde `409` si ya hay un entrenamiento en curso y `502` si el recommender no responde.

### `GET /api/admin/sesiones`
Lista de sesiones, de la más reciente a la más antigua (nunca incluye el token):
```json
[{"id_sesion":"SES-0001","codigo_cliente":"CLI-0007","escenario":"Pintar una habitación","condicion":"CONV","orden":"A","inicio":"…","fin":"…","valida":true,"completa":true}]
```

### `POST /api/admin/sesiones`
```json
// petición
{"codigo_cliente":"CLI-0007","escenario":"Pintar una habitación","condicion":"CONV","orden":"A"}
// respuesta
{"sesion":{"id_sesion":"SES-0001","…":"…"},"token_dispositivo":"1Qew…"}
```
Fija `modo_activo` en la condición de la sesión. Si ya hay una sesión activa responde `409`.

### `PUT /api/admin/sesiones`
Petición `{"id_sesion":"SES-0001","valida":true}`. Finaliza la sesión: registra `fin` y `valida`, y calcula
`completa` según si hubo pedido.

### `GET /api/admin/eventos?id_sesion=&codigo_cliente=&condicion=&tipo_evento=&limite=5000`
Más recientes primero:
```json
[{"id_evento":9,"id_sesion":"SES-0001","codigo_cliente":"CLI-0007","escenario":"…","condicion":"CONV","tipo_evento":"CONFIRMACION_CARRITO","texto_consulta":null,"sku":null,"posicion_recom":null,"origen":null,"timestamp":1793062363774}]
```

### `GET /api/admin/indicadores`
Capa 2 del experimento. Se calcula con las sesiones válidas y completas.
```json
{"agregados":{"CONV":{"tiempo_seleccion_s":{"n":1,"media":42.86,"mediana":42.86,"de":0,"min":42.86,"max":42.86},
                      "precision_5":{"n":1,"media":0.2,"…":"…"},"recs_aceptadas":{"…":"…"},
                      "sesiones_validas_completas":1,"sesiones_registradas":1},"ML":{"…":"…"}},
 "por_sesion":{"CONV":[{"id_sesion":"SES-0001","tiempo_s":42.86,"listas_mostradas":1,"recs_mostradas":5,"recs_aceptadas":1,"precision_5":0.2,"acierto":true,"…":"…"}],"ML":[]},
 "mcnemar_exacto":{"CONV_vs_ML":{"n_pares":0,"ambos":0,"solo_primero":0,"solo_segundo":0,"ninguno":0,"p_valor":1}},
 "definiciones":{"…":"…"}}
```
Definiciones:
- **Lista:** eventos `RECOM_MOSTRADA` con el mismo `timestamp`.
- **P@5 de la sesión:** media por lista de |top-5 ∩ productos recomendados comprados| / 5.
- **Tiempo de selección:** desde `INICIO_BUSQUEDA` hasta `CONFIRMACION_CARRITO`.
- **McNemar:** pareado por participante. Hay acierto si aceptó al menos una recomendación.
- **Desviación estándar:** muestral.

### `GET /api/admin/dashboard`
```json
{"pedidos":[{"id":1,"fecha":"…","codigo_cliente":"CLI-0007","id_sesion":"SES-0001","condicion":"CONV","entrega":"Recojo en tienda","pago":"Yape","estado":"Registrado","total":116}],
 "clientes":[{"codigo":"CLI-0007","tipo":"Histórico","primera_compra":"…","participa_evaluacion":true,"n_boletas":12}],
 "productos_bajo_stock":[{"sku":"CON-001","nombre":"Cemento Sol Tipo I 42.5kg","stock":0}]}
```

### `GET /api/admin/evaluacion-offline` · `POST /api/admin/evaluacion-offline`
- **GET:** última corrida guardada, o `null` si nunca se corrió.
- **POST:** corre la evaluación (unos 12 s) y devuelve el resultado, con la forma descrita en
  `docs/recomendador.md` §5: `modos`, `por_modo.{M}.precision5|recall5` y `mcnemar_exacto`.
