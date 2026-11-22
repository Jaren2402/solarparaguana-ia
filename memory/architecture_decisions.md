# architecture_decisions.md

Historial de decisiones de diseño.

## 2026-11-21 — Módulo `api/solar`: OCR y cotización local

- **OCR (POST /api/solar/ocr-parse):** se usa `express-fileupload` (middleware global) y
  extracción por expresiones regulares sobre el texto libre recibido en `texto` o el nombre
  de archivo, sin motor OCR externo. Cada campo devuelve `confianza`, `requiereRevision` y
  el borrador queda en `pendiente_confirmacion`. La confirmación
  (POST /api/solar/ocr-confirm) es obligatoria antes de calcular con `origen: 'OCR'`;
  el cálculo consume `ocrId` y construye el equipo detectado.
- **Cotización (POST /api/solar/quote):** los cálculos se guardan en memoria (`calculoId`)
  y la selección de equipos usa los statics `findDisponibles` y `agruparPorEquipo` del
  modelo `Inventory`, filtrando por Coro/Punto Fijo, capacidad ≥ recomendada y stock > 0.
  Se calcula subtotal por ítem y presupuesto total en una sola moneda; sin stock se
  responde `409 SIN_STOCK_LOCAL` con sugerencia.
- **Entrega de imágenes:** se montó `express.static('/uploads')` antes del fallback SPA
  para que `imagenUrl` sea accesible. Los borradores y cálculos son temporales (Map);
  persistir en MongoDB es un trabajo futuro.

## 2026-11-21 — Microservicio MCP de Telegram y seeder de inventario

- El controlador solar expone ahora funciones puras `calcularDimensionamiento()` y
  `cotizarCalculo()` (además de `SolarError`); los handlers Express son envoltorios
  delgados. Así el bot reutiliza exactamente las mismas fórmulas sin HTTP interno.
- `microservices/solar_mcp.service.js` usa `fetch` directo a la Bot API (sin nueva
  dependencia), long polling opcional y rutas `/microservices/telegram/*` según
  `api_contracts.md`. Sin `TELEGRAM_BOT_TOKEN` el bot se desactiva con `health.degraded`
  y el proceso HTTP sigue arriba. El presupuesto se omite con aviso legible si MongoDB
  no está conectado o falta stock.
- Conversión declarada para BTU: `W_eléctricos = BTU/h ÷ 3.412 ÷ COP 3.0`, redondeado
  a 50 W. Es una estimación orientativa que se explicita en las observaciones del mensaje.
- `seeders/inventory.seeder.js` hace `bulkWrite` con `upsert` por `sku` (campo añadido al
  modelo), por lo que es idempotente. Los inversores se guardan en kVA para compararlos
  directamente con `S_inv = kW / FP`; las baterías de referencia del bot son Felicity
  48 V 100 Ah.
- `bin/server.js` conecta MongoDB de forma no bloqueante y monta el router MCP; un fallo
  de conexión o de Telegram nunca impide que el servidor escuche.

## 2026-11-22 — Cierre del Sprint 1: estructura, contrato y robustez

- **Estructura `AGENTS.md`:** la conexión Mongo se movió a `databases/mongodb.js`, el
  fallback a `middlewares/notFound.js` y el formato de error a
  `helpers/respuestas.js`. `bin/server.js` quedó como orquestador delgado
  (`database()`, `middlewares()`, `routes()`, `publics()`, `listen()`). Se crearon
  `assets/`, `logs/`, `scripts/`, `public/`, `uploads/images` y `uploads/documents`
  con `.gitkeep` para que la estructura sea entrega-compatible.
- **Compatibilidad de contrato:** `POST /api/solar/calculate` es alias de
  `/api/energy/calculate` y la respuesta incluye, sin romper el formato anterior,
  `status: "ok"`, `localQuote: null` y el bloque
  `calculation: { totalKwhDay, recommendedInverterKva, totalPanels, batteryBankAh }`
  exigido por el Manual Maestro (subprompt 0.1.1 / Prompt 4.1 Kotlin).
  `context/api_contracts.md` se alineó con las rutas realmente implementadas.
- **Limpieza de entrega:** se eliminaron `backup.doc` (plantilla Word vacía) y
  `ecosystem.cofig,js` (vacío y mal nombrado), reemplazados por
  `ecosystem.config.cjs`. Se añadió `.gitignore` que excluye `.env` y permite solo
  `.env.example`. Se agregó `npm run seed`. El URI por defecto del seeder se
  corregió a `solarparaguana_ia` para coincidir con el entorno real.
- **PM2:** `ecosystem.config.cjs` usa `name: 'solarparaguana'`, puerto `18512`,
  `fork`, 1 instancia y logs en `logs/`. El despliegue remoto (Sprint 5) sigue
  diferido; esta entrega solo deja la plantilla lista.