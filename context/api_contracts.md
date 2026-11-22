# SolarParaguaná IA — Contratos de API

> Contratos vigentes del backend (Sprint 1). No incluye código fuente.
> Referencias: `AGENTS.md`, `context/system_context.md`, `context/business_rules.md`.
> Las rutas `/api/solar/calculate` y `/api/energy/calculate` son alias del mismo
> controlador; la primera coincide con el Prompt 4.1 del Manual Maestro.

## 1. Convenciones generales

- **Base:** `/api` para el dominio de negocio; `/microservices/telegram` para el
  conector MCP de Telegram.
- **Formato:** `application/json; charset=utf-8`. El endpoint de OCR admite
  además `multipart/form-data` para la imagen.
- **Autenticación:** `Authorization: Bearer <JWT>` en todas las rutas `/api/*`,
  salvo `GET /api/energy/constants`, que es pública.
- **Roles:** `cliente`, `tecnico`, `admin`. La sobreescritura de constantes
  físicas requiere rol `tecnico` o `admin`.
- **Identificadores:** prefijos `calc_`, `ocr_`, `cot_`, `inv_`.
- **Fechas:** ISO 8601 en UTC (`2026-11-21T14:30:00Z`).
- **Montos:** objeto `{ "monto": 180, "moneda": "USD" }`; no se mezclan monedas
  en un mismo total sin conversión explícita.
- **Trazabilidad:** toda respuesta incluye `id` y, en errores, `traceId`.

### 1.1 Resumen de endpoints

| Método | Ruta | Descripción | Auth | Éxito |
| --- | --- | --- | --- | --- |
| `GET` | `/api/energy/constants` | Constantes de Falcón y parámetros por defecto | No | `200` |
| `POST` | `/api/energy/calculate` | Cálculo y dimensionamiento fotovoltaico | Sí | `200` |
| `POST` | `/api/solar/calculate` | Alias del cálculo (Manual Maestro / Kotlin) | Sí | `200` |
| `POST` | `/api/solar/ocr-parse` | Subir imagen y extraer datos (borrador OCR) | Sí | `201` |
| `POST` | `/api/solar/ocr-confirm` | Confirmar o editar campos extraídos | Sí | `200` |
| `GET` | `/api/inventory` | Consultar stock local (Coro / Punto Fijo) | Sí | `200` |
| `POST` | `/api/solar/quote` | Emitir cotización con stock disponible | Sí | `201` |
| `POST` | `/microservices/telegram/webhook` | Recepción de updates de Telegram | Secreto MCP | `200` |
| `GET` | `/microservices/telegram/health` | Estado del conector | No | `200` |
| `GET` | `/microservices/telegram/mcp/tools` | Registro de herramientas MCP | Token de servicio | `200` |
| `POST` | `/microservices/telegram/mcp/tools/:nombre` | Ejecutar herramienta MCP | Token de servicio | `200` |

### 1.2 Formato de error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La potencia indicada no es válida.",
    "suggestion": "Use un valor entre 1 y 10000 vatios.",
    "details": [
      { "field": "equipos[0].potenciaW", "message": "Debe ser mayor que cero." }
    ],
    "traceId": "tr_8f3a1c"
  }
}
```

Los mensajes son legibles para el usuario final e incluyen sugerencia de
corrección, según `AGENTS.md` (sección 7, modo BUILD).

### 1.3 Códigos de estado HTTP

| Código | Uso en SolarParaguaná IA |
| --- | --- |
| `200 OK` | Consultas y cálculos exitosos; confirmación OCR; webhook Telegram |
| `201 Created` | Borrador OCR creado; cotización emitida |
| `400 Bad Request` | JSON malformado, campos ausentes, valores negativos/cero o fuera de rango |
| `401 Unauthorized` | JWT ausente, expirado o inválido |
| `403 Forbidden` | Rol sin permiso para sobreescribir constantes |
| `404 Not Found` | `ocr_`, `calc_` o `cot_` inexistente |
| `409 Conflict` | OCR ya confirmado o cotización sin stock local equivalente |
| `413 Payload Too Large` | Imagen OCR mayor al límite (10 MB propuestos) |
| `415 Unsupported Media Type` | Imagen OCR que no sea JPEG, PNG o WebP |
| `422 Unprocessable Entity` | Cálculo con OCR sin confirmar o campos confirmados incompletos |
| `429 Too Many Requests` | Límite de tasa excedido (JWT o webhook Telegram) |
| `500 Internal Server Error` | Fallo no controlado; siempre con `traceId` |

## 2. Cálculo energético y dimensionamiento

### 2.1 `GET /api/energy/constants`

Respuesta `200`:

```json
{
  "hsp": 6.0,
  "eficienciaGlobal": 0.80,
  "factorSeguridadInversor": 1.25,
  "panelReferenciaWp": 550,
  "parametrosPorDefecto": {
    "factorPotencia": 0.90,
    "autonomiaDias": 1,
    "voltajeBancoV": 48
  }
}
```

### 2.2 `POST /api/energy/calculate`

Cuerpo (se usa `equipos` **o** `consumoMensualKWh`; no ambos):

```json
{
  "origen": "MANUAL",
  "equipos": [
    { "nombre": "Nevera", "potenciaW": 150, "horasDia": 24, "voltajeV": 120 },
    { "nombre": "Aire acondicionado", "potenciaW": 1200, "horasDia": 8, "voltajeV": 120 }
  ],
  "consumoMensualKWh": 300,
  "diasDelMes": 30,
  "cargaPicoKW": 3,
  "factorPotencia": 0.90,
  "autonomiaDias": 1,
  "tecnologiaBateria": "LITIO",
  "voltajeBancoV": 48,
  "bateriaReferencia": { "voltajeV": 12, "capacidadAh": 200 }
}
```

Si `origen = "OCR"` se exige `ocrId` y que ese borrador esté `confirmado`:

```json
{ "origen": "OCR", "ocrId": "ocr_7c2e", "cargaPicoKW": 3 }
```

Respuesta `200`:

```json
{
  "id": "calc_1a9b",
  "estado": "calculado",
  "status": "ok",
  "consumo": { "diarioKWh": 10, "metodo": "equipos" },
  "generacion": { "requeridaKWhDia": 12.5, "potenciaArrayKWp": 2.083 },
  "paneles": { "potenciaUnitariaWp": 550, "cantidad": 4 },
  "inversor": {
    "potenciaNecesariaKW": 3.75,
    "capacidadRequeridaKVA": 4.17,
    "factorPotenciaUsado": 0.90
  },
  "bancoBaterias": {
    "tecnologia": "LITIO",
    "dod": 0.80,
    "energiaRequeridaKWh": 10,
    "energiaNominalKWh": 15.625,
    "capacidadRequeridaAh": 325.5,
    "voltajeBancoV": 48,
    "configuracion": {
      "unidadesSerie": 4,
      "unidadesParalelo": 2,
      "totalUnidades": 8
    }
  },
  "calculation": {
    "totalKwhDay": 10,
    "recommendedInverterKva": 4.17,
    "totalPanels": 4,
    "batteryBankAh": 325.5
  },
  "localQuote": null,
  "auditoria": {
    "origen": "MANUAL",
    "ocrId": null,
    "constantesUsadas": { "hsp": 6.0, "eficienciaGlobal": 0.80, "factorSeguridadInversor": 1.25 },
    "formulas": {
      "consumoDiario": "Σ(P_i × h_i) / 1000",
      "inversorKVA": "kW / FP"
    }
  },
  "siguientePaso": { "cotizable": true, "accion": "POST /api/solar/quote" }
}
```

**Errores propios:** `400` si potencia, horas o voltaje están fuera de los
rangos de `business_rules.md`; `422` con código `OCR_PENDIENTE_CONFIRMACION`
si `origen = "OCR"` y el borrador no está confirmado; `403` si se envían
constantes sobreescritas sin rol `tecnico`.

## 3. Procesamiento OCR

### 3.1 `POST /api/solar/ocr-parse`

`multipart/form-data`: campo `imagen` (también acepta `file` o `image`;
JPEG/PNG/WebP, ≤ 10 MB) y `tipo` (`factura` | `etiqueta`).

Respuesta `201` — siempre en estado `pendiente_confirmacion`:

```json
{
  "id": "ocr_7c2e",
  "estado": "pendiente_confirmacion",
  "imagenUrl": "/uploads/images/ocr_7c2e.jpg",
  "umbralConfianza": 0.85,
  "campos": [
    { "campo": "consumoMensualKWh", "valor": 300, "confianza": 0.92, "requiereRevision": false },
    { "campo": "potenciaW", "valor": 1200, "confianza": 0.71, "requiereRevision": true },
    { "campo": "horasDia", "valor": 8, "confianza": 0.88, "requiereRevision": false },
    { "campo": "voltajeV", "valor": 120, "confianza": 0.95, "requiereRevision": false }
  ]
}
```

> El borrador queda en memoria del proceso durante la sesión; se pierde al
> reiniciar el servidor. La confirmación es obligatoria antes de calcular.

### 3.2 `POST /api/solar/ocr-confirm`

Cuerpo:

```json
{
  "confirmado": true,
  "campos": [
    { "campo": "consumoMensualKWh", "valor": 300 },
    { "campo": "potenciaW", "valor": 1200 },
    { "campo": "horasDia", "valor": 8 },
    { "campo": "voltajeV", "valor": 120 }
  ]
}
```

Respuesta `200`:

```json
{
  "id": "ocr_7c2e",
  "estado": "confirmado",
  "camposConfirmados": {
    "consumoMensualKWh": 300,
    "potenciaW": 1200,
    "horasDia": 8,
    "voltajeV": 120
  },
  "confirmadoEn": "2026-11-21T14:35:00Z"
}
```

**Errores propios:** `422` si `confirmado` es `false` o faltan campos
obligatorios; `409` con código `OCR_YA_CONFIRMADO` si se intenta confirmar dos
veces; `404` si el id no existe; `400/413/415` por validación de imagen.

> Regla crítica: ningún campo con `origen = OCR` puede alimentar
> `POST /api/energy/calculate` mientras el estado sea
> `pendiente_confirmacion`.

## 4. Cotización con inventario local

### 4.1 `GET /api/inventory`

Query params: `almacen` (`Coro` | `Punto Fijo`), `tipo`
(`panel` | `inversor` | `bateria`), `soloDisponible` (`true` por defecto).

Respuesta `200`:

```json
{
  "almacenes": ["Coro", "Punto Fijo"],
  "items": [
    {
      "sku": "PAN-550-001",
      "tipo": "panel",
      "modelo": "Panel monocristalino 550 Wp",
      "potenciaWp": 550,
      "capacidadKVA": null,
      "stock": { "almacen": "Coro", "disponible": 24 },
      "precio": { "monto": 180, "moneda": "USD" },
      "vigente": true
    },
    {
      "sku": "INV-5K-001",
      "tipo": "inversor",
      "modelo": "Inversor 5 kVA onda senoidal pura",
      "potenciaWp": null,
      "capacidadKVA": 5,
      "stock": { "almacen": "Punto Fijo", "disponible": 3 },
      "precio": { "monto": 620, "moneda": "USD" },
      "vigente": true
    }
  ]
}
```

### 4.2 `POST /api/solar/quote`

Cuerpo:

```json
{
  "calculoId": "calc_1a9b"
}
```

El stock se toma de Coro y Punto Fijo; el presupuesto se emite en USD.

Respuesta `201`:

```json
{
  "id": "cot_3d7f",
  "estado": "emitida",
  "calculoId": "calc_1a9b",
  "vigencia": "2026-12-06",
  "almacenes": ["Coro", "Punto Fijo"],
  "items": [
    {
      "tipo": "panel",
      "sku": "PAN-JINKO-550-CORO",
      "marca": "Jinko Solar",
      "modelo": "Tiger Neo N-Type 550 W",
      "capacidad": { "valor": 550, "unidad": "Wp" },
      "cantidad": 4,
      "precioUnitario": { "monto": 165, "moneda": "USD" },
      "subtotal": { "monto": 660, "moneda": "USD" },
      "almacenes": ["Coro", "Punto Fijo"]
    }
  ],
  "presupuesto": { "monto": 660, "moneda": "USD" },
  "cotizable": true,
  "observaciones": []
}
```

**Errores propios:** `404` si `calculoId` no existe; `409` con código
`SIN_STOCK_LOCAL` cuando no hay equivalente con `disponible > 0` en Coro ni en
Punto Fijo; `409` con código `MONEDA_MIXTA` si los ítems seleccionados mezclan
monedas.

> La consulta posterior de cotizaciones (`GET /api/solar/quote/:id`) queda
> pendiente: por ahora la respuesta de `POST` contiene el desglose completo.

## 5. Bot de Telegram (MCP)

### 5.1 `POST /microservices/telegram/webhook`

- Cabecera obligatoria: `X-Telegram-Bot-Api-Secret-Token`.
- Cuerpo: `Update` de Telegram (`message`, `photo`, `callback_query`).
- Respuesta inmediata `200`: `{ "ok": true }`. El procesamiento es asíncrono.
- Error `401` si el secreto no coincide; `429` si excede la tasa.

### 5.2 `GET /microservices/telegram/health`

Respuesta `200`:

```json
{
  "status": "degraded",
  "version": "1.0.0",
  "updatesPendientes": 0,
  "detalle": "Falta TELEGRAM_BOT_TOKEN; el resto del servidor sigue activo."
}
```

Con `TELEGRAM_BOT_TOKEN` configurado, `status` pasa a `ok`.

### 5.3 `GET /microservices/telegram/mcp/tools`

Respuesta `200` con el registro de herramientas: `extraer_ocr`,
`confirmar_ocr`, `calcular`, `cotizar`, `consultar_stock`. Cada entrada incluye
`nombre`, `descripcion` y `inputSchema`.

### 5.4 `POST /microservices/telegram/mcp/tools/:nombre`

Cuerpo genérico:

```json
{
  "chatId": 123456789,
  "usuarioId": "user_22",
  "argumentos": { "ocrId": "ocr_7c2e", "confirmado": true }
}
```

Respuesta `200`:

```json
{
  "herramienta": "confirmar_ocr",
  "resultado": { "id": "ocr_7c2e", "estado": "confirmado" },
  "mensajeTelegram": "Datos confirmados. Ya puedo calcular tu sistema."
}
```

| Herramienta | Argumentos principales | Llama a |
| --- | --- | --- |
| `extraer_ocr` | `fileId`, `tipo` | `POST /api/solar/ocr-parse` |
| `confirmar_ocr` | `ocrId`, `confirmado`, `campos` | `POST /api/solar/ocr-confirm` |
| `calcular` | `ocrId` o `equipos`, `cargaPicoKW` | `POST /api/solar/calculate` |
| `cotizar` | `calculoId` | `POST /api/solar/quote` |
| `consultar_stock` | `almacen`, `tipo` | `GET /api/inventory` |

### 5.5 Flujo conversacional

1. El usuario envía una foto al bot → `webhook` → `extraer_ocr`.
2. El bot responde con el borrador y botones inline **Confirmar / Editar**.
3. El `callback_query` → `confirmar_ocr` (exigencia explícita).
4. `calcular` usa el `ocrId` confirmado y devuelve el resumen del dimensionamiento.
5. `cotizar` consulta inventario de Coro/Punto Fijo y envía la propuesta.
6. Si no hay stock, el bot informa que la propuesta no es cotizable, sin precio.

## 6. Eventos en tiempo real (alcance inicial)

Vía Socket.IO, según `AGENTS.md`: `ocr:actualizado`, `calculo:listo` y
`cotizacion:emitida`. Cada evento se publica enviando el `id` del recurso y su
estado. Su implementación queda pendiente de aprobación.

## 7. Decisiones pendientes de aprobación

- Límite de tamaño de imagen OCR: 10 MB.
- Formatos de imagen: JPEG, PNG, WebP.
- Uso de `vigenciaDias = 15` por defecto.
- Política de rate limit por JWT y por webhook.
- Habilitación de los eventos Socket.IO de la sección 6.
