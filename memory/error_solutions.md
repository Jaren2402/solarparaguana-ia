# error_solutions.md

Registro de errores y parches aplicados.

## 2026-11-22 — Atlas no conectaba desde la PC pero sí desde Railway

- **Síntoma:** `mongoose.connect` fallaba con "Could not connect to any servers in your MongoDB Atlas cluster... IP isn't whitelisted", aunque `0.0.0.0/0` estaba activo y la IP pública coincidía.
- **Diagnóstico:** DNS SRV resuelve los 3 nodos y la IP es correcta, pero `Test-NetConnection` al puerto 27017 daba `False`. El bloqueo era de la red local/ISP, no de Atlas.
- **Solución:** no cambiar Atlas; verificar la conexión desde Railway, que sale por otra red. Confirmado: `/api/inventory` devolvió 16 equipos leídos desde Atlas.
- **Prevención:** antes de responsabilizar a la whitelist, probar DNS SRV y puerto 27017; si el puerto está bloqueado, usar el despliegue para validar.

## 2026-11-22 — Pre-Deploy Command de Railway no se persistió

- **Síntoma:** el inventario quedaba vacío (200 con `items: []`) aunque el campo "Pre-deploy Command" parecía configurado. Al recargar Settings, los campos de Build/Start/Pre-deploy/Healthcheck volvían a mostrar el texto de "agregar".
- **Causa:** los cambios escritos por script en esos campos no eran registrados por el estado del formulario de Railway; el banner "Apply N changes" no los incluía. El root directory sí se guardó.
- **Solución:** cargar el inventario al arrancar en producción desde `index.js` con `seedInventory({ disconnect: false })`, y hacer que el seeder reutilice la conexión Mongoose existente (`readyState === 1`) y no la cierre. Idempotente por `sku`.
- **Verificación:** tras el push, `/api/inventory` devolvió 16 equipos y `/api/solar/quote` devolvió 3865 USD.
- **Prevención:** para ajustes en UI de Railway, confirmar el valor después de recargar la página; si no persiste, mover la lógica al código de la app.

## 2026-11-22 — Rutas del microservicio Telegram se colgaban

- **Síntoma:** `GET /microservices/telegram/health` y `GET /microservices/telegram/mcp/tools` nunca respondían (timeout / `ECONNRESET`). El resto de `/api` funcionaba normal.
- **Causa:** `solar_mcp.service.js` exporta por defecto la fábrica `createTelegramRouter`, no una instancia de `Router`. En `bin/server.js` se montó la función directamente con `app.use('/microservices/telegram', telegramRoutes)`. Express la invocaba como middleware, la función creaba un router nuevo y nunca llamaba a `next()`, dejando la petición pendiente para siempre. En cambio, `solar.routes.js` sí exporta un `Router` y por eso `/api` funcionaba.
- **Solución:** importar la fábrica con su nombre real y **invocarla** al montarla:
  `import createTelegramRouter, { startTelegramPolling } from '../microservices/solar_mcp.service.js';`
  `this.app.use('/microservices/telegram', createTelegramRouter());`
- **Verificación:** tras el parche, `/health` debe devolver `200` con `status: "degraded"` cuando no hay `TELEGRAM_BOT_TOKEN`, y `/mcp/tools` debe devolver `200` con el catálogo de herramientas.
- **Prevención:** al montar un módulo nuevo, comprobar si el `export default` es una instancia de `Router` o una fábrica; si es fábrica, siempre invocarla con `()`.

## 2026-11-22 — Fallback SPA devolvía ENOENT en rutas API

- **Síntoma:** cualquier ruta inexistente (por ejemplo `/api/ruta-inexistente`) caía en `res.sendFile(public/index.html)`. Como el frontend aún no está compilado, Express registraba `ENOENT ... public\index.html` y devolvía una página HTML de error, poco útil para una API.
- **Causa:** el fallback `app.get('/*path', ...)` asumía que el estático del frontend siempre existía y no distinguía peticiones de API.
- **Solución:** en `bin/server.js`, dentro de `publics()`, responder `404` JSON con `code: RUTA_NO_ENCONTRADA` para rutas que empiecen por `/api` o `/microservices`, y `404` JSON con `code: FRONTEND_NO_DISPONIBLE` cuando no exista `public/index.html`. Se importó `fs` para comprobar la existencia del archivo antes de `sendFile`.
- **Verificación:** rutas API inexistentes devuelven JSON legible y el log del servidor ya no registra `ENOENT`.
- **Nota:** cuando se compile Angular en Sprint 2, el mismo fallback servirá `index.html` sin cambios.

## 2026-11-22 — OCR con imagen fallaba por `__dirname` en ESM

- **Síntoma:** `POST /api/solar/ocr-parse` **con imagen** devolvía un HTML 500 con
  `ReferenceError: __dirname is not defined`. Sin imagen sí respondía el `400`
  legible de `ARCHIVO_REQUERIDO`, por eso el fallo pasó desapercibido en las
  pruebas iniciales.
- **Causa:** `api/solar/calculator.controller.js` es un módulo ESM y usaba
  `__dirname` para construir la ruta `uploads/images`. En ESM esa variable global
  no existe (solo en CommonJS).
- **Solución:** importar `fileURLToPath` de `url` y definir
  `const __dirname = path.dirname(fileURLToPath(import.meta.url));`.
- **Verificación:** el smoke test sube una imagen fixture y espera `201` con el
  borrador en `pendiente_confirmacion`; luego confirma y calcula con `origen: OCR`.
- **Prevención:** en archivos ESM usar siempre `import.meta.url` para rutas.
  `node --check` valida sintaxis, pero **no detecta** variables no definidas que
  solo se evalúan en tiempo de ejecución: por eso es necesario ejercitar también
  el camino con datos reales (subir una imagen, no solo omitirla).

## 2026-11-24 — Auditoría previa a la entrega: confirmación OCR y herramienta MCP

- **Síntoma 1:** `POST /api/solar/ocr-confirm` con `confirmado: false` devolvía
  `200` y marcaba el borrador como `confirmado`, violando `api_contracts.md`
  (exige `422`). El smoke test no lo detectaba porque omitía ese campo.
- **Causa 1:** `confirmarOCR` validaba los campos numéricos pero nunca leía
  `req.body.confirmado`.
- **Solución 1:** rechazar explícitamente `confirmado === false` con
  `422 OCR_NO_CONFIRMADO` antes de cambiar el estado del borrador. El smoke test
  ahora envía `confirmado: true` y se añadió `verificar-correcciones.mjs`.
- **Síntoma 2:** `POST /microservices/telegram/mcp/tools/calcular` devolvía
  `resultado: null` y el texto de ayuda aunque recibiera `argumentos.equipos`.
- **Causa 2:** la herramienta solo pasaba `args.texto` a `procesarSolicitud`.
- **Solución 2:** delegar a `calcularDimensionamiento` cuando llegan `ocrId`,
  `equipos` o `consumoMensualKWh`, y conservar el texto como último recurso.
  El `inputSchema` de `calcular` ahora declara esos argumentos.
- **Adicional:** `traceId` se añadió a los errores del fallback 404 y del
  microservicio mediante `responderErrorLegible`, que antes solo estaba en el
  controlador solar.
- **Verificación:** local `15/15` en el smoke test y `2/2` en
  `verificar-correcciones.mjs`. Evidencia en `evidence/`.
- **Prevención:** cuando el contrato defina un campo de intención (como
  `confirmado`), probar explícitamente el valor negativo; y verificar cada
  herramienta MCP con los argumentos de su `inputSchema`, no solo con texto.