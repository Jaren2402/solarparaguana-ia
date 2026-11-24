# Arquitectura y modelo de datos

> Diseño técnico del backend de SolarParaguana IA

**Proyecto:** SolarParaguana IA  
**Fecha:** 22 de noviembre de 2026

---

# 1. Propósito

Este documento describe la organización del backend, la responsabilidad de cada componente, el flujo de datos de extremo a extremo y el modelo de datos del inventario. Sirve como referencia para mantenimiento y para la futura integración con el frontend y la aplicación móvil.

# 2. Vista general por capas

```text
Cliente web / movil / Telegram
        |
  API REST (/api)  +  MCP (/microservices/telegram)
        |
  Controlador solar (calculos, OCR, cotizacion)
        |
  MongoDB (inventario)  +  /uploads (imagenes)
```

bin/server.js actua como orquestador: configura middlewares, monta rutas, sirve estáticos y delega la conexión a bases de datos, el fallback de errores y el formato de respuesta a módulos independientes.

# 3. Componentes del backend

| Archivo | Responsabilidad |
| --- | --- |
| index.js | Punto de entrada; carga dotenv y llama a WebServer |
| bin/server.js | Middlewares, rutas, estáticos y arranque del puerto 18512 |
| api/solar/calculator.controller.js | Cálculo, OCR, cotización y errores tipados |
| api/solar/inventory.model.js | Esquema Inventory y consultas de stock |
| api/solar/solar.routes.js | Rutas REST del dominio solar |
| databases/mongodb.js | Conexión tolerante a fallos |
| middlewares/notFound.js | Fallback JSON para rutas inexistentes |
| helpers/respuestas.js | Formato común de error legible |
| microservices/solar_mcp.service.js | Bot de Telegram y herramientas MCP |
| seeders/inventory.seeder.js | Carga idempotente del inventario |
| scripts/smoke-test.mjs | Pruebas automatizadas y generación de evidencia |

# 4. Flujo de extremo a extremo

- 1. El usuario ingresa equipos o envia una imagen desde web, móvil o Telegram.
- 2. Si hay imagen, el OCR genera un borrador pendiente de confirmación.
- 3. El usuario revisa y confirma los campos extraídos.
- 4. El controlador calcula consumo, generación, paneles, inversor y baterías.
- 5. El cotizador consulta stock vigente en Coro y Punto Fijo.
- 6. La respuesta incluye auditoría, bloque calculation y presupuesto cuando aplica.

# 5. Modelo de datos

La colección inventory es la única fuente de datos persistente del primer avance. Cada documento representa un equipo disponible en un almacen concreto.

| Campo | Tipo | Regla |
| --- | --- | --- |
| sku | String | Único, obligatorio, en mayúsculas; clave del seeder |
| categoria | Enum | panel, inversor, batería o accesorio |
| marca | String | Obligatoria |
| modelo | String | Obligatorio |
| capacidad.valor | Number | Mayor o igual que cero |
| capacidad.unidad | Enum | Wp, kVA, Ah, kWh o und |
| voltajeNominalV | Number | Opcional, valor por defecto nulo |
| precio.monto | Number | Obligatorio, mayor o igual que cero |
| precio.moneda | Enum | USD o VES; por defecto USD |
| stock.almacen | Enum | Coro o Punto Fijo |
| stock.disponible | Number | Entero mayor o igual que cero |
| vigente | Boolean | Por defecto verdadero |

> Los inversores se almacenan en kVA para compararlos directamente con el requerimiento calculado S_inv = kW / FP.

# 6. Contratos de respuesta

## 6.1 Bloque de cálculo

```text
"calculation": {
  "totalKwhDay": 12.3,
  "recommendedInverterKva": 5,
  "totalPanels": 5,
  "batteryBankAh": 400.391
}
```

## 6.2 Bloque de presupuesto

```text
"presupuesto": { "monto": 3865, "moneda": "USD" }
```

Ambos bloques conviven con las claves originales de la respuesta, de modo que no se rompe la compatibilidad con consumidores anteriores.

# 7. Manejo de errores

| Código | HTTP | Situación |
| --- | --- | --- |
| ARCHIVO_REQUERIDO | 400 | Falta la imagen en el OCR |
| FORMATO_NO_SOPORTADO | 415 | La imagen no es JPEG, PNG ni WebP |
| OCR_PENDIENTE_CONFIRMACION | 422 | Cálculo OCR sin confirmar |
| SIN_STOCK_LOCAL | 409 | No hay stock en Coro ni Punto Fijo |
| MONEDA_MIXTA | 409 | Items con monedas distintas |
| RUTA_NO_ENCONTRADA | 404 | Ruta de API inexistente |
| FRONTEND_NO_DISPONIBLE | 404 | Build de Angular aun no copiado |

# 8. Persistencia y estado temporal

- MongoDB guarda el inventario de forma persistente.
- Los borradores OCR y los cálculos viven en Map en memoria del proceso.
- Las imágenes se guardan en /uploads/images y se sirven por express.static.
- Al reiniciar el servidor se pierden borradores y cálculos, pero no el inventario.

# 9. Decisiones de arquitectura

- El bot reutiliza funciones puras del controlador: no llama a la API por HTTP.
- Sin token de Telegram el conector queda degradado, sin tumbar el servidor.
- Sin MongoDB el cálculo sigue funcionando; solo se suspende la cotización.
- El fallback distingue rutas de API de rutas del frontend para devolver siempre JSON util.

# 10. Despliegue

La plantilla ecosystem.config.cjs define una aplicación llamada solarparaguana en modo fork, una sola instancia, puerto 18512 y logs en la carpeta logs. El backend ya se encuentra desplegado en Railway con PORT, MONGO_URI y los tokens de Telegram configurados como variables de entorno; la plantilla PM2 permanece disponible como respaldo.
