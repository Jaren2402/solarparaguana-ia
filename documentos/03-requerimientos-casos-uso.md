# Requerimientos y casos de uso

> Especificación funcional del backend de SolarParaguana IA

**Proyecto:** SolarParaguana IA  
**Fecha:** 22 de noviembre de 2026

---

# 1. Propósito

Este documento detalla los requisitos funcionales y no funcionales del backend, los actores que interactuan con el sistema y los casos de uso que cubren el flujo completo: entrada de consumo, cálculo, cotización y atención por Telegram.

# 2. Requisitos funcionales

| ID | Requisito | Prioridad | Estado |
| --- | --- | --- | --- |
| RF-01 | Calcular consumo diario a partir de una lista de equipos | Alta | Implementado |
| RF-02 | Calcular consumo diario a partir de factura mensual | Alta | Implementado |
| RF-03 | Dimensionar paneles, inversor en kVA y banco de baterías | Alta | Implementado |
| RF-04 | Subir imagen de factura o etiqueta y extraer campos OCR | Alta | Implementado |
| RF-05 | Permitir confirmar o corregir los campos extraídos | Alta | Implementado |
| RF-06 | Rechazar cálculos con OCR sin confirmar | Alta | Implementado |
| RF-07 | Consultar inventario de Coro y Punto Fijo | Alta | Implementado |
| RF-08 | Emitir cotización con stock disponible en USD | Alta | Implementado |
| RF-09 | Ofrecer alias /api/solar/calculate del Manual Maestro | Media | Implementado |
| RF-10 | Exponer herramientas MCP y webhook de Telegram | Media | Implementado |

# 3. Requisitos no funcionales

| ID | Requisito | Verificación |
| --- | --- | --- |
| RNF-01 | El servidor debe arrancar aunque falte MongoDB | Probado: cálculo disponible, presupuesto pendiente |
| RNF-02 | El servidor debe arrancar aunque falte el token de Telegram | Probado: health degraded |
| RNF-03 | Los errores deben ser legibles y sugerir una corrección | Probado en 400, 404 y 422 |
| RNF-04 | El seeder no debe duplicar datos al repetirse | Probado: upsert por sku |
| RNF-05 | El código debe pasar node --check | Probado: 10 archivos JS sin fallos |
| RNF-06 | No se debe versionar .env ni node_modules | Verificado en el repositorio remoto |

# 4. Actores

| Actor | Descripción | Canal |
| --- | --- | --- |
| Cliente final | Usuario que desea conocer su sistema solar | Web, móvil, Telegram |
| Técnico instalador | Profesional que calcula y emite cotizaciones | Web, Telegram |
| Administrador | Gestiona inventario y constantes técnicas | Web |
| Sistema externo | Consume la API o las herramientas MCP | API, MCP |

# 5. Casos de uso

## CU-01 Calcular con equipos manuales

Actor: técnico o cliente. Precondición: servidor disponible.

- El usuario indica origen MANUAL y una lista de equipos con potencia, horas y voltaje.
- El sistema valida rangos y calcula consumo, generación, paneles, inversor y batería.
- El sistema devuelve el id del cálculo y el bloque calculation auditable.
- Postcondicion: el cálculo queda disponible en memoria para cotizar.

## CU-02 Extraer y confirmar datos con OCR

Actor: cliente o técnico. Precondición: imagen JPEG, PNG o WebP de hasta 10 MB.

- El usuario sube la imagen y, si aplica, texto auxiliar de la etiqueta.
- El sistema guarda la imagen y devuelve un borrador con campos y confianza.
- El usuario corrige y confirma potencia, horas y voltaje.
- El sistema marca el borrador como confirmado.
- Excepción: si intenta calcular antes de confirmar, responde 422.

## CU-03 Cotizar con inventario local

Actor: técnico. Precondición: cálculo existente y MongoDB conectado.

- El usuario envia el calculoId.
- El sistema selecciona equipos con stock mayor que cero en Coro o Punto Fijo.
- El sistema calcula subtotales y presupuesto en USD.
- Excepción: sin stock responde 409 SIN_STOCK_LOCAL; con monedas distintas, 409 MONEDA_MIXTA.

## CU-04 Consultar inventario

Actor: técnico o sistema externo. Precondición: MongoDB conectado.

- El usuario solicita GET /api/inventory.
- El sistema devuelve almacenes y la lista de equipos vigentes.
- Postcondicion: se puede verificar disponibilidad antes de cotizar.

## CU-05 Interactuar por Telegram / MCP

Actor: cliente o técnico. Precondición: token de Telegram configurado para el bot; no necesario para las rutas MCP.

- El usuario envia una descripción de sus equipos o consulta una herramienta.
- El sistema reutiliza cálculo y cotización sin realizar HTTP interno.
- Si no hay token, health indica degraded y el servidor continua activo.

# 6. Reglas de negocio críticas

- Ningun dato del OCR se usa sin confirmación explícita.
- Solo se cotizan equipos vigentes con stock disponible en Coro o Punto Fijo.
- El inversor se expresa en kVA usando FP 0.90 por defecto.
- El DoD máximo es 0.80 para litio y 0.50 para Gel/AGM.
- No se mezclan monedas en un mismo presupuesto.

# 7. Trazabilidad requisito - endpoint

| Requisito | Endpoint |
| --- | --- |
| RF-01, RF-02, RF-03 | POST /api/energy/calculate y /api/solar/calculate |
| RF-04 | POST /api/solar/ocr-parse |
| RF-05 | POST /api/solar/ocr-confirm |
| RF-06 | Validación interna del cálculo con origen OCR |
| RF-07 | GET /api/inventory |
| RF-08 | POST /api/solar/quote |
| RF-10 | GET /microservices/telegram/* |

# 8. Criterios de aceptación

- Los 15 casos del smoke test deben devolver el estado esperado.
- El bloque calculation debe estar presente en las dos rutas de cálculo.
- La cotización del caso de prueba debe ser USD 3.865.
- El repositorio no debe contener .env ni node_modules.
