import { Router } from 'express';
import { calcularDimensionamiento, cotizarCalculo, SolarError } from '../api/solar/calculator.controller.js';
import Inventory, { ALMACENES } from '../api/solar/inventory.model.js';
import { responderErrorLegible } from '../helpers/respuestas.js';

const TELEGRAM_API = 'https://api.telegram.org';
export const VERSION = '1.0.0';

export const HERRAMIENTAS = Object.freeze([
    {
        nombre: 'extraer_ocr',
        descripcion: 'Extrae datos de una foto de factura o etiqueta. Use POST /api/solar/ocr-parse.',
        inputSchema: { type: 'object', properties: { fileId: { type: 'string' }, tipo: { type: 'string' } }, required: ['fileId'] }
    },
    {
        nombre: 'confirmar_ocr',
        descripcion: 'Confirma los campos extraídos. Use POST /api/solar/ocr-confirm.',
        inputSchema: { type: 'object', properties: { ocrId: { type: 'string' }, confirmado: { type: 'boolean' } }, required: ['ocrId'] }
    },
    {
        nombre: 'calcular',
        descripcion: 'Dimensiona el sistema a partir de texto, equipos, OCR o consumo mensual.',
        inputSchema: {
            type: 'object',
            properties: {
                texto: { type: 'string' },
                equipos: { type: 'array' },
                ocrId: { type: 'string' },
                consumoMensualKWh: { type: 'number' },
                cargaPicoKW: { type: 'number' }
            }
        }
    },
    {
        nombre: 'cotizar',
        descripcion: 'Genera presupuesto con stock de Coro y Punto Fijo.',
        inputSchema: { type: 'object', properties: { calculoId: { type: 'string' } }, required: ['calculoId'] }
    },
    {
        nombre: 'consultar_stock',
        descripcion: 'Consulta equipos disponibles en los almacenes locales.',
        inputSchema: { type: 'object', properties: { almacen: { type: 'string', enum: ALMACENES }, tipo: { type: 'string' } } }
    }
]);

const EQUIPOS_REFERENCIA = [
    { claves: ['nevera', 'refrigerador', 'frigo', 'heladera'], nombre: 'Nevera', potenciaW: 150, horasDia: 24, tipo: 'GENERAL' },
    { claves: ['congelador', 'freezer'], nombre: 'Congelador', potenciaW: 200, horasDia: 24, tipo: 'GENERAL' },
    { claves: ['aire', 'aire acondicionado', 'ac', 'split'], nombre: 'Aire acondicionado', potenciaW: 1200, horasDia: 6, tipo: 'GENERAL', usarBtu: true },
    { claves: ['tv', 'television', 'televisor', 'pantalla'], nombre: 'Televisor', potenciaW: 120, horasDia: 6, tipo: 'GENERAL' },
    { claves: ['ventilador', 'abanico'], nombre: 'Ventilador', potenciaW: 80, horasDia: 8, tipo: 'GENERAL' },
    { claves: ['computadora', 'pc', 'laptop', 'ordenador'], nombre: 'Computadora', potenciaW: 200, horasDia: 6, tipo: 'GENERAL' },
    { claves: ['lavadora'], nombre: 'Lavadora', potenciaW: 500, horasDia: 1, tipo: 'MOTOR' },
    { claves: ['motobomba', 'bomba de agua', 'bomba'], nombre: 'Motobomba', potenciaW: 750, horasDia: 4, tipo: 'MOTOR' },
    { claves: ['microondas'], nombre: 'Microondas', potenciaW: 900, horasDia: 0.5, tipo: 'GENERAL' },
    { claves: ['plancha'], nombre: 'Plancha', potenciaW: 1000, horasDia: 1, tipo: 'GENERAL' },
    { claves: ['licuadora'], nombre: 'Licuadora', potenciaW: 300, horasDia: 0.5, tipo: 'GENERAL' },
    { claves: ['luz', 'luces', 'bombillo', 'iluminacion'], nombre: 'Iluminación', potenciaW: 120, horasDia: 6, tipo: 'GENERAL' }
];

const AYUDA = [
    '☀️ SolarParaguaná IA',
    'Envíame tu consumo aproximado o la lista de equipos, por ejemplo:',
    '• "18 kWh por día"',
    '• "2 aires 12000BTU + 1 nevera"',
    '• "nevera, tv y ventilador"',
    'También puedes indicar horas: "2 aires 12000BTU por 8 horas y 1 nevera".'
].join('\n');

const normalizar = (texto) => String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const aNumero = (valor) => {
    const numero = Number(String(valor).replace(',', '.'));
    return Number.isFinite(numero) ? numero : null;
};

function redondearPotencia(vatios) {
    return Math.max(1, Math.round(vatios / 50) * 50);
}

function resolverEquipo(fragmento) {
    const texto = normalizar(fragmento);
    if (!texto) return null;

    const cantidadMatch = texto.match(/^(\d+(?:[.,]\d+)?)\s*(?:x|unidades?|pzas?|piezas?)?\s*(.*)$/);
    const cantidad = cantidadMatch ? Math.max(1, Math.round(aNumero(cantidadMatch[1]) ?? 1)) : 1;
    const descripcion = cantidadMatch ? cantidadMatch[2] : texto;

    const btuMatch = descripcion.match(/\b(\d{4,5})\s*(?:btu|btus)\b/);
    const horasMatch = descripcion.match(/\b(\d{1,2}(?:[.,]\d)?)\s*(?:horas?|h)\b/);

    const referencia = EQUIPOS_REFERENCIA.find((equipo) => equipo.claves.some((clave) => descripcion.includes(clave)));
    if (!referencia && !btuMatch) return null;

    const potenciaBase = btuMatch
        ? redondearPotencia(aNumero(btuMatch[1]) / 3.412 / 3.0)
        : referencia.potenciaW;
    const horas = horasMatch ? Math.min(24, Math.max(0.25, aNumero(horasMatch[1]) ?? referencia.horasDia)) : referencia.horasDia;

    const nombre = btuMatch && referencia
        ? `${referencia.nombre} ${btuMatch[1]} BTU`
        : referencia?.nombre ?? 'Equipo con BTU declarados';

    return {
        cantidad,
        nombre,
        potenciaW: potenciaBase,
        horasDia: horas,
        voltajeV: 120,
        tipo: referencia?.tipo ?? 'GENERAL'
    };
}

/**
 * Convierte un mensaje libre en un cuerpo válido para el motor de cálculo.
 * Devuelve null cuando no hay datos suficientes.
 */
export function parsearMensaje(textoOriginal) {
    const texto = normalizar(textoOriginal);
    if (!texto) return null;

    const mensual = texto.match(/(\d+(?:[.,]\d+)?)\s*k\s*w\s*h[^\d]{0,20}\b(?:mes|mensual)\b/);
    const diario = texto.match(/(\d+(?:[.,]\d+)?)\s*k\s*w\s*h|consumo\w*\s+(?:de\s+)?(\d+(?:[.,]\d+)?)/);
    const fragmentos = texto
        .split(/\s*\+\s*|\s*,\s*|\s*y\s+|\s*;\s*|\n+/)
        .map((fragmento) => fragmento.trim())
        .filter(Boolean);
    const equipos = [];
    const noReconocidos = [];
    fragmentos.forEach((fragmento) => {
        const equipo = resolverEquipo(fragmento);
        if (equipo) {
            const unidades = Math.min(20, Math.max(1, equipo.cantidad ?? 1));
            for (let indice = 0; indice < unidades; indice += 1) {
                equipos.push({
                    nombre: equipo.nombre,
                    potenciaW: equipo.potenciaW,
                    horasDia: equipo.horasDia,
                    voltajeV: equipo.voltajeV,
                    tipo: equipo.tipo
                });
            }
        } else if (
            !/^(consumo|mi|de|por|dia|diario|kwh|aprox|aproximado|al|mes|mensual|solar)/.test(fragmento) &&
            !/^\d+(?:[.,]\d+)?\s*k\s*w\s*h/.test(fragmento)
        ) {
            noReconocidos.push(fragmento);
        }
    });
    const advertencias = [];
    if (noReconocidos.length > 0) {
        advertencias.push(`No reconocí: ${noReconocidos.join(', ')}. Usé solo los equipos identificados.`);
    }

    if (equipos.length > 0) {
        if (diario) advertencias.push('También mencionaste un consumo en kWh; prevaleció la lista de equipos.');
        return { modo: 'equipos', equipos, advertencias };
    }

    const valorKWh = aNumero(mensual ? mensual[1] : diario ? (diario[1] ?? diario[2]) : null);
    if (valorKWh === null || valorKWh <= 0) return null;

    const consumoDiarioKWh = mensual ? valorKWh / 30 : valorKWh;
    if (consumoDiarioKWh < 0.1 || consumoDiarioKWh > 1000) {
        return { error: 'El consumo indicado está fuera del rango atendible (0.1 a 1000 kWh/día).' };
    }

    advertencias.push('La carga pico se estimó a partir del consumo; confirme la potencia máxima para afinar el inversor.');
    return {
        modo: 'consumo',
        consumoDiarioKWh,
        cargaPicoKW: Math.max(1, Number((consumoDiarioKWh / 8).toFixed(2))),
        advertencias
    };
}

function mensajeLegible(error) {
    if (error instanceof SolarError) {
        const detalles = (error.details ?? [])
            .map((detalle) => `• ${detalle.field}: ${detalle.message}`)
            .join('\n');
        return [error.message, error.suggestion, detalles].filter(Boolean).join('\n');
    }
    return 'No pude completar la solicitud en este momento. Intente de nuevo en unos segundos o escriba "ayuda".';
}

function etiquetaMonto(presupuesto) {
    if (!presupuesto) return null;
    const monto = Number(presupuesto.monto).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return `${presupuesto.moneda ?? 'USD'} ${monto}`;
}

export function formatearResumen(calculo, cotizacion = null, contexto = {}) {
    const items = cotizacion?.items ?? [];
    const porTipo = (tipo) => items.find((item) => item.tipo === tipo);

    const inversor = porTipo('inversor');
    const panel = porTipo('panel');
    const bateria = porTipo('bateria');

    const inversorTexto = inversor
        ? `${inversor.marca} ${inversor.modelo} (${inversor.capacidad.valor} kVA)`
        : `${calculo.inversor.capacidadRequeridaKVA} kVA requeridos (FP ${calculo.inversor.factorPotenciaUsado})`;
    const panelTexto = panel
        ? `${panel.cantidad} × ${panel.marca} ${panel.modelo} de ${calculo.paneles.potenciaUnitariaWp} W`
        : `${calculo.paneles.cantidad} paneles de ${calculo.paneles.potenciaUnitariaWp} W (${calculo.generacion.potenciaArrayKWp} kWp)`;
    const bateriaTexto = bateria
        ? `${bateria.cantidad} × ${bateria.marca} ${bateria.modelo}`
        : `${calculo.bancoBaterias.configuracion.totalUnidades} baterías de ${calculo.bancoBaterias.referencia.voltajeV} V ${calculo.bancoBaterias.referencia.capacidadAh} Ah`;

    const avisos = [...(contexto.advertencias ?? [])];
    if (contexto.avisoPresupuesto) avisos.push(contexto.avisoPresupuesto);

    const lineas = [
        '☀️ SolarParaguaná IA — Resumen de tu sistema',
        `Consumo estimado: ${calculo.consumo.diarioKWh} kWh/día`,
        '',
        `🔌 Inversor recomendado: ${inversorTexto}`,
        `📦 Paneles: ${panelTexto}`,
        `🔋 Baterías: ${bateriaTexto}`,
        `   Banco ${calculo.bancoBaterias.voltajeBancoV} V · autonomía ${calculo.bancoBaterias.autonomiaDias} día(s) · DoD ${Math.round(calculo.bancoBaterias.dod * 100)}%`
    ];

    const monto = etiquetaMonto(cotizacion?.presupuesto);
    if (monto) {
        lineas.push('', `💰 Presupuesto estimado: ${monto}`);
        lineas.push('   Insumos disponibles en Coro y Punto Fijo (Falcón).');
        if (cotizacion.vigencia) lineas.push(`   Vigencia: ${cotizacion.vigencia}.`);
    }

    if (avisos.length > 0) {
        lineas.push('', '📝 Observaciones:');
        avisos.forEach((aviso) => lineas.push(`• ${aviso}`));
    }

    lineas.push('', `Cálculo ${calculo.id}. Resumen orientativo: valide con un técnico antes de instalar.`);
    return lineas.join('\n');
}

export async function procesarSolicitud(texto, opciones = {}) {
    const parseado = parsearMensaje(texto);
    if (!parseado) {
        return { ok: false, respuesta: AYUDA };
    }
    if (parseado.error) {
        return { ok: false, respuesta: `No pude calcular: ${parseado.error}\n\n${AYUDA}` };
    }

    const cuerpo = {
        origen: 'MANUAL',
        autonomiaDias: opciones.autonomiaDias ?? 1,
        tecnologiaBateria: 'LITIO',
        voltajeBancoV: 48,
        bateriaReferencia: { voltajeV: 48, capacidadAh: 100 },
        factorPotencia: 0.9
    };

    if (parseado.modo === 'equipos') {
        cuerpo.equipos = parseado.equipos;
    } else {
        cuerpo.consumoMensualKWh = Number((parseado.consumoDiarioKWh * 30).toFixed(3));
        cuerpo.diasDelMes = 30;
        cuerpo.cargaPicoKW = parseado.cargaPicoKW;
    }

    try {
        const calculo = calcularDimensionamiento(cuerpo, { user: { rol: 'cliente' } });
        let cotizacion = null;
        let avisoPresupuesto = null;

        if (Inventory.db?.readyState !== 1) {
            avisoPresupuesto = 'El inventario de Falcón no está conectado; el presupuesto queda pendiente.';
        } else {
            try {
                cotizacion = await cotizarCalculo(calculo.id);
            } catch (error) {
                avisoPresupuesto = error instanceof SolarError && error.code === 'SIN_STOCK_LOCAL'
                    ? 'No hay stock local suficiente para cubrir todo el sistema; el presupuesto queda pendiente.'
                    : 'No pude consultar el inventario de Falcón en este momento; el presupuesto queda pendiente.';
            }
        }

        return {
            ok: true,
            calculo,
            cotizacion,
            respuesta: formatearResumen(calculo, cotizacion, {
                advertencias: parseado.advertencias,
                avisoPresupuesto
            })
        };
    } catch (error) {
        return { ok: false, respuesta: `No pude calcular tu sistema.\n${mensajeLegible(error)}` };
    }
}

export function tokenTelegram() {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    return token || null;
}

export async function enviarMensaje(chatId, texto, token = tokenTelegram()) {
    if (!token) {
        return {
            ok: false,
            code: 'TELEGRAM_TOKEN_MISSING',
            mensaje: 'Falta TELEGRAM_BOT_TOKEN. El bot no puede responder hasta configurarlo.'
        };
    }
    if (!chatId) {
        return { ok: false, code: 'CHAT_ID_REQUERIDO', mensaje: 'No se indicó el chat de destino.' };
    }

    try {
        const respuesta = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: texto }),
            signal: AbortSignal.timeout(10000)
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok || datos.ok === false) {
            console.warn('[telegram] No se pudo enviar el mensaje:', datos.description ?? respuesta.status);
            return { ok: false, code: 'TELEGRAM_SEND_ERROR', mensaje: datos.description ?? 'Error al enviar el mensaje.' };
        }
        return { ok: true, mensajeId: datos.result?.message_id ?? null };
    } catch (error) {
        console.warn('[telegram] Fallo de red al enviar:', error?.message ?? error);
        return { ok: false, code: 'TELEGRAM_SEND_ERROR', mensaje: error?.message ?? 'Fallo de red.' };
    }
}

export async function procesarUpdate(update, token = tokenTelegram()) {
    try {
        const callback = update?.callback_query;
        if (callback) {
            await fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: callback.id, text: 'Datos recibidos.' }),
                signal: AbortSignal.timeout(5000)
            }).catch(() => {});
            return { procesado: true, tipo: 'callback' };
        }

        const mensaje = update?.message;
        if (!mensaje?.chat?.id) return { procesado: false, motivo: 'Sin mensaje de texto' };

        const texto = String(mensaje.text ?? '').trim();
        let respuesta;

        if (/^\/(start|ayuda|help)\b/i.test(texto)) {
            respuesta = ['¡Hola! Soy SolarParaguaná IA.', AYUDA].join('\n\n');
        } else if (!texto && mensaje.photo) {
            respuesta = 'Recibí la foto. Para el dimensionamiento, escríbeme el consumo en kWh o la lista de equipos. Las fotos se procesan en la web mediante POST /api/solar/ocr-parse.';
        } else if (!texto) {
            respuesta = AYUDA;
        } else {
            const resultado = await procesarSolicitud(texto);
            respuesta = resultado.respuesta;
        }

        const envio = await enviarMensaje(mensaje.chat.id, respuesta, token);
        return { procesado: true, tipo: 'mensaje', envio };
    } catch (error) {
        console.warn('[telegram] Error al procesar update:', error?.message ?? error);
        return { procesado: false, motivo: 'Error interno', detalle: error?.message ?? 'Desconocido' };
    }
}

export async function ejecutarHerramienta(nombre, argumentos = {}, contexto = {}) {
    const args = argumentos ?? {};

    if (nombre === 'calcular') {
        const opcionesCalculo = { user: { rol: 'cliente' } };
        try {
            let calculo;
            if (typeof args.ocrId === 'string' && args.ocrId.trim()) {
                calculo = calcularDimensionamiento({
                    origen: 'OCR',
                    ocrId: args.ocrId.trim(),
                    cargaPicoKW: args.cargaPicoKW
                }, opcionesCalculo);
            } else if (Array.isArray(args.equipos) && args.equipos.length > 0) {
                calculo = calcularDimensionamiento({
                    origen: 'MANUAL',
                    equipos: args.equipos,
                    cargaPicoKW: args.cargaPicoKW
                }, opcionesCalculo);
            } else if (args.consumoMensualKWh !== undefined && args.consumoMensualKWh !== null) {
                calculo = calcularDimensionamiento({
                    origen: 'MANUAL',
                    consumoMensualKWh: args.consumoMensualKWh,
                    diasDelMes: args.diasDelMes ?? 30,
                    cargaPicoKW: args.cargaPicoKW
                }, opcionesCalculo);
            } else {
                const resultado = await procesarSolicitud(args.texto ?? '', contexto);
                return {
                    herramienta: nombre,
                    resultado: resultado.calculo ?? null,
                    mensajeTelegram: resultado.respuesta
                };
            }
            return {
                herramienta: nombre,
                resultado: calculo,
                mensajeTelegram:
                    `Cálculo ${calculo.id}: ${calculo.consumo.diarioKWh} kWh/día, ` +
                    `${calculo.calculation.totalPanels} paneles de 550 W e inversor ` +
                    `${calculo.calculation.recommendedInverterKva} kVA.`
            };
        } catch (error) {
            return { herramienta: nombre, resultado: null, mensajeTelegram: mensajeLegible(error) };
        }
    }
    if (nombre === 'cotizar') {
        try {
            const cotizacion = await cotizarCalculo(args.calculoId);
            return {
                herramienta: nombre,
                resultado: cotizacion,
                mensajeTelegram: `Cotización ${cotizacion.id} emitida por ${etiquetaMonto(cotizacion.presupuesto)}.`
            };
        } catch (error) {
            return { herramienta: nombre, resultado: null, mensajeTelegram: mensajeLegible(error) };
        }
    }
    if (nombre === 'consultar_stock') {
        try {
            if (Inventory.db?.readyState !== 1) {
                return {
                    herramienta: nombre,
                    resultado: [],
                    mensajeTelegram: 'El inventario local no está conectado en este momento.'
                };
            }

            const filtro = {};
            if (args.tipo) filtro.categoria = String(args.tipo);
            if (args.almacen) {
                if (!ALMACENES.includes(args.almacen)) {
                    return {
                        herramienta: nombre,
                        resultado: null,
                        mensajeTelegram: 'El almacén indicado no existe. Use Coro o Punto Fijo.'
                    };
                }
                filtro.almacenes = [args.almacen];
            }
            const items = await Inventory.findDisponibles(filtro);
            return {
                herramienta: nombre,
                resultado: items,
                mensajeTelegram: `Hay ${items.length} referencias disponibles en los almacenes locales.`
            };
        } catch (error) {
            return {
                herramienta: nombre,
                resultado: null,
                mensajeTelegram: 'No pude consultar el inventario local. Intente de nuevo en unos segundos.'
            };
        }
    }
    if (nombre === 'extraer_ocr' || nombre === 'confirmar_ocr') {
        return {
            herramienta: nombre,
            resultado: null,
            mensajeTelegram: 'El flujo OCR se gestiona desde la web: POST /api/solar/ocr-parse y POST /api/solar/ocr-confirm.'
        };
    }
    return {
        herramienta: nombre,
        resultado: null,
        mensajeTelegram: `No conozco la herramienta "${nombre}". Las disponibles son: ${HERRAMIENTAS.map((h) => h.nombre).join(', ')}.`
    };
}

function autorizado(req) {
    const tokenServicio = process.env.MCP_SERVICE_TOKEN?.trim();
    if (!tokenServicio) return { ok: true, modo: 'sin_token' };
    const cabecera = req.get('authorization') ?? '';
    return cabecera === `Bearer ${tokenServicio}`
        ? { ok: true, modo: 'token' }
        : { ok: false, modo: 'token' };
}

export function createTelegramRouter() {
    const router = Router();

    router.get('/health', (req, res) => {
        const token = tokenTelegram();
        return res.status(200).json({
            status: token ? 'ok' : 'degraded',
            version: VERSION,
            updatesPendientes: 0,
            detalle: token ? 'Conector listo.' : 'Falta TELEGRAM_BOT_TOKEN; el resto del servidor sigue activo.'
        });
    });

    router.get('/mcp/tools', (req, res) => {
        const acceso = autorizado(req);
        if (!acceso.ok) {
            return responderErrorLegible(
                res,
                401,
                'MCP_TOKEN_INVALIDO',
                'No tiene acceso al registro de herramientas.',
                'Envíe Authorization: Bearer <MCP_SERVICE_TOKEN>.'
            );
        }
        return res.status(200).json({ herramientas: HERRAMIENTAS, modo: acceso.modo });
    });

    router.post('/mcp/tools/:nombre', async (req, res) => {
        const acceso = autorizado(req);
        if (!acceso.ok) {
            return responderErrorLegible(
                res,
                401,
                'MCP_TOKEN_INVALIDO',
                'No tiene permiso para ejecutar herramientas.',
                'Envíe Authorization: Bearer <MCP_SERVICE_TOKEN>.'
            );
        }
        const resultado = await ejecutarHerramienta(
            req.params.nombre,
            req.body?.argumentos ?? {},
            { usuarioId: req.body?.usuarioId }
        );
        if (req.body?.chatId) await enviarMensaje(req.body.chatId, resultado.mensajeTelegram);
        return res.status(200).json(resultado);
    });

    router.post('/webhook', (req, res) => {
        const secreto = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
        if (secreto && req.get('x-telegram-bot-api-secret-token') !== secreto) {
            return responderErrorLegible(
                res,
                401,
                'WEBHOOK_SECRETO_INVALIDO',
                'La cabecera de seguridad del webhook no coincide.',
                'Configure X-Telegram-Bot-Api-Secret-Token con TELEGRAM_WEBHOOK_SECRET.'
            );
        }

        res.status(200).json({ ok: true });
        setImmediate(() => {
            procesarUpdate(req.body).catch((error) => {
                console.warn('[telegram] Fallo asíncrono en webhook:', error?.message ?? error);
            });
        });
        return undefined;
    });

    return router;
}

export function startTelegramPolling() {
    const token = tokenTelegram();
    if (!token) {
        console.warn('[telegram] TELEGRAM_BOT_TOKEN no configurado: el bot queda desactivado, el servidor continúa activo.');
        return { started: false, reason: 'TELEGRAM_TOKEN_MISSING' };
    }

    let offset = 0;
    let activo = true;
    const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

    const ciclo = async () => {
        while (activo) {
            try {
                const respuesta = await fetch(
                    `${TELEGRAM_API}/bot${token}/getUpdates?offset=${offset}&timeout=10`,
                    { signal: AbortSignal.timeout(15000) }
                );
                const datos = await respuesta.json().catch(() => ({}));
                if (!respuesta.ok || datos.ok === false) {
                    throw new Error(datos.description ?? `HTTP ${respuesta.status}`);
                }
                for (const update of datos.result ?? []) {
                    offset = Math.max(offset, update.update_id + 1);
                    await procesarUpdate(update, token);
                }
            } catch (error) {
                console.warn('[telegram] Error en long polling:', error?.message ?? error);
                await esperar(3000);
            }
            await esperar(500);
        }
    };

    ciclo().catch((error) => {
        console.warn('[telegram] El ciclo de polling terminó:', error?.message ?? error);
    });

    console.log('[telegram] Bot iniciado en modo long polling.');
    return { started: true, stop: () => { activo = false; } };
}

export default createTelegramRouter;
