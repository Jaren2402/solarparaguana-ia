/**
 * Prueba de humo del backend SolarParaguaná IA.
 *
 * Uso:
 *   node scripts/smoke-test.mjs
 *   BASE_URL=https://tu-backend.up.railway.app node scripts/smoke-test.mjs
 *
 * Si el servidor no está arriba, el propio script lo inicia y lo detiene al final.
 * Con BASE_URL se prueba un despliegue remoto sin iniciar servidor local.
 * Guarda cada respuesta en /evidence/respuestas y un resumen en
 * /evidence/smoke-test-result.txt (o en /evidence/produccion/ para BASE_URL).
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const backendDir = path.join(root, 'projects', 'backend');
const evidenceDir = path.join(root, 'evidence');
let respuestasDir = path.join(evidenceDir, 'respuestas');
const fixture = path.join(root, 'postman', 'fixtures', 'etiqueta-ejemplo.png');
const port = Number(process.env.PORT || 18512);
const host = '127.0.0.1';
const baseUrl = process.env.BASE_URL?.trim().replace(/\/$/, '') || '';
const evidenceActual = baseUrl ? path.join(evidenceDir, 'produccion') : evidenceDir;

function request({ method = 'GET', ruta, headers = {}, body = null }) {
    if (baseUrl) {
        return fetch(`${baseUrl}${ruta}`, {
            method,
            headers,
            body,
            signal: AbortSignal.timeout(15000)
        }).then(async (res) => ({ status: res.status, text: await res.text() }));
    }
    return new Promise((resolve, reject) => {
        const req = http.request(
            { host, port, path: ruta, method, headers, timeout: 5000 },
            (res) => {
                let texto = '';
                res.setEncoding('utf8');
                res.on('data', (c) => { texto += c; });
                res.on('end', () => resolve({ status: res.statusCode, text: texto }));
            }
        );
        req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout en ${ruta}`)); });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

function jsonRequest(method, ruta, objeto) {
    const body = objeto === undefined ? null : JSON.stringify(objeto);
    return request({
        method,
        ruta,
        body,
        headers: body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}
    });
}

async function multipartRequest(ruta, campos, archivo) {
    const boundary = `----solarparaguana${Date.now()}`;
    const partes = [];
    for (const [clave, valor] of Object.entries(campos)) {
        partes.push(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${clave}"\r\n\r\n` +
            `${valor}\r\n`
        );
    }
    partes.push(
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="imagen"; filename="etiqueta-ejemplo.png"\r\n' +
        'Content-Type: image/png\r\n\r\n'
    );
    const contenido = await fs.readFile(archivo);
    const body = Buffer.concat([
        Buffer.from(partes.join('')),
        contenido,
        Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);
    return request({
        method: 'POST',
        ruta,
        body,
        headers: {
            'content-type': `multipart/form-data; boundary=${boundary}`,
            'content-length': body.length
        }
    });
}

async function servidorArriba() {
    try {
        await request({ ruta: '/api/energy/constants' });
        return true;
    } catch {
        return false;
    }
}

async function esperarServidor(intentos = 60) {
    for (let i = 0; i < intentos; i += 1) {
        if (await servidorArriba()) return true;
        await new Promise((resolver) => setTimeout(resolver, 250));
    }
    return false;
}

const resultados = [];

async function registrar(indice, nombre, ruta, respuesta, esperado, resumen) {
    let datos;
    try { datos = JSON.parse(respuesta.text); } catch { datos = respuesta.text; }
    await fs.writeFile(
        path.join(respuestasDir, `${String(indice).padStart(2, '0')}-${nombre}.json`),
        JSON.stringify(datos, null, 2),
        'utf8'
    );
    const ok = respuesta.status === esperado;
    resultados.push({
        nombre,
        ruta,
        estado: respuesta.status,
        esperado,
        ok,
        detalle: resumen(datos)
    });
    return datos;
}

async function main() {
    respuestasDir = path.join(evidenceActual, 'respuestas');
    await fs.mkdir(respuestasDir, { recursive: true });

    let servidor = null;
    if (!baseUrl && !(await servidorArriba())) {
        console.log('Servidor no detectado: iniciando node index.js ...');
        servidor = spawn(process.execPath, ['index.js'], {
            cwd: backendDir,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let logs = '';
        servidor.stdout.on('data', (c) => { logs += c.toString(); });
        servidor.stderr.on('data', (c) => { logs += c.toString(); });
        if (!(await esperarServidor())) {
            throw new Error(`El servidor no arrancó.\n${logs}`);
        }
    }

    try {
        const cuerpoManual = {
            origen: 'MANUAL',
            equipos: [
                { potenciaW: 150, horasDia: 24, voltajeV: 120, tipo: 'GENERAL' },
                { potenciaW: 1200, horasDia: 6, voltajeV: 120, tipo: 'GENERAL' },
                { potenciaW: 750, horasDia: 2, voltajeV: 120, tipo: 'MOTOR' }
            ]
        };

        const constants = await registrar(
            1, 'constants', '/api/energy/constants',
            await request({ ruta: '/api/energy/constants' }), 200,
            (j) => `hsp=${j.hsp}, eficiencia=${j.eficienciaGlobal}`
        );

        const inventory = await registrar(
            2, 'inventory', '/api/inventory',
            await request({ ruta: '/api/inventory' }), 200,
            (j) => `items=${j.items.length}, almacenes=${j.almacenes.join('/')}`
        );

        const calculo = await registrar(
            3, 'calculate', '/api/energy/calculate',
            await jsonRequest('POST', '/api/energy/calculate', cuerpoManual), 200,
            (j) => `id=${j.id}, kWh=${j.consumo.diarioKWh}, paneles=${j.calculation.totalPanels}, inversor=${j.calculation.recommendedInverterKva} kVA`
        );

        await registrar(
            4, 'calculate-alias', '/api/solar/calculate',
            await jsonRequest('POST', '/api/solar/calculate', cuerpoManual), 200,
            (j) => `status=${j.status}, bateria=${j.calculation.batteryBankAh} Ah`
        );

        await registrar(
            5, 'quote', '/api/solar/quote',
            await jsonRequest('POST', '/api/solar/quote', { calculoId: calculo.id }), 201,
            (j) => `presupuesto=${j.presupuesto.monto} ${j.presupuesto.moneda}, items=${j.items.length}`
        );

        await registrar(
            6, 'calculate-factura', '/api/energy/calculate',
            await jsonRequest('POST', '/api/energy/calculate', {
                origen: 'MANUAL', consumoMensualKWh: 300, diasDelMes: 30, cargaPicoKW: 5
            }), 200,
            (j) => `metodo=${j.consumo.metodo}, kWh=${j.consumo.diarioKWh}`
        );

        const ocr = await registrar(
            7, 'ocr-parse', '/api/solar/ocr-parse',
            await multipartRequest('/api/solar/ocr-parse', {
                texto: 'Etiqueta: Potencia: 150 W Horas: 24 Voltaje: 120 V',
                tipo: 'etiqueta'
            }, fixture), 201,
            (j) => `id=${j.id}, estado=${j.estado}, campos=${j.campos.length}`
        );

        await registrar(
            8, 'ocr-confirm', '/api/solar/ocr-confirm',
            await jsonRequest('POST', '/api/solar/ocr-confirm', {
                ocrId: ocr.id,
                campos: [
                    { campo: 'potenciaW', valor: 150 },
                    { campo: 'horasDia', valor: 24 },
                    { campo: 'voltajeV', valor: 120 }
                ]
            }), 200,
            (j) => `estado=${j.estado}, potencia=${j.camposConfirmados.potenciaW} W`
        );

        await registrar(
            9, 'calculate-ocr', '/api/energy/calculate',
            await jsonRequest('POST', '/api/energy/calculate', { origen: 'OCR', ocrId: ocr.id }), 200,
            (j) => `origen=${j.auditoria.origen}, ocrId=${j.auditoria.ocrId}, kWh=${j.consumo.diarioKWh}`
        );

        await registrar(
            10, 'ocr-sin-imagen', '/api/solar/ocr-parse',
            await jsonRequest('POST', '/api/solar/ocr-parse'), 400,
            (j) => `code=${j.error.code}`
        );

        await registrar(
            11, 'telegram-health', '/microservices/telegram/health',
            await request({ ruta: '/microservices/telegram/health' }), 200,
            (j) => `status=${j.status}, version=${j.version}`
        );

        await registrar(
            12, 'mcp-tools', '/microservices/telegram/mcp/tools',
            await request({ ruta: '/microservices/telegram/mcp/tools' }), 200,
            (j) => `herramientas=${j.herramientas.length}`
        );

        await registrar(
            13, 'mcp-ejecutar', '/microservices/telegram/mcp/tools/consultar_stock',
            await jsonRequest('POST', '/microservices/telegram/mcp/tools/consultar_stock', {
                argumentos: { tipo: 'panel' }
            }), 200,
            (j) => `herramienta=${j.herramienta}`
        );

        await registrar(
            14, 'telegram-webhook', '/microservices/telegram/webhook',
            await jsonRequest('POST', '/microservices/telegram/webhook', {}), 200,
            (j) => `ok=${j.ok}`
        );

        await registrar(
            15, 'ruta-inexistente', '/api/ruta-inexistente',
            await request({ ruta: '/api/ruta-inexistente' }), 404,
            (j) => `code=${j.error.code}`
        );

        const pasadas = resultados.filter((r) => r.ok).length;
        const lineas = [
            'SolarParaguaná IA — Evidencia de pruebas backend',
            `Fecha: ${new Date().toISOString()}`,
            `Base: ${baseUrl || `http://${host}:${port}`}`,
            `Resultado: ${pasadas}/${resultados.length} pruebas correctas`,
            '',
            ...resultados.map((r) =>
                `[${r.ok ? 'PASS' : 'FAIL'}] ${String(resultados.indexOf(r) + 1).padStart(2, '0')} ` +
                `${r.nombre.padEnd(18)} ${r.ruta.padEnd(52)} ` +
                `HTTP ${r.estado} (esperado ${r.esperado}) — ${r.detalle}`
            )
        ];

        await fs.writeFile(
            path.join(evidenceActual, 'smoke-test-result.txt'),
            lineas.join('\n') + '\n',
            'utf8'
        );
        console.log(lineas.join('\n'));
        console.log(`\nRespuestas guardadas en ${respuestasDir}`);
        if (pasadas !== resultados.length) process.exitCode = 1;
    } finally {
        if (servidor) {
            servidor.kill('SIGTERM');
            console.log('Servidor de prueba detenido.');
        }
    }
}

main().catch((error) => {
    console.error('ERROR:', error.message);
    process.exitCode = 1;
});
