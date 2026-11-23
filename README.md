# SolarParaguaná IA — Backend

API REST para el dimensionamiento de sistemas fotovoltaicos residenciales y comerciales en el estado Falcón (Venezuela). Calcula consumo, cantidad de paneles, inversor y banco de baterías, y emite una cotización usando inventario real disponible en **Coro** y **Punto Fijo**.

Incluye además un borrador de OCR con confirmación obligatoria y un conector MCP para Telegram que reutiliza la misma lógica de cálculo.

- **Stack:** Node.js 26 (ESM), Express 5, MongoDB/Mongoose, Socket.IO, express-fileupload.
- **Puerto por defecto:** `18512`.
- **Moneda de los presupuestos:** USD.
- **Repositorio:** https://github.com/Jaren2402/solarparaguana-ia

---

## 1. Requisitos

- Node.js 26 o superior (`node --version`).
- npm.
- MongoDB local o una URI de MongoDB Atlas (opcional para calcular, necesaria para cotizar).
- Git.

---

## 2. Instalación

```powershell
git clone https://github.com/Jaren2402/solarparaguana-ia.git
cd solarparaguana-ia\projects\backend
npm install
```

Copia la plantilla de entorno y ajústala:

```powershell
copy .env.example .env
```

Contenido de `.env.example` (cópialo tal cual a `.env`):

```ini
PORT=18512
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/solarparaguana_ia

# Opcionales
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
MCP_SERVICE_TOKEN=
```

> **Nunca subas `.env` al repositorio.** Ya está excluido por `.gitignore`. El repo solo contiene `.env.example`.

Si usas MongoDB Atlas, reemplaza `MONGO_URI` por tu cadena de conexión y agrega `0.0.0.0/0` a la lista de IPs permitidas.

### Cargar el inventario de prueba

Con MongoDB corriendo:

```powershell
npm run seed
```

El seeder es **idempotente**: usa `sku` como clave, así que ejecutarlo varias veces no duplica datos. Carga 16 equipos reales (10 en Coro, 6 en Punto Fijo).

---

## 3. Arrancar el servidor

```powershell
npm start
```

Deberías ver:

```text
[telegram] TELEGRAM_BOT_TOKEN no configurado: el bot queda desactivado, el servidor continúa activo.
Servidor ejecutándose en el puerto 18512
```

Para desarrollo con recarga automática:

```powershell
npm run dev
```

> Si MongoDB no está disponible, el servidor **sigue arriba** y el cálculo funciona. Solo la cotización queda pendiente con un mensaje legible. Lo mismo aplica si falta el token de Telegram.

---

## 4. Estructura del proyecto

```text
solarparaguana-ia/
├── context/                    # Contexto de negocio, reglas y contratos de API
├── skills/                     # Guías metodológicas del ecosistema
├── memory/                     # Decisiones de arquitectura y errores resueltos
└── projects/backend/
    ├── api/solar/              # Controlador, modelo y rutas del dominio solar
    ├── assets/                 # Recursos estáticos del servidor
    ├── bin/server.js           # Clase WebServer: middlewares, rutas, estáticos
    ├── databases/mongodb.js    # Conexión tolerante a fallos
    ├── helpers/respuestas.js   # Formato común de errores legibles
    ├── microservices/          # Conector MCP / Telegram
    ├── middlewares/notFound.js # Fallback JSON para rutas inexistentes
    ├── public/                 # Build del frontend (aún no compilado)
    ├── scripts/                # Tareas automatizadas
    ├── seeders/                # Inventario base
    ├── uploads/                # Imágenes, documentos y APKs
    ├── ecosystem.config.cjs    # Configuración PM2
    ├── .env.example            # Plantilla segura
    └── index.js                # Punto de entrada
```

---

## 5. Endpoints

Base: `http://127.0.0.1:18512`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/energy/constants` | Constantes físicas del cálculo |
| `POST` | `/api/energy/calculate` | Calcular dimensionamiento |
| `POST` | `/api/solar/calculate` | Alias del cálculo (Manual Maestro / app Kotlin) |
| `GET` | `/api/inventory` | Inventario de Coro y Punto Fijo |
| `POST` | `/api/solar/ocr-parse` | Subir imagen y extraer borrador OCR |
| `POST` | `/api/solar/ocr-confirm` | Confirmar campos del OCR |
| `POST` | `/api/solar/quote` | Cotizar con stock local |
| `GET` | `/microservices/telegram/health` | Estado del conector |
| `GET` | `/microservices/telegram/mcp/tools` | Catálogo de herramientas MCP |
| `POST` | `/microservices/telegram/mcp/tools/:nombre` | Ejecutar herramienta MCP |

El contrato completo está en [`context/api_contracts.md`](context/api_contracts.md).

### 5.1 Ver constantes e inventario

Se puede abrir directo en el navegador:

```text
http://127.0.0.1:18512/api/energy/constants
http://127.0.0.1:18512/api/inventory
http://127.0.0.1:18512/microservices/telegram/health
http://127.0.0.1:18512/microservices/telegram/mcp/tools
```

### 5.2 Calcular

```powershell
$body = '{"origen":"MANUAL","equipos":[{"potenciaW":150,"horasDia":24,"voltajeV":120,"tipo":"GENERAL"},{"potenciaW":1200,"horasDia":6,"voltajeV":120,"tipo":"GENERAL"},{"potenciaW":750,"horasDia":2,"voltajeV":120,"tipo":"MOTOR"}]}'
curl.exe -s -X POST http://127.0.0.1:18512/api/solar/calculate -H "Content-Type: application/json" --data-raw $body
```

Respuesta real de ejemplo (extraído):

```json
{
  "id": "calc_bc819e35",
  "estado": "calculado",
  "status": "ok",
  "consumo": { "diarioKWh": 12.3 },
  "paneles": { "potenciaUnitariaWp": 550, "cantidad": 5 },
  "inversor": { "capacidadRequeridaKVA": 5 },
  "bancoBaterias": { "capacidadRequeridaAh": 400.391, "voltajeBancoV": 48 },
  "calculation": {
    "totalKwhDay": 12.3,
    "recommendedInverterKva": 5,
    "totalPanels": 5,
    "batteryBankAh": 400.391
  },
  "localQuote": null
}
```

También se puede calcular desde una factura, enviando `consumoMensualKWh`, `diasDelMes` y `cargaPicoKW` en lugar de `equipos`.

### 5.3 Cotizar

Copia el `id` devuelto por el cálculo:

```powershell
curl.exe -s -X POST http://127.0.0.1:18512/api/solar/quote -H "Content-Type: application/json" --data-raw '{"calculoId":"calc_bc819e35"}'
```

Resultado esperado para el ejemplo anterior: **USD 3.865**, con 5 paneles Jinko 550 W, 1 inversor Must 5 kW y 12 baterías Gel 12 V / 200 Ah.

### 5.4 OCR con confirmación obligatoria

Subir imagen (campo `imagen`, también acepta `file` o `image`):

```powershell
curl.exe -s -X POST http://127.0.0.1:18512/api/solar/ocr-parse -F "imagen=@ruta\a\etiqueta.jpg" -F "tipo=etiqueta"
```

Confirmar los campos usando el `id` devuelto:

```powershell
$ocr = '{"ocrId":"ocr_12345678","campos":[{"campo":"potenciaW","valor":1200},{"campo":"horasDia","valor":6},{"campo":"voltajeV","valor":120}]}'
curl.exe -s -X POST http://127.0.0.1:18512/api/solar/ocr-confirm -H "Content-Type: application/json" --data-raw $ocr
```

Si se intenta calcular con `origen: "OCR"` antes de confirmar, la API responde `422 OCR_PENDIENTE_CONFIRMACION`.

### 5.5 Telegram / MCP

Sin `TELEGRAM_BOT_TOKEN`, `/health` devuelve:

```json
{
  "status": "degraded",
  "version": "1.0.0",
  "updatesPendientes": 0,
  "detalle": "Falta TELEGRAM_BOT_TOKEN; el resto del servidor sigue activo."
}
```

Herramientas disponibles: `extraer_ocr`, `confirmar_ocr`, `calcular`, `cotizar`, `consultar_stock`.

Si configuras `MCP_SERVICE_TOKEN`, las rutas MCP requieren la cabecera `Authorization: Bearer <token>`.

---

## 6. Constantes del dimensionamiento

| Constante | Valor |
|---|---|
| HSP (horas sol pico) | 6.0 |
| Eficiencia global (η) | 0.80 |
| Factor de seguridad del inversor | 1.25 |
| Factor de potencia | 0.90 |
| Autonomía | 1 día |
| Voltaje del banco | 48 V |
| DoD batería LITIO / GEL_AGM | 0.80 / 0.50 |
| Panel de referencia | 550 Wp |
| Factor de arranque de motores | 3 |

Fórmulas principales:

```text
consumo diario (kWh) = Σ(potencia W × horas) / 1000
generación requerida = consumo / η
potencia del array (kWp) = generación / HSP
cantidad de paneles = ceil(array / 0.550)
inversor (kVA) = (carga pico kW × 1.25) / FP
batería (Ah) = (consumo × autonomía × 1000) / (DoD × η × voltaje banco)
```

---

## 7. Códigos de error

Todas las fallas devuelven un JSON con `code`, `message`, `suggestion`, `details` y `traceId`.

| HTTP | Código | Significado |
|---|---|---|
| 400 | `ARCHIVO_REQUERIDO` | Falta la imagen en el OCR |
| 404 | `RUTA_NO_ENCONTRADA` | La ruta de API no existe |
| 404 | `FRONTEND_NO_DISPONIBLE` | El frontend aún no está compilado |
| 409 | `SIN_STOCK_LOCAL` | No hay stock en Coro ni Punto Fijo |
| 409 | `MONEDA_MIXTA` | Los ítems mezclan monedas |
| 415 | `FORMATO_NO_SOPORTADO` | La imagen no es JPEG, PNG ni WebP |
| 422 | `OCR_PENDIENTE_CONFIRMACION` | El borrador OCR no fue confirmado |

---

## 8. Prueba rápida (smoke test)

Con el servidor arriba, ejecuta en orden y verifica los códigos:

```powershell
curl.exe -s -o NUL -w "constants %{http_code}`n" http://127.0.0.1:18512/api/energy/constants
curl.exe -s -o NUL -w "inventory %{http_code}`n" http://127.0.0.1:18512/api/inventory
curl.exe -s -o NUL -w "health %{http_code}`n" http://127.0.0.1:18512/microservices/telegram/health
curl.exe -s -o NUL -w "mcp tools %{http_code}`n" http://127.0.0.1:18512/microservices/telegram/mcp/tools
```

Todos deben devolver `200`. Los borradores OCR y los cálculos se guardan en memoria: se pierden al reiniciar el servidor.

---

## 9. Despliegue

La plantilla `ecosystem.config.cjs` está lista para PM2:

```bash
pm2 start ecosystem.config.cjs --env production
```

Antes de desplegar, define `PORT`, `MONGO_URI` y, si aplica, los tokens de Telegram en el entorno del servidor. La plataforma debe poder instalar Node 20 o superior.

### Despliegue actual (Railway)

- **URL pública:** <https://solarparaguana-ia-production.up.railway.app>
- **Repositorio:** `Jaren2402/solarparaguana-ia`, rama `main`
- **Root Directory:** `projects/backend`
- **Base de datos:** MongoDB Atlas (`solarparaguana_ia`), verificada desde Railway.
- **Inventario:** 16 equipos de Coro / Punto Fijo cargados automáticamente al arrancar.

Verificación rápida:

```text
GET https://solarparaguana-ia-production.up.railway.app/api/energy/constants
GET https://solarparaguana-ia-production.up.railway.app/api/inventory
```

---

## 10. Estado del proyecto

- ✅ Sprint 1 completo: estructura, cálculo, OCR, cotización, inventario y MCP.
- ✅ Backend desplegado y verificado en Railway con MongoDB Atlas.
- ⏳ Frontend Angular y aplicación móvil: entregas posteriores.

Las decisiones de arquitectura y los problemas resueltos están documentados en [`memory/`](memory/).

---

## 11. Documentos, Postman y evidencia

### 11.1 Documentos del proyecto

Cada documento está disponible en **PDF** (para subir como archivo) y en **Markdown** (para dar un enlace).

| # | Documento | PDF | Markdown |
|---|---|---|---|
| 1 | Documento principal | [PDF](documentos/01-documento-principal.pdf) | [MD](documentos/01-documento-principal.md) |
| 2 | Estudio e investigación | [PDF](documentos/02-estudio-investigacion.pdf) | [MD](documentos/02-estudio-investigacion.md) |
| 3 | Requerimientos y casos de uso | [PDF](documentos/03-requerimientos-casos-uso.pdf) | [MD](documentos/03-requerimientos-casos-uso.md) |
| 4 | Arquitectura y modelo de datos | [PDF](documentos/04-arquitectura-modelo-datos.pdf) | [MD](documentos/04-arquitectura-modelo-datos.md) |
| 5 | Planificación y riesgos | [PDF](documentos/05-planificacion-riesgos.pdf) | [MD](documentos/05-planificacion-riesgos.md) |

Índice e instrucciones de regeneración: [`documentos/README.md`](documentos/README.md).

Para regenerar los cinco PDF y sus versiones Markdown desde la raíz:

```powershell
python projects\backend\scripts\generate_documentos.py
```

Requiere Python con `reportlab` instalado. El contenido se define una sola vez en el script, así que ambos formatos siempre coinciden.

### 11.2 Colección de Postman y evidencia

- Colección importable: [`postman/SolarParaguana.postman_collection.json`](postman/SolarParaguana.postman_collection.json) — 14 peticiones con pruebas automáticas.
- Evidencia de ejecución: [`evidence/README.md`](evidence/README.md) y [`evidence/smoke-test-result.txt`](evidence/smoke-test-result.txt) — **15/15 pruebas correctas**.
- Respuestas completas: [`evidence/respuestas/`](evidence/respuestas/).

Para regenerar la evidencia:

```powershell
node projects\backend\scripts\smoke-test.mjs
```
