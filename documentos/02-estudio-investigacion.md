# Estudio e investigación

> Marco teórico, contexto regional y justificación técnica de SolarParaguana IA

**Proyecto:** SolarParaguana IA  
**Fecha:** 22 de noviembre de 2026

---

# 1. Introducción

Este estudio recoge el marco teórico y técnico que sustenta el dimensionamiento realizado por SolarParaguana IA. Su objetivo es explicar de donde provienen las constantes, las fórmulas y las decisiones de diseño implementadas en el backend, de modo que cada resultado pueda ser justificado ante un técnico o un cliente.

# 2. Contexto energético regional

La Península de Paraguaná dispone de un recurso solar abundante, con valores de horas sol pico cercanos a 6.0 al dia. Al mismo tiempo, la red eléctrica presenta fluctuaciones que afectan a equipos comerciales y residenciales. Esta combinación explica la conveniencia de sistemas fotovoltaicos con almacenamiento, no solo de generación.

- La radiación solar disponible permite reducir el tamaño del arreglo frente a regiones con menor HSP.
- La necesidad de continuidad obliga a considerar autonomía y tecnología de batería.
- La carga pico y el arranque de motores determinan el inversor, no solo el consumo total.
- El stock local condiciona la solución: una recomendación técnica debe ser adquirible en la zona.

# 3. Marco teórico fotovoltaico

## 3.1 Constante solar y pérdidas

El cálculo adoptado usa tres constantes fijas para la región. Se mantienen auditables y solo pueden ser sobreescritas por un técnico dentro de rangos seguros.

| Constante | Símbolo | Valor | Uso |
| --- | --- | --- | --- |
| Horas sol pico | HSP | 6.0 | Generación requerida y tamaño del arreglo |
| Eficiencia global | eta | 0.80 | Pérdidas de temperatura, cableado y suciedad |
| Factor de seguridad | k_inv | 1.25 | Margen sobre la carga pico |
| Factor de potencia | FP | 0.90 | Conversión de kW a kVA |
| Autonomía | A | 1 dia | Dimensionamiento de la batería |
| Voltaje de banco | V_banco | 48 V | Capacidad en Ah del banco |

## 3.2 Fórmulas aplicadas

```text
E_d (kWh/dia)  = suma(P_i * h_i) / 1000
E_gen          = E_d / eta
P_array (kWp)  = E_gen / HSP
N_paneles      = ceil(P_array / 0.550)
P_inv (kW)     = P_pico * k_inv
S_inv (kVA)    = P_inv / FP
E_nom (kWh)    = E_d * A / (DoD * eta)
C_banco (Ah)   = E_nom * 1000 / V_banco
```

> El redondeo de paneles y unidades de batería siempre se realiza hacia arriba: no se cotizan fracciones de equipo.

## 3.3 Tecnologías de batería

| Tecnología | DoD máximo | Observaciones |
| --- | --- | --- |
| Litio LiFePO4 | 0.80 | Requiere BMS, mayor vida util, evitar calor excesivo |
| Gel / AGM | 0.50 | Requiere ventilación, no admitir descargas profundas |

# 4. Justificación tecnológica

| Decisión | Alternativa descartada | Razón |
| --- | --- | --- |
| Node.js y Express | PHP / Django | Ecosistema ESM, rapidez de iteración y JSON nativo |
| MongoDB y Mongoose | SQL relacional | Esquema flexible para catalogos y múltiples almacenes |
| Socket.IO | Solo HTTP | Preparación para actualizaciones en tiempo real |
| OCR con confirmación | OCR automático sin revisión | Evita errores de lectura en datos críticos |
| Telegram por Bot API | SDK externo adicional | Usa fetch nativo; sin dependencias nuevas |

# 5. OCR y supervisión humana

La investigación sobre lectura de facturas y etiquetas condujo a una decisión de diseño importante: el OCR nunca es una fuente de verdad. Extrae campos con un valor de confianza y los presenta como borrador. Si la confianza es inferior a 0.85 o el campo es inválido, se marca para revisión.

- El borrador queda en estado pendiente_confirmacion.
- El usuario debe revisar y confirmar potencia, horas y voltaje antes de calcular.
- Un cálculo con origen OCR sin confirmar responde 422 OCR_PENDIENTE_CONFIRMACION.
- La imagen se conserva bajo /uploads/images para trazabilidad.

# 6. Hallazgos aplicados al prototipo

El estudio se validó con un caso de prueba real. Los valores obtenidos coinciden con las fórmulas de la sección 3.

| Magnitud | Valor obtenido | Verificación |
| --- | --- | --- |
| Consumo diario | 12,3 kWh | Suma de tres equipos ponderada por horas |
| Generación requerida | 15,375 kWh/dia | 12,3 / 0.80 |
| Arreglo fotovoltaico | 2,563 kWp | 15,375 / 6.0 |
| Paneles | 5 de 550 W | ceil(2,563 / 0,550) |
| Inversor | 5 kVA | Carga pico x 1,25 / 0,90 |
| Banco de baterías | 400,391 Ah a 48 V | Energía nominal / DoD / eta |
| Presupuesto | USD 3.865 | Stock real de Coro y Punto Fijo |

# 7. Conclusiones

- Las constantes regionales permiten un dimensionamiento reproducible y defendible.
- La confirmación humana reduce el riesgo inherente al OCR sin frenar el flujo de trabajo.
- La cotización solo es util si refleja stock real; por eso el inventario es parte del cálculo.
- La tolerancia a fallos permite que el cálculo siga disponible aunque MongoDB o Telegram no lo este.

# 8. Fuentes

- Documento Maestro Teórico - SolarParaguana IA.
- Manual Maestro de Prompts y Contexto - SolarParaguana IA.
- context/system_context.md y context/business_rules.md.
- AGENTS.md - Guía Maestra y Estándar de Desarrollo.
