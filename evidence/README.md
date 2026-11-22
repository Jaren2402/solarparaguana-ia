# Evidencia de pruebas del backend

Esta carpeta contiene la evidencia generada por `scripts/smoke-test.mjs` contra el backend de SolarParaguaná IA.

## Cómo regenerarla

Desde la raíz del repositorio:

```powershell
node projects\backend\scripts\smoke-test.mjs
```

El script:

1. Detecta si el servidor ya está arriba en el puerto `18512`.
2. Si no lo está, inicia `node index.js` y lo detiene al terminar.
3. Ejecuta 15 casos de prueba.
4. Guarda cada respuesta completa en `respuestas/`.
5. Escribe el resumen en `smoke-test-result.txt`.

También hay una colección de Postman importable en [`postman/SolarParaguana.postman_collection.json`](../postman/SolarParaguana.postman_collection.json). Abre Postman → *Import* → selecciona ese archivo. La variable `baseUrl` apunta a `http://127.0.0.1:18512` y puede cambiarse por la URL desplegada.

## Resultado de la última ejecución

**15/15 pruebas correctas** — ver [`smoke-test-result.txt`](smoke-test-result.txt).

| # | Prueba | Ruta | Estado | Dato verificado |
|---|---|---|---|---|
| 01 | Constantes | `GET /api/energy/constants` | 200 | HSP 6.0, eficiencia 0.80 |
| 02 | Inventario | `GET /api/inventory` | 200 | 16 ítems, Coro y Punto Fijo |
| 03 | Cálculo manual | `POST /api/energy/calculate` | 200 | 12,3 kWh/día, 5 paneles, inversor 5 kVA |
| 04 | Alias del cálculo | `POST /api/solar/calculate` | 200 | `status: ok`, batería 400,391 Ah |
| 05 | Cotización | `POST /api/solar/quote` | 201 | USD 3.865, 3 ítems |
| 06 | Cálculo desde factura | `POST /api/energy/calculate` | 200 | método `factura`, 10 kWh/día |
| 07 | OCR subir imagen | `POST /api/solar/ocr-parse` | 201 | borrador `pendiente_confirmacion`, 3 campos |
| 08 | OCR confirmar | `POST /api/solar/ocr-confirm` | 200 | estado `confirmado`, 150 W |
| 09 | Cálculo desde OCR | `POST /api/energy/calculate` | 200 | `auditoria.origen = OCR` |
| 10 | Error OCR sin imagen | `POST /api/solar/ocr-parse` | 400 | `ARCHIVO_REQUERIDO` |
| 11 | Salud del bot | `GET /microservices/telegram/health` | 200 | `degraded` (sin token) |
| 12 | Catálogo MCP | `GET /microservices/telegram/mcp/tools` | 200 | 5 herramientas |
| 13 | Ejecutar herramienta MCP | `POST /microservices/telegram/mcp/tools/consultar_stock` | 200 | herramienta respondida |
| 14 | Webhook Telegram | `POST /microservices/telegram/webhook` | 200 | `ok: true` |
| 15 | Ruta inexistente | `GET /api/ruta-inexistente` | 404 | `RUTA_NO_ENCONTRADA` |

## Archivos

- `smoke-test-result.txt` — resumen legible con fecha, base URL y resultado de cada caso.
- `respuestas/01-constants.json` … `15-ruta-inexistente.json` — cuerpo completo de cada respuesta.

## Observaciones

- Los identificadores (`calc_…`, `ocr_…`, `cot_…`) y las fechas son generados en cada ejecución, por lo que cambian si vuelves a correr el script.
- La imagen usada en la prueba 07 es un fixture mínimo en `postman/fixtures/etiqueta-ejemplo.png`; el texto simulado se envía en el campo `texto` del `multipart/form-data`.
- Durante esta ejecución se detectó y corrigió un fallo latente: el endpoint de OCR con imagen usaba `__dirname` en un módulo ESM. Quedó registrado en [`memory/error_solutions.md`](../memory/error_solutions.md).
