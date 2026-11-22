# SolarParaguaná IA — Reglas de Negocio y Flujos Funcionales

> Propuesta de especificación operativa. No incluye código fuente.
> Referencias: `AGENTS.md`, `context/system_context.md`.
> Las fórmulas base de `system_context.md` se mantienen y se amplían aquí.

## 1. Constantes físicas y solares regionales (Falcón)

| Constante | Símbolo | Valor | Unidad | Aplicación |
| --- | --- | --- | --- | --- |
| Horas Sol Pico | `HSP` | `6.0` | kWh/m²/día (h equivalentes/día) | Dimensionamiento de generación fotovoltaica |
| Eficiencia global del sistema | `η` | `0.80` | adimensional | Pérdidas de temperatura, cableado, inversor, suciedad y descarga |
| Factor de seguridad del inversor | `k_inv` | `1.25` | adimensional | Margen sobre la carga pico simultánea |

**Reglas sobre las constantes:**

- Son valores fijos para Coro, Punto Fijo y la Península de Paraguaná.
- Solo pueden sobreescribirse de forma explícita por un técnico y la sobreescritura
  debe quedar registrada en la auditoría del cálculo.
- Rangos permitidos para sobreescrituras: `HSP` 3.0–7.0, `η` 0.60–0.95,
  `k_inv` 1.00–1.50. Fuera de estos rangos se rechaza el cálculo.

### Parámetros configurables (propuestos, pendientes de aprobación)

| Parámetro | Valor propuesto | Observación |
| --- | --- | --- |
| Factor de potencia | `FP = 0.90` | Se captura como dato de entrada; si falta, se aplica este valor y se muestra en el desglose |
| Autonomía del banco | `A = 1` día | Rango permitido 1–3 días |
| Voltaje del banco | `V_banco = 48 V` | Para sistemas < 3 kVA se propone 12 V; admite 12/24/48 V según equipamiento |

> Nota: `system_context.md` indicaba que la conversión kVA se detallaría aquí.
> Se define `kVA = kW / FP`, con `FP` capturado o, en su defecto, `0.90`.

## 2. Especificaciones base de equipos comerciales locales

### 2.1 Paneles

- Referencia base: **panel monocristalino de 550 Wp** (`P_panel = 0.550 kWp`).
- Toda cantidad de paneles es un número entero calculado por exceso.
- Se cotizan únicamente modelos de 550 Wp o superiores disponibles en stock local.

### 2.2 Inversores

- Se dimensionan en **kVA**, no solo en kW.
- Conversión obligatoria: `S_inv(kVA) = P_inv(kW) / FP`.
- Se selecciona el modelo en stock cuya potencia nominal en kVA sea
  **mayor o igual** que el requerimiento calculado; si ninguno lo cubre, se
  proponen varios equipos en configuración válida o se marca la propuesta
  como no cotizable por falta de stock.
- Se privilegian inversores de onda senoidal pura por el riesgo de daño a
  equipos electrónicos descrito en `system_context.md`.
- No se fija un catálogo rígido: los escalones comerciales disponibles se
  consultan al inventario de Coro o Punto Fijo.

### 2.3 Baterías

| Tecnología | DoD recomendado | Restricciones de uso |
| --- | --- | --- |
| Litio (LiFePO4) | `0.80` | Requiere BMS; mayor vida útil; evitar exposición prolongada a altas temperaturas |
| Gel / AGM | `0.50` | Requiere ventilación; no admitir descargas profundas; vida útil menor |

- El DoD se aplica como límite máximo: no se permite declarar un DoD superior
  al recomendado para la tecnología seleccionada.
- La capacidad final se expresa en Ah a voltaje de banco (`12/24/48 V`) y se
  deriva del cálculo de energía nominal de la sección 3.
- El número de unidades es entero y se obtiene de la combinación serie/paralelo
  necesaria para alcanzar voltaje y capacidad.

## 3. Fórmulas completas de dimensionamiento

### 3.1 Consumo diario

Para varios equipos, la fórmula base se generaliza como suma:

    E_d (kWh/día) = Σ (P_i × h_i) / 1000

Cuando el dato proviene de una factura mensual:

    E_d (kWh/día) = E_mensual (kWh) / días_del_mes

### 3.2 Generación requerida y cantidad mínima de paneles

    E_gen (kWh/día) = E_d / η
    P_array (kWp)   = E_gen / HSP = E_d / (HSP × η)
    N_paneles       = ceil( P_array / 0.550 ) = ceil( E_d / (HSP × η × 0.550) )

Regla de redondeo: siempre hacia arriba. Nunca se cotiza una fracción de panel.

### 3.3 Capacidad del inversor

    P_inv (kW)   = P_pico (kW) × k_inv
    S_inv (kVA)  = P_inv (kW) / FP

Se elige el equipo de stock con `S_nominal ≥ S_inv`.

### 3.4 Banco de baterías según autonomía

    E_req (kWh)  = E_d × A
    E_nom (kWh)  = E_req / (DoD × η)
    C_banco (Ah) = E_nom × 1000 / V_banco

Combinación de unidades (para baterías individuales de `V_bat`, `C_bat`):

    Unidades en serie    = V_banco / V_bat   (debe dar un número entero)
    Unidades en paralelo = ceil( C_banco / C_bat )
    Total de unidades    = serie × paralelo

> `η` se aplica **una sola vez** en cada ecuación. En el banco de baterías
> representa el margen de pérdidas de la descarga hacia carga AC; no se aplica
> dos veces al mismo flujo de energía.

### 3.5 Ejemplo de verificación (no normativo)

Entradas: `E_d = 10 kWh/día`, `P_pico = 3 kW`, `A = 1`, `FP = 0.90`,
Litio (`DoD = 0.80`), `V_banco = 48 V`.

- `E_gen = 10 / 0.80 = 12.5 kWh/día`
- `P_array = 12.5 / 6.0 = 2.083 kWp` → `N_paneles = ceil(2.083 / 0.550) = 4`
- `P_inv = 3 × 1.25 = 3.75 kW` → `S_inv = 3.75 / 0.90 = 4.17 kVA`
- `E_req = 10 kWh` → `E_nom = 10 / (0.80 × 0.80) = 15.625 kWh`
- `C_banco = 15.625 × 1000 / 48 = 325.5 Ah`

## 4. Reglas de validación de entrada

### 4.1 Reglas generales

- Se rechazan valores `null`, `undefined`, vacíos, no numéricos y `NaN`.
- Se rechazan **valores negativos y cero** para toda magnitud física: potencia,
  horas, voltaje, consumo, corriente, HSP, eficiencia, factor de potencia,
  DoD, autonomía y capacidad de batería.
- Se rechazan formatos con coma decimal no normalizada; se acepta punto decimal.
- Los mensajes de error deben ser legibles para el usuario final e incluir una
  sugerencia de corrección, conforme a `AGENTS.md` (sección 7, modo BUILD).

### 4.2 Rangos admitidos

| Campo | Rango válido |
| --- | --- |
| Potencia por equipo | `1 – 10000 W` |
| Horas de uso diario | `> 0 – 24 h/día` |
| Voltaje | `110 – 240 V` |
| Consumo diario calculado | `0.1 – 1000 kWh/día` |
| Factor de potencia | `0.80 – 1.00` |
| Autonomía | `1 – 3` días, entero |
| DoD Litio | `0.01 – 0.80` |
| DoD Gel/AGM | `0.01 – 0.50` |
| HSP sobreescrito | `3.0 – 7.0 kWh/m²/día` |
| Eficiencia sobreescrita | `0.60 – 0.95` |
| Factor de seguridad sobreescrito | `1.00 – 1.50` |

### 4.3 Confirmación obligatoria tras OCR

- La salida del OCR es siempre un **borrador** con estado
  `pendiente_confirmacion`; nunca es entrada directa del motor de cálculo.
- Cada campo extraído (potencia, horas, voltaje, consumo) se muestra al usuario
  junto a la imagen original y debe ser editable.
- El motor de cálculo debe rechazar cualquier entrada marcada con
  `origen = OCR` mientras `confirmado = false`.
- Si la confianza del OCR es menor que `0.85` (umbral configurable), se exige
  digitación manual; por encima del umbral también se requiere confirmación.
- Se registra como auditoría: ruta de la imagen bajo `/uploads/images`, datos
  extraídos, cambios del usuario, confirmación y fecha/hora.
- En Telegram la confirmación se realiza con botones inline
  **Confirmar / Editar** antes de ejecutar cualquier cálculo.

## 5. Reglas de cotización con inventario local

### 5.1 Elegibilidad de ítems

- Solo se cotizan equipos con `stock.disponible > 0`.
- Solo se consideran almacenes de **Coro** o **Punto Fijo**.
- Se rechazan ítems sin precio vigente o sin almacén asignado.
- Si un modelo requerido no tiene stock, se busca un equivalente con stock que
  cumpla o supere el requerimiento; si no existe, la propuesta se marca como
  **no cotizable por falta de stock local** y no se le asigna precio.

### 5.2 Reglas de cantidades y selección

- Paneles: exactamente `N_paneles` calculado, entero por exceso.
- Inversor: modelo con `S_nominal ≥ S_inv`, preferentemente el de menor costo
  entre los disponibles; si hay stock en ambos almacenes, se prioriza el de
  menor precio y, en empate, Coro.
- Baterías: `Total de unidades` calculado, entero por exceso, respetando la
  combinación serie/paralelo.
- No se permiten cantidades fraccionarias ni sustituir un equipo por otro de
  menor capacidad nominal.

### 5.3 Reglas de emisión

- La disponibilidad se valida al momento de emitir la cotización y el stock
  queda reservado; nunca se genera una cotización con stock negativo.
- Vigencia propuesta: **15 días** (configurable).
- La moneda se toma del ítem de inventario; no se mezclan monedas en un mismo
  total sin conversión explícita.
- Toda cotización muestra desglose de entradas, fórmulas aplicadas y origen
  del stock (Coro / Punto Fijo) para permitir la trazabilidad exigida en
  `system_context.md`.

## 6. Flujo funcional de extremo a extremo

1. El usuario ingresa equipos manualmente o envía una foto de factura/etiqueta
   desde web, móvil o Telegram.
2. El OCR extrae datos y genera un borrador `pendiente_confirmacion`.
3. El usuario revisa, edita y confirma; se aplican las validaciones de la sección 4.
4. El motor calcula consumo, paneles, inversor en kVA y banco de baterías.
5. El cotizador consulta inventario de Coro/Punto Fijo y propone solo stock disponible.
6. El resultado se entrega por la SPA, la app móvil o el bot de Telegram,
   con desglose auditable y mensajes de error legibles.

## 7. Decisiones pendientes de aprobación

- `FP = 0.90` por defecto.
- Autonomía `A = 1` día por defecto.
- `V_banco = 48 V` (12 V para sistemas < 3 kVA).
- Rangos numéricos de la sección 4.2.
- Umbral de confianza OCR `0.85`.
- Vigencia de cotización `15 días`.
