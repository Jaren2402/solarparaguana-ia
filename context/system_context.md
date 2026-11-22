# SolarParaguaná IA — Contexto del Sistema

> Especificación de contexto de negocio e ingeniería del proyecto.
> Estado: definición inicial. No incluye código fuente.
> Fecha: 2026-11-21.
> Referencia normativa: `AGENTS.md` (Guía Maestra y Estándar de Desarrollo).

## 1. Identidad del proyecto

**Nombre oficial:** SolarParaguaná IA

Plataforma inteligente de diagnóstico, dimensionamiento y cotización de soluciones
fotovoltaicas para la región de Coro y la Península de Paraguaná (Venezuela).
Integra cálculo energético, lectura automática de consumo mediante OCR,
cotización con inventario local y un asistente conversacional de Telegram.

## 2. Público objetivo

| Segmento | Perfil | Necesidad principal |
| --- | --- | --- |
| Comerciantes PYME | Tiendas, minimercados, talleres y negocios de barrio | Reducir costos eléctricos y proteger equipos comerciales |
| Posadas | Pequeños hoteles, hostales y alojamientos turísticos | Garantizar continuidad de servicio ante apagones y fluctuaciones |
| Familias | Hogares residenciales de la Península | Dimensionar un sistema solar seguro y económico para su consumo real |
| Técnicos Instaladores | Instaladores independientes y empresas locales de Coro y Paraguaná | Calcular rápidamente inversores, baterías y paneles, y emitir cotizaciones |

**Ámbito geográfico:** Ciudad de Coro y Península de Paraguaná (estado Falcón).

## 3. Problema central

La región presenta **constantes fluctuaciones eléctricas** que generan riesgo de
daño a equipos electrónicos y productivos. A ello se suma el **desconocimiento de
la capacidad exacta en KVA** requerida para inversores, baterías y paneles, lo
que provoca:

- Sobredimensionamiento (costos innecesarios) o subdimensionamiento (fallas).
- Cotizaciones imprecisas y pérdida de confianza del cliente.
- Tiempos largos de análisis manual de facturas y etiquetas de consumo.
- Dificultad para ofrecer atención inmediata a técnicos y clientes finales.

**Propósito del sistema:** convertir datos reales de consumo en una recomendación
técnica clara, trazable y cotizable, accesible desde la web, el móvil y Telegram.

## 4. Necesidades técnicas

### 4.1 Motor de cálculo energético
Núcleo determinista que, a partir del consumo registrado y de la carga pico,
estima consumo diario, capacidad de inversor y requerimientos de paneles y
baterías. Debe exponer sus resultados de forma auditable (entradas, fórmula
aplicada y resultado) para que el técnico pueda justificar la recomendación.

### 4.2 Procesamiento OCR
Lectura automática de fotografías de **facturas eléctricas** y **etiquetas de
consumo de equipos**, para extraer valores de consumo, voltaje, potencia y
horas de uso. Los archivos se gestionan mediante la estructura `/uploads/`
definida en `AGENTS.md`; el resultado OCR siempre queda sujeto a confirmación
del usuario antes de alimentar el motor de cálculo.

### 4.3 Cotizador con stock local
Generación de propuestas comerciales usando **inventario disponible en la
región** (inversores, paneles, baterías y accesorios). Debe reflejar
disponibilidad real, precios y alternativas, evitando ofrecer equipos sin stock
local.

### 4.4 Bot de Telegram (MCP)
Canal conversacional integrado como conector **MCP** (`/microservices/`) que
permite al usuario enviar una factura o dato de consumo, recibir el cálculo y
solicitar una cotización sin salir de Telegram. Complementa la SPA web y la
aplicación móvil.

## 5. Paleta de colores oficiales

| Uso semántico | Nombre | Código hexadecimal |
| --- | --- | --- |
| Acento principal, energía solar y acciones primarias | Amarillo Solar | `#F59E0B` |
| Alertas, temperatura, sobrecarga y riesgo eléctrico | Naranja Térmico | `#D97706` |
| Red eléctrica, mediciones y estados de conexión | Azul Red | `#0284C7` |
| Eficiencia, ahorro, validación correcta y éxito | Verde Eficiencia | `#10B981` |

Estos colores constituyen la identidad visual oficial y deberán aplicarse de
forma coherente en frontend web, aplicación móvil y mensajes del bot.

## 6. Fórmulas base

### 6.1 Consumo diario

    Consumo Diario (kWh) = (Vatios × Horas) / 1000

Donde `Vatios` es la potencia del equipo o conjunto de equipos y `Horas` el
tiempo diario de operación.

### 6.2 Capacidad del inversor

    Capacidad Inversor (kW) = Carga Pico (kW) × 1.25

El factor `1.25` representa el margen de seguridad sobre la carga pico
simultánea.

> Nota de ingeniería: cuando el usuario solicite expresar la capacidad en **kVA**,
> la conversión desde kW requiere el factor de potencia (`kVA = kW / FP`). El FP
> se capturará como dato de entrada; las dos fórmulas anteriores son la
> referencia obligatoria y cualquier conversión adicional se detallará en
> `context/business_rules.md`.

## 7. Alineación con la arquitectura base (`AGENTS.md`)

- **Backend:** Node.js 26 + ESM, Express 5 y MongoDB/Mongoose; módulos de
  dominio bajo `/api/` para cálculo, OCR y cotizaciones; conector de Telegram
  bajo `/microservices/`.
- **Frontend:** Angular 22+ con componentes standalone, `inject()` y Signals;
  Bootstrap 5.3+ con la paleta oficial de la sección 5.
- **Móvil:** Kotlin nativo (MVVM) con Retrofit/OkHttp; distribución mediante
  `/uploads/apks/` y `version.json`.
- **Contextos complementarios:** `business_rules.md` y `api_contracts.md`
  continuarán siendo la fuente de reglas funcionales y contratos una vez se
  definan los flujos detallados.

## 8. Alcance de este documento

Este archivo define únicamente el contexto del sistema: identidad, público,
problema, necesidades, identidad visual y fórmulas base. No contiene código
fuente, contratos de API ni reglas de negocio operativas.
