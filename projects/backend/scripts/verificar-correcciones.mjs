/**
 * Verificación de regresión de las dos correcciones del Avance 1:
 *   1) POST /api/solar/ocr-confirm rechaza confirmado:false con 422.
 *   2) La herramienta MCP "calcular" usa equipos/ocrId en vez del texto de ayuda.
 *
 * Uso:
 *   node scripts/verificar-correcciones.mjs
 *   BASE_URL=https://tu-backend.up.railway.app node scripts/verificar-correcciones.mjs
 *
 * Guarda el detalle en evidence/verificacion-correcciones.json
 * (o en evidence/produccion/ si se usa BASE_URL).
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const backendDir = path.join(root, 'projects', 'backend');
const fixture = path.join(root, 'postman', 'fixtures', 'etiqueta-ejemplo.png');
const port = Number(process.env.PORT || 18512);
const host = '127.0.0.1';
const baseUrl = process.env.BASE_URL?.trim().replace(/\/$/, '') || '';
const evidenceDir = path.join(root, 'evidence', baseUrl ? 'produccion' : '');

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
    const body = JSON.stringify(objeto);
    return request({
        method,
        ruta,
        body,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }
    });
}

async function multipartRequest(ruta, campos, archivo) {
    const boundary = `----solarregresion${Date.now()}`;
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

function registrar(resultados, nombre, respuesta, esperado, esValido, detalle) {
    resultados.push({
        nombre,
        estado: respuesta.status,
        esperado,
        ok: respuesta.status === esperado && esValido,
        detalle: detalle()
    });
}

async function main() {
    await fs.mkdir(evidenceDir, { recursive: true });

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
        const resultados = [];
        const campos = [
            { campo: 'potenciaW', valor: 150 },
            { campo: 'horasDia', valor: 24 },
            { campo: 'voltajeV', valor: 120 }
        ];

        const parsing = await multipartRequest('/api/solar/ocr-parse', {
            texto: 'Etiqueta: Potencia: 150 W Horas: 24 Voltaje: 120 V',
            tipo: 'etiqueta'
        }, fixture);
        const borrador = JSON.parse(parsing.text);

        const rechazo = await jsonRequest('POST', '/api/solar/ocr-confirm', {
            ocrId: borrador.id,
            confirmado: false,
            campos
        });
        const cuerpoRechazo = JSON.parse(rechazo.text);
        registrar(
            resultados,
            'ocr-confirm rechaza confirmado=false',
            rechazo,
            422,
            () => cuerpoRechazo.error?.code === 'OCR_NO_CONFIRMADO',
            () => `code=${cuerpoRechazo.error?.code}`
        );

        const calculo = await jsonRequest('POST', '/microservices/telegram/mcp/tools/calcular', {
            argumentos: {
                equipos: [{ nombre: 'Nevera', potenciaW: 150, horasDia: 24, voltajeV: 120 }],
                cargaPicoKW: 3
            }
        });
        const cuerpoCalculo = JSON.parse(calculo.text);
        registrar(
            resultados,
            'mcp calcular usa argumentos.equipos',
            calculo,
            200,
            () => Number(cuerpoCalculo.resultado?.calculation?.totalPanels) > 0,
            () => `paneles=${cuerpoCalculo.resultado?.calculation?.totalPanels}, ` +
                  `kWh=${cuerpoCalculo.resultado?.consumo?.diarioKWh}`
        );

        const lineas = [
            'SolarParaguaná IA — Verificación de correcciones',
            `Fecha: ${new Date().toISOString()}`,
            `Base: ${baseUrl || `http://${host}:${port}`}`,
            '',
            ...resultados.map((r) =>
                `[${r.ok ? 'PASS' : 'FAIL'}] ${r.nombre}: HTTP ${r.estado} ` +
                `(esperado ${r.esperado}) — ${r.detalle}`
            )
        ];
        const pasadas = resultados.filter((r) => r.ok).length;
        const resumen = {
            fecha: new Date().toISOString(),
            base: baseUrl || `http://${host}:${port}`,
            resultado: `${pasadas}/${resultados.length}`,
            casos: resultados
        };
        await fs.writeFile(
            path.join(evidenceDir, 'verificacion-correcciones.json'),
            JSON.stringify(resumen, null, 2) + '\n',
            'utf8'
        );
        console.log(lineas.join('\n'));
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
