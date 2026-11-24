# Documento principal del proyecto

> SolarParaguana IA - Plataforma de diagnóstico, dimensionamiento y cotización fotovoltaica

**Proyecto:** SolarParaguana IA  
**Fecha:** 22 de noviembre de 2026

---

# 1. Resumen ejecutivo

SolarParaguana IA es una plataforma de diagnóstico, dimensionamiento y cotización de soluciones fotovoltaicas para Coro y la Península de Paraguaná, estado Falcón, Venezuela. El sistema convierte datos reales de consumo -ingresados manualmente o extraídos de una factura mediante OCR- en una recomendación técnica auditable: consumo diario, número de paneles, capacidad del inversor en kVA y banco de baterías, además de un presupuesto calculado con inventario disponible en Coro y Punto Fijo.

El proyecto se desarrolla por entregas incrementales. Este documento resume la identidad, el problema, los objetivos, el público, la solución y el estado actual del primer avance, que corresponde al backend. El backend ya se encuentra desplegado en Railway; quedan para entregas posteriores el frontend web y la aplicación móvil.

# 2. Identidad y alcance

| Campo | Definición |
| --- | --- |
| Nombre oficial | SolarParaguana IA |
| Propósito | Convertir datos reales de consumo en una recomendación técnica clara, trazable y cotizable |
| Ámbito geográfico | Coro y Península de Paraguaná, estado Falcón (Venezuela) |
| Estado actual | Sprint 1 completado: backend funcional y verificado |
| Repositorio | https://github.com/Jaren2402/solarparaguana-ia |

# 3. Problema central

La región presenta fluctuaciones eléctricas constantes que ponen en riesgo equipos electrónicos y productivos. A ello se suma el desconocimiento de la capacidad exacta en kVA requerida para inversores, baterías y paneles. Como consecuencia aparecen los siguientes problemas:

- Sobredimensionamiento, con costos innecesarios, o subdimensionamiento, con fallas de suministro.
- Cotizaciones imprecisas y pérdida de confianza del cliente.
- Tiempos largos de análisis manual de facturas y etiquetas de consumo.
- Dificultad para ofrecer atención inmediata a técnicos y clientes finales.

# 4. Objetivos

## 4.1 Objetivo general

Implementar un sistema que automatice el dimensionamiento y la cotización de sistemas solares con base en consumo real, stock local y reglas técnicas explícitas, reduciendo el tiempo de respuesta y mejorando la trazabilidad de cada recomendación.

## 4.2 Objetivos específicos

- Definir un motor de cálculo determinista y auditable con constantes de la región.
- Extraer datos de facturas y etiquetas mediante OCR con confirmación obligatoria.
- Cotizar únicamente con equipos disponibles en Coro y Punto Fijo, en USD.
- Exponer un conector conversacional de Telegram que reutilice la misma lógica.
- Manejar fallos de MongoDB y de Telegram sin detener el servidor.

# 5. Público objetivo

| Segmento | Perfil | Necesidad principal |
| --- | --- | --- |
| Comerciantes PYME | Tiendas, minimercados, talleres | Reducir costos eléctricos y proteger equipos |
| Posadas | Hoteles, hostales, alojamientos | Continuidad ante apagones y fluctuaciones |
| Familias | Hogares de la Península | Dimensionar un sistema seguro y económico |
| Técnicos instaladores | Instaladores y empresas locales | Calcular y cotizar con rapidez |

# 6. Solución propuesta

La solución se organiza en cinco capacidades que comparten un mismo núcleo de cálculo:

- Motor de cálculo: aplica HSP 6.0, eficiencia 0.80, factor de inversor 1.25 y factor de potencia 0.90.
- OCR con confirmación humana: ningún dato extraído alimenta el cálculo sin revisión y confirmación previa.
- Cotizador local: selecciona paneles, inversores y baterías con stock mayor que cero en Coro o Punto Fijo.
- Conector MCP/Telegram: permite calcular y cotizar desde el chat sin HTTP interno.
- Errores legibles: toda falla devuelve código, mensaje, sugerencia y trazador.

# 7. Alcance del primer avance

El primer avance cubre la Fase 0 y los prompts 1.1 a 1.3.1 del Manual Maestro. No incluye el frontend Angular (prompt 2.1) ni la aplicación móvil, que se diferirán a entregas siguientes.

| Componente | Estado |
| --- | --- |
| Estructura y contexto del proyecto | Completado |
| Cálculo y dimensionamiento | Completado |
| OCR y confirmación | Completado |
| Cotización con stock local | Completado |
| Inventario sembrado en MongoDB | Completado |
| Conector MCP / Telegram | Completado |
| Frontend Angular | Pendiente para el siguiente avance |
| Aplicación móvil Kotlin | Pendiente para entregas posteriores |

# 8. Resultados verificados

La evidencia se generó con un script de prueba automatizado que inicia el servidor si es necesario, ejecuta 15 casos y guarda cada respuesta. Resultado: 15 de 15 pruebas correctas.

| Prueba | Resultado |
| --- | --- |
| Cálculo manual | 12,3 kWh/dia; 5 paneles de 550 W; inversor 5 kVA |
| Cotización | USD 3.865 con 3 items de stock real |
| OCR | Subida, confirmación y cálculo con origen OCR correctos |
| Inventario | 16 equipos: 10 en Coro y 6 en Punto Fijo |
| Telegram | health degraded sin token, servidor activo |
| Manejo de errores | 400, 404 y 422 con mensajes legibles |

# 9. Stack tecnológico

| Capa | Tecnología |
| --- | --- |
| Backend | Node.js 26 (ESM), Express 5, Socket.IO |
| Datos | MongoDB con Mongoose |
| Archivos | express-fileupload en /uploads |
| Procesos | PM2 mediante ecosystem.config.cjs |
| Frontend previsto | Angular 22 standalone con Signals |
| Móvil previsto | Kotlin nativo con MVVM y Retrofit |

# 10. Limitaciones y trabajo futuro

- Los borradores OCR y los cálculos se guardan en memoria: se pierden al reiniciar el servidor.
- El frontend aun no está compilado; la raíz del servidor responde JSON de frontend no disponible.
- El backend ya se encuentra desplegado en Railway y verificado con MongoDB Atlas; la operación continua queda para el siguiente avance.
- La autenticación JWT esta prevista en el contrato, pero no forma parte de este primer avance.

# 11. Referencias

- context/system_context.md - contexto de negocio.
- context/business_rules.md - reglas funcionales y fórmulas.
- context/api_contracts.md - contratos de API.
- memory/architecture_decisions.md - decisiones de diseño.
- memory/error_solutions.md - incidencias resueltas.
