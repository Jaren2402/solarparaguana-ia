# error_solutions.md

Registro de errores y parches aplicados.

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