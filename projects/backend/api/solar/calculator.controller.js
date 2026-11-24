import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Inventory, { ALMACENES, CATEGORIAS } from './inventory.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const CONSTANTES = Object.freeze({
    hsp: 6.0,
    eficienciaGlobal: 0.80,
    factorSeguridadInversor: 1.25,
    panelWp: 550,
    factorArranqueMotor: 3,
    factorPotenciaPorDefecto: 0.90,
    autonomiaDiasPorDefecto: 1,
    voltajeBancoPorDefecto: 48,
    bateriaReferenciaPorDefecto: Object.freeze({ voltajeV: 12, capacidadAh: 200 }),
    dodPorTecnologia: Object.freeze({ LITIO: 0.80, GEL_AGM: 0.50 }),
    umbralConfianzaOCR: 0.85,
    tamanoMaximoImagenBytes: 10 * 1024 * 1024,
    formatosImagen: Object.freeze({
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
    })
});

const RANGOS_SOBREESCRITURA = Object.freeze({
    hsp: [3.0, 7.0],
    eficienciaGlobal: [0.60, 0.95],
    factorSeguridadInversor: [1.00, 1.50]
});

const borradoresOCR = new Map();
const calculosGuardados = new Map();

const esNumero = (valor) => typeof valor === 'number' && Number.isFinite(valor);
const esPositivo = (valor) => esNumero(valor) && valor > 0;
const redondear = (valor, decimales = 3) => Number(valor.toFixed(decimales));

function responderError(res, status, code, message, suggestion, details = []) {
    return res.status(status).json({
        error: {
            code,
            message,
            suggestion,
            details,
            traceId: `tr_${randomUUID()}`
        }
    });
}

export class SolarError extends Error {
    constructor(status, code, message, suggestion, details = []) {
        super(message);
        this.name = 'SolarError';
        this.status = status;
        this.code = code;
        this.suggestion = suggestion;
        this.details = details;
    }
}

function responderErrorDesdeExcepcion(res, error) {
    if (error instanceof SolarError) {
        return responderError(res, error.status, error.code, error.message, error.suggestion, error.details);
    }
    return responderError(
        res,
        500,
        'INTERNAL_ERROR',
        'Ocurrió un problema al procesar la solicitud.',
        'Intente de nuevo en unos segundos o contacte al administrador.'
    );
}

function normalizarTexto(texto) {
    return String(texto ?? '').replace(/\s+/g, ' ').trim();
}

function aNumero(valor) {
    const numero = Number(String(valor).replace(',', '.'));
    return Number.isFinite(numero) ? numero : null;
}

function extraerCampos(texto) {
    const patrones = {
        potenciaW: {
            etiquetados: [
                /(?:potencia|watts?|watt)\s*[:=]?\s*(\d{1,5}(?:[.,]\d{1,2})?)\s*w\b/i,
                /\bpotencia\s*[:=]?\s*(\d{1,5}(?:[.,]\d{1,2})?)/i
            ],
            genericos: [/\b(\d{1,5}(?:[.,]\d{1,2})?)\s*w(?:atts?)?\b/i]
        },
        horasDia: {
            etiquetados: [
                /(?:horas?|hrs?|horas\s+de\s+uso|h\/d[ií]a)\s*[:=]?\s*(\d{1,2}(?:[.,]\d{1,2})?)/i
            ],
            genericos: [/\b(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:h|hrs?)(?:\/d[ií]a)?\b/i]
        },
        voltajeV: {
            etiquetados: [/(?:voltaje|volts?)\s*[:=]?\s*(\d{2,3})\s*v\b/i],
            genericos: [/\b(\d{2,3})\s*v\b/i]
        }
    };

    const extraidos = {};
    Object.entries(patrones).forEach(([campo, grupos]) => {
        let encontrado = null;
        for (const patron of grupos.etiquetados) {
            const coincidencia = texto.match(patron);
            if (coincidencia) {
                encontrado = { valor: aNumero(coincidencia[1]), confianza: 0.88 };
                break;
            }
        }
        if (!encontrado) {
            for (const patron of grupos.genericos) {
                const coincidencia = texto.match(patron);
                if (coincidencia) {
                    encontrado = { valor: aNumero(coincidencia[1]), confianza: 0.72 };
                    break;
                }
            }
        }
        extraidos[campo] = encontrado ?? { valor: null, confianza: 0 };
    });
    return extraidos;
}

function construirCamposOCR(extraidos) {
    return Object.entries(extraidos).map(([campo, { valor, confianza }]) => {
        let requiereRevision = confianza < CONSTANTES.umbralConfianzaOCR || valor === null;
        if (campo === 'potenciaW' && (!esNumero(valor) || valor < 1 || valor > 10000)) requiereRevision = true;
        if (campo === 'horasDia' && (!esNumero(valor) || valor <= 0 || valor > 24)) requiereRevision = true;
        if (campo === 'voltajeV' && valor !== null && (!esNumero(valor) || valor < 110 || valor > 240)) {
            requiereRevision = true;
        }
        return { campo, valor, confianza, requiereRevision };
    });
}

function validarCuerpo(body, req) {
    const detalles = [];
    const agregar = (field, message) => detalles.push({ field, message });

    const origen = body.origen ?? 'MANUAL';
    if (!['MANUAL', 'OCR'].includes(origen)) {
        agregar('origen', 'Use MANUAL u OCR.');
    }
    if (origen === 'OCR' && (typeof body.ocrId !== 'string' || body.ocrId.trim() === '')) {
        agregar('ocrId', 'Indique el identificador del borrador OCR confirmado.');
    }

    const tieneEquipos = Array.isArray(body.equipos) && body.equipos.length > 0;
    const tieneFactura = esPositivo(body.consumoMensualKWh);

    if (tieneEquipos === tieneFactura) {
        agregar(
            'equipos / consumoMensualKWh',
            'Envíe una lista de equipos o el consumo mensual de la factura, pero no ambos.'
        );
    }

    if (tieneEquipos) {
        body.equipos.forEach((equipo, indice) => {
            const prefijo = `equipos[${indice}]`;
            if (!esNumero(equipo?.potenciaW) || equipo.potenciaW < 1 || equipo.potenciaW > 10000) {
                agregar(`${prefijo}.potenciaW`, 'Use un valor entre 1 y 10000 vatios.');
            }
            if (!esNumero(equipo?.horasDia) || equipo.horasDia <= 0 || equipo.horasDia > 24) {
                agregar(`${prefijo}.horasDia`, 'Use un valor mayor que cero y menor o igual que 24 horas.');
            }
            if (!esNumero(equipo?.voltajeV) || equipo.voltajeV < 110 || equipo.voltajeV > 240) {
                agregar(`${prefijo}.voltajeV`, 'Use un voltaje entre 110 y 240 V.');
            }
            if (equipo?.tipo && !['GENERAL', 'MOTOR'].includes(equipo.tipo)) {
                agregar(`${prefijo}.tipo`, 'Use GENERAL o MOTOR.');
            }
        });
    }

    if (tieneFactura) {
        if (!Number.isInteger(body.diasDelMes) || body.diasDelMes < 1 || body.diasDelMes > 31) {
            agregar('diasDelMes', 'Indique un número entero entre 1 y 31.');
        }
        if (!esPositivo(body.cargaPicoKW)) {
            agregar('cargaPicoKW', 'Con consumo de factura se requiere la carga pico en kW para dimensionar el inversor.');
        }
    }

    if (body.cargaPicoKW !== undefined && !esPositivo(body.cargaPicoKW)) {
        agregar('cargaPicoKW', 'Use un valor mayor que cero en kW.');
    }

    const factorPotencia = body.factorPotencia ?? CONSTANTES.factorPotenciaPorDefecto;
    if (!esNumero(factorPotencia) || factorPotencia < 0.80 || factorPotencia > 1.00) {
        agregar('factorPotencia', 'Use un factor de potencia entre 0.80 y 1.00.');
    }

    const autonomiaDias = body.autonomiaDias ?? CONSTANTES.autonomiaDiasPorDefecto;
    if (!Number.isInteger(autonomiaDias) || autonomiaDias < 1 || autonomiaDias > 3) {
        agregar('autonomiaDias', 'Use un entero entre 1 y 3 días.');
    }

    const tecnologia = body.tecnologiaBateria ?? 'LITIO';
    if (!Object.hasOwn(CONSTANTES.dodPorTecnologia, tecnologia)) {
        agregar('tecnologiaBateria', 'Use LITIO o GEL_AGM.');
    }

    if (body.dod !== undefined) {
        const dodMaximo = CONSTANTES.dodPorTecnologia[tecnologia] ?? CONSTANTES.dodPorTecnologia.LITIO;
        if (!esPositivo(body.dod) || body.dod > dodMaximo) {
            agregar('dod', `Use un DoD mayor que cero y menor o igual que ${dodMaximo} para ${tecnologia}.`);
        }
    }

    const voltajeBancoV = body.voltajeBancoV ?? CONSTANTES.voltajeBancoPorDefecto;
    if (![12, 24, 48].includes(voltajeBancoV)) {
        agregar('voltajeBancoV', 'Use 12, 24 o 48 V.');
    }

    const bateria = body.bateriaReferencia ?? CONSTANTES.bateriaReferenciaPorDefecto;
    if (!esPositivo(bateria?.voltajeV) || !esPositivo(bateria?.capacidadAh)) {
        agregar('bateriaReferencia', 'Indique voltajeV y capacidadAh mayores que cero.');
    } else if (!Number.isInteger(voltajeBancoV / bateria.voltajeV)) {
        agregar(
            'bateriaReferencia.voltajeV',
            `El voltaje de la batería debe dividir exactamente el banco de ${voltajeBancoV} V (por ejemplo 12 V).`
        );
    }

    if (body.constantes !== undefined) {
        if (!body.constantes || typeof body.constantes !== 'object' || Array.isArray(body.constantes)) {
            agregar('constantes', 'Envíe un objeto con las constantes a sobreescribir.');
        } else {
            if (!['tecnico', 'admin'].includes(req.user?.rol)) {
                agregar('constantes', 'Solo un técnico o administrador puede sobreescribir constantes.');
            }
            Object.entries(body.constantes).forEach(([clave, valor]) => {
                const rango = RANGOS_SOBREESCRITURA[clave];
                if (!rango) {
                    agregar(`constantes.${clave}`, 'Constante no editable.');
                    return;
                }
                if (!esNumero(valor) || valor < rango[0] || valor > rango[1]) {
                    agregar(`constantes.${clave}`, `Use un valor entre ${rango[0]} y ${rango[1]}.`);
                }
            });
        }
    }

    return detalles;
}

export const getConstants = (req, res) => {
    return res.status(200).json({
        hsp: CONSTANTES.hsp,
        eficienciaGlobal: CONSTANTES.eficienciaGlobal,
        factorSeguridadInversor: CONSTANTES.factorSeguridadInversor,
        panelReferenciaWp: CONSTANTES.panelWp,
        factorArranqueMotor: CONSTANTES.factorArranqueMotor,
        umbralConfianzaOCR: CONSTANTES.umbralConfianzaOCR,
        parametrosPorDefecto: {
            factorPotencia: CONSTANTES.factorPotenciaPorDefecto,
            autonomiaDias: CONSTANTES.autonomiaDiasPorDefecto,
            voltajeBancoV: CONSTANTES.voltajeBancoPorDefecto
        }
    });
};

export const parsearOCR = async (req, res) => {
    let archivo = req.files?.imagen ?? req.files?.file ?? req.files?.image;
    if (Array.isArray(archivo)) archivo = archivo[0];

    if (!archivo) {
        return responderError(
            res,
            400,
            'ARCHIVO_REQUERIDO',
            'No recibimos la imagen de la etiqueta o factura.',
            'Envíe la imagen en el campo imagen con multipart/form-data.'
        );
    }

    const extension = CONSTANTES.formatosImagen[archivo.mimetype];
    if (!extension) {
        return responderError(
            res,
            415,
            'FORMATO_NO_SOPORTADO',
            'El formato de la imagen no es compatible.',
            'Use una imagen JPEG, PNG o WebP.'
        );
    }

    if (archivo.size > CONSTANTES.tamanoMaximoImagenBytes || archivo.truncated) {
        return responderError(
            res,
            413,
            'IMAGEN_MUY_GRANDE',
            'La imagen supera el tamaño permitido.',
            'Envíe una imagen de 10 MB o menos.'
        );
    }

    const id = `ocr_${randomUUID().slice(0, 8)}`;
    const nombreArchivo = `${id}.${extension}`;
    const destino = path.join(__dirname, '../../uploads/images', nombreArchivo);

    try {
        await fs.mkdir(path.dirname(destino), { recursive: true });
        await archivo.mv(destino);
    } catch (error) {
        return responderError(
            res,
            500,
            'ERROR_GUARDANDO_IMAGEN',
            'No pudimos guardar la imagen recibida.',
            'Intente de nuevo en unos segundos o contacte al administrador.'
        );
    }

    const texto = normalizarTexto(`${req.body?.texto ?? ''} ${path.basename(archivo.name ?? '')}`);
    const campos = construirCamposOCR(extraerCampos(texto));

    const borrador = {
        id,
        estado: 'pendiente_confirmacion',
        imagenUrl: `/uploads/images/${nombreArchivo}`,
        umbralConfianza: CONSTANTES.umbralConfianzaOCR,
        campos,
        creadoEn: new Date().toISOString()
    };
    borradoresOCR.set(id, borrador);

    return res.status(201).json({
        ...borrador,
        sugerencia: 'Revise los campos extraídos, corrija los que estén marcados y confirme antes de calcular.'
    });
};

export const confirmarOCR = (req, res) => {
    const id = req.body?.ocrId ?? req.params?.id;
    const borrador = borradoresOCR.get(id);

    if (!borrador) {
        return responderError(
            res,
            404,
            'OCR_NO_ENCONTRADO',
            'No encontramos el borrador OCR indicado.',
            'Vuelva a subir la imagen con POST /api/solar/ocr-parse.'
        );
    }
    if (req.body?.confirmado === false) {
        return responderError(
            res,
            422,
            'OCR_NO_CONFIRMADO',
            'El borrador no fue confirmado.',
            'Envíe confirmado: true junto con los campos revisados para continuar.'
        );
    }
    if (borrador.estado === 'confirmado') {
        return responderError(
            res,
            409,
            'OCR_YA_CONFIRMADO',
            'Este borrador ya fue confirmado.',
            'Use el ocrId confirmado para ejecutar el cálculo.'
        );
    }

    const camposEnviados = Array.isArray(req.body?.campos) ? req.body.campos : borrador.campos;
    const camposConfirmados = {};
    const detalles = [];

    camposEnviados.forEach((campo) => {
        const valor = campo?.valor;
        if (campo?.campo === 'potenciaW') {
            if (!esNumero(valor) || valor < 1 || valor > 10000) {
                detalles.push({ field: 'potenciaW', message: 'Use un valor entre 1 y 10000 vatios.' });
            } else {
                camposConfirmados.potenciaW = valor;
            }
        }
        if (campo?.campo === 'horasDia') {
            if (!esNumero(valor) || valor <= 0 || valor > 24) {
                detalles.push({ field: 'horasDia', message: 'Use un valor mayor que cero y menor o igual que 24 horas.' });
            } else {
                camposConfirmados.horasDia = valor;
            }
        }
        if (campo?.campo === 'voltajeV' && valor !== null && valor !== undefined) {
            if (!esNumero(valor) || valor < 110 || valor > 240) {
                detalles.push({ field: 'voltajeV', message: 'Use un voltaje entre 110 y 240 V.' });
            } else {
                camposConfirmados.voltajeV = valor;
            }
        }
    });

    if (!esNumero(camposConfirmados.potenciaW)) {
        detalles.push({ field: 'potenciaW', message: 'La potencia confirmada es obligatoria.' });
    }
    if (!esNumero(camposConfirmados.horasDia)) {
        detalles.push({ field: 'horasDia', message: 'Las horas de uso confirmadas son obligatorias.' });
    }

    if (detalles.length > 0) {
        return responderError(
            res,
            422,
            'CAMPOS_OCR_INVALIDOS',
            'Los datos confirmados del OCR no son válidos.',
            'Corrija los campos indicados y confirme nuevamente.',
            detalles
        );
    }

    borrador.estado = 'confirmado';
    borrador.camposConfirmados = camposConfirmados;
    borrador.confirmadoEn = new Date().toISOString();

    return res.status(200).json({
        id: borrador.id,
        estado: borrador.estado,
        camposConfirmados,
        confirmadoEn: borrador.confirmadoEn,
        sugerencia: 'Ya puede ejecutar POST /api/energy/calculate con origen OCR y este ocrId.'
    });
};

function prepararCuerpoCalculo(body, req) {
    const origen = body.origen ?? 'MANUAL';
    let cuerpo = body;

    if (origen === 'OCR') {
        if (typeof body.ocrId !== 'string' || body.ocrId.trim() === '') {
            throw new SolarError(
                422,
                'OCR_ID_REQUERIDO',
                'Falta el identificador del borrador OCR.',
                'Ejecute POST /api/solar/ocr-parse y confirme los campos antes de calcular.'
            );
        }
        const borrador = borradoresOCR.get(body.ocrId);
        if (!borrador) {
            throw new SolarError(
                404,
                'OCR_NO_ENCONTRADO',
                'No encontramos el borrador OCR indicado.',
                'Vuelva a subir la imagen y confirme los datos antes de calcular.'
            );
        }
        if (borrador.estado !== 'confirmado') {
            throw new SolarError(
                422,
                'OCR_PENDIENTE_CONFIRMACION',
                'Los datos del OCR todavía no fueron confirmados.',
                'Revise los campos extraídos, confírmelos y vuelva a enviar el cálculo.'
            );
        }
        cuerpo = {
            ...body,
            equipos: body.equipos ?? [
                {
                    nombre: 'Equipo detectado por OCR',
                    potenciaW: borrador.camposConfirmados.potenciaW,
                    horasDia: borrador.camposConfirmados.horasDia,
                    voltajeV: borrador.camposConfirmados.voltajeV ?? 120,
                    tipo: 'GENERAL'
                }
            ]
        };
    }
    return cuerpo;
}

export function calcularDimensionamiento(body, req = {}) {
    const cuerpo = prepararCuerpoCalculo(body, req);
    const detalles = validarCuerpo(cuerpo, req);
    if (detalles.length > 0) {
        throw new SolarError(
            400,
            'VALIDATION_ERROR',
            'No pudimos calcular el sistema con los datos recibidos.',
            'Corrija los campos indicados y vuelva a intentarlo.',
            detalles
        );
    }

    const origen = cuerpo.origen ?? 'MANUAL';
    const constantes = { ...CONSTANTES, ...(cuerpo.constantes ?? {}) };
    const tieneEquipos = Array.isArray(cuerpo.equipos) && cuerpo.equipos.length > 0;
    const factorPotencia = cuerpo.factorPotencia ?? constantes.factorPotenciaPorDefecto;
    const autonomiaDias = cuerpo.autonomiaDias ?? constantes.autonomiaDiasPorDefecto;
    const voltajeBancoV = cuerpo.voltajeBancoV ?? constantes.voltajeBancoPorDefecto;
    const tecnologia = cuerpo.tecnologiaBateria ?? 'LITIO';
    const dod = cuerpo.dod ?? constantes.dodPorTecnologia[tecnologia];
    const bateria = cuerpo.bateriaReferencia ?? constantes.bateriaReferenciaPorDefecto;

    let consumoDiarioKWh;
    let metodoConsumo;
    if (tieneEquipos) {
        consumoDiarioKWh = cuerpo.equipos.reduce(
            (total, equipo) => total + equipo.potenciaW * equipo.horasDia,
            0
        ) / 1000;
        metodoConsumo = 'equipos';
    } else {
        consumoDiarioKWh = cuerpo.consumoMensualKWh / cuerpo.diasDelMes;
        metodoConsumo = 'factura';
    }

    if (consumoDiarioKWh < 0.1 || consumoDiarioKWh > 1000) {
        throw new SolarError(
            400,
            'VALIDATION_ERROR',
            'El consumo diario calculado está fuera del rango atendible.',
            'Verifique las horas de uso o el consumo mensual; el rango permitido es 0.1 a 1000 kWh/día.'
        );
    }

    const motores = tieneEquipos
        ? cuerpo.equipos.filter((equipo) => (equipo.tipo ?? 'GENERAL') === 'MOTOR')
        : [];
    const cargaContinuaKW = tieneEquipos
        ? cuerpo.equipos
              .filter((equipo) => (equipo.tipo ?? 'GENERAL') !== 'MOTOR')
              .reduce((total, equipo) => total + equipo.potenciaW, 0) / 1000
        : 0;
    const cargaMotoresKW = motores.reduce((total, equipo) => total + equipo.potenciaW, 0) / 1000;
    const picoDerivadoKW = cargaContinuaKW + cargaMotoresKW * constantes.factorArranqueMotor;
    const cargaPicoKW = esPositivo(cuerpo.cargaPicoKW) ? cuerpo.cargaPicoKW : picoDerivadoKW;

    const generacionRequeridaKWh = consumoDiarioKWh / constantes.eficienciaGlobal;
    const potenciaArrayKWp = generacionRequeridaKWh / constantes.hsp;
    const cantidadPaneles = Math.ceil(potenciaArrayKWp / (constantes.panelWp / 1000));

    const potenciaInversorKW = cargaPicoKW * constantes.factorSeguridadInversor;
    const capacidadInversorKVA = potenciaInversorKW / factorPotencia;

    const energiaRequeridaKWh = consumoDiarioKWh * autonomiaDias;
    const energiaNominalKWh = energiaRequeridaKWh / (dod * constantes.eficienciaGlobal);
    const capacidadBancoAh = (energiaNominalKWh * 1000) / voltajeBancoV;
    const unidadesSerie = voltajeBancoV / bateria.voltajeV;
    const unidadesParalelo = Math.ceil(capacidadBancoAh / bateria.capacidadAh);
    const totalUnidades = unidadesSerie * unidadesParalelo;

    const calculo = {
        id: `calc_${randomUUID().slice(0, 8)}`,
        estado: 'calculado',
        status: 'ok',
        consumo: {
            diarioKWh: redondear(consumoDiarioKWh),
            metodo: metodoConsumo
        },
        generacion: {
            requeridaKWhDia: redondear(generacionRequeridaKWh),
            potenciaArrayKWp: redondear(potenciaArrayKWp)
        },
        paneles: {
            potenciaUnitariaWp: constantes.panelWp,
            cantidad: cantidadPaneles
        },
        inversor: {
            cargaPicoUsadaKW: redondear(cargaPicoKW),
            picosArranqueAplicados: motores.length > 0 && cuerpo.cargaPicoKW === undefined,
            potenciaNecesariaKW: redondear(potenciaInversorKW),
            capacidadRequeridaKVA: redondear(capacidadInversorKVA, 2),
            factorPotenciaUsado: factorPotencia
        },
        bancoBaterias: {
            tecnologia,
            dod,
            autonomiaDias,
            energiaRequeridaKWh: redondear(energiaRequeridaKWh),
            energiaNominalKWh: redondear(energiaNominalKWh),
            capacidadRequeridaAh: redondear(capacidadBancoAh),
            voltajeBancoV,
            referencia: {
                voltajeV: bateria.voltajeV,
                capacidadAh: bateria.capacidadAh
            },
            configuracion: {
                unidadesSerie,
                unidadesParalelo,
                totalUnidades
            }
        },
        // Bloque compatible con el contrato del Manual Maestro (subprompt 0.1.1)
        calculation: {
            totalKwhDay: redondear(consumoDiarioKWh),
            recommendedInverterKva: redondear(capacidadInversorKVA, 2),
            totalPanels: cantidadPaneles,
            batteryBankAh: redondear(capacidadBancoAh)
        },
        localQuote: null,
        auditoria: {
            origen,
            ocrId: origen === 'OCR' ? cuerpo.ocrId : null,
            constantesUsadas: {
                hsp: constantes.hsp,
                eficienciaGlobal: constantes.eficienciaGlobal,
                factorSeguridadInversor: constantes.factorSeguridadInversor,
                panelWp: constantes.panelWp,
                factorArranqueMotor: constantes.factorArranqueMotor
            },
            formulas: {
                consumoDiario: 'Σ(P_i × h_i) / 1000',
                generacion: 'E_d / η',
                potenciaArray: 'E_gen / HSP',
                paneles: 'ceil(P_array / 0.550)',
                inversorKW: 'Carga pico (kW) × 1.25',
                inversorKVA: 'kW / FP',
                bateria: 'E_d × autonomía / (DoD × η)'
            }
        },
        siguientePaso: {
            cotizable: true,
            accion: 'POST /api/solar/quote'
        }
    };

    calculosGuardados.set(calculo.id, calculo);
    return calculo;
}

export const calculate = (req, res) => {
    try {
        return res.status(200).json(calcularDimensionamiento(req.body ?? {}, req));
    } catch (error) {
        return responderErrorDesdeExcepcion(res, error);
    }
};

async function seleccionarEquipos(calculo) {
    const requerimientos = [
        {
            tipo: 'panel',
            filtro: {
                categoria: 'panel',
                'capacidad.unidad': 'Wp',
                'capacidad.valor': { $gte: calculo.paneles.potenciaUnitariaWp }
            },
            cantidad: calculo.paneles.cantidad
        },
        {
            tipo: 'inversor',
            filtro: {
                categoria: 'inversor',
                'capacidad.unidad': 'kVA',
                'capacidad.valor': { $gte: calculo.inversor.capacidadRequeridaKVA }
            },
            cantidad: 1
        },
        {
            tipo: 'bateria',
            filtro: {
                categoria: 'bateria',
                'capacidad.unidad': 'Ah',
                'capacidad.valor': { $gte: calculo.bancoBaterias.referencia.capacidadAh },
                voltajeNominalV: calculo.bancoBaterias.referencia.voltajeV
            },
            cantidad: calculo.bancoBaterias.configuracion.totalUnidades
        }
    ];

    const seleccion = [];
    for (const requerimiento of requerimientos) {
        const items = await Inventory.findDisponibles(requerimiento.filtro);
        const grupos = Inventory.agruparPorEquipo(items);
        const grupo = grupos.find((candidato) => candidato.totalStock >= requerimiento.cantidad);

        if (!grupo) {
            seleccion.push({
                tipo: requerimiento.tipo,
                marca: null,
                modelo: null,
                cantidad: requerimiento.cantidad,
                disponible: grupos.reduce((total, candidato) => total + candidato.totalStock, 0),
                precio: { monto: 0, moneda: 'USD' },
                almacenes: [],
                suficiente: false
            });
            continue;
        }

        seleccion.push({
            tipo: requerimiento.tipo,
            sku: grupo.sku,
            marca: grupo.marca,
            modelo: grupo.modelo,
            capacidad: grupo.capacidad,
            cantidad: requerimiento.cantidad,
            disponible: grupo.totalStock,
            precio: grupo.precio,
            almacenes: grupo.almacenes,
            suficiente: true
        });
    }
    return seleccion;
}

export async function cotizarCalculo(calculoId) {
    const calculo = calculosGuardados.get(calculoId);

    if (!calculo) {
        throw new SolarError(
            404,
            'CALCULO_NO_ENCONTRADO',
            'No encontramos el cálculo indicado.',
            'Ejecute POST /api/energy/calculate y use el calc_ devuelto.'
        );
    }

    const seleccion = await seleccionarEquipos(calculo);
    const insuficientes = seleccion.filter((item) => !item.suficiente);

    if (insuficientes.length > 0) {
        const detalles = insuficientes.map((item) => ({
            field: item.tipo,
            message: `Se requieren ${item.cantidad} unidades y hay ${item.disponible} disponibles en Coro o Punto Fijo.`
        }));
        throw new SolarError(
            409,
            'SIN_STOCK_LOCAL',
            'No hay stock local suficiente para cubrir el dimensionamiento.',
            'Revise el inventario de Coro y Punto Fijo, ajuste cantidades o autorice una alternativa equivalente.',
            detalles
        );
    }

    const monedas = [...new Set(seleccion.map((item) => item.precio.moneda))];
    if (monedas.length > 1) {
        throw new SolarError(
            409,
            'MONEDA_MIXTA',
            'Los equipos seleccionados tienen monedas distintas.',
            'Unifique la moneda del inventario antes de emitir la cotización.'
        );
    }

    const moneda = monedas[0] ?? 'USD';
    const total = seleccion.reduce((suma, item) => suma + item.precio.monto * item.cantidad, 0);
    const vigencia = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const cotizacion = {
        id: `cot_${randomUUID().slice(0, 8)}`,
        estado: 'emitida',
        calculoId,
        vigencia,
        almacenes: ALMACENES,
        items: seleccion.map((item) => ({
            tipo: item.tipo,
            sku: item.sku ?? null,
            marca: item.marca,
            modelo: item.modelo,
            capacidad: item.capacidad,
            cantidad: item.cantidad,
            precioUnitario: { ...item.precio },
            subtotal: { monto: redondear(item.precio.monto * item.cantidad, 2), moneda: item.precio.moneda },
            almacenes: item.almacenes
        })),
        presupuesto: {
            monto: redondear(total, 2),
            moneda
        },
        cotizable: true,
        observaciones: []
    };
    return cotizacion;
}

export const cotizar = async (req, res) => {
    try {
        return res.status(201).json(await cotizarCalculo(req.body?.calculoId));
    } catch (error) {
        if (error instanceof SolarError) {
            return responderErrorDesdeExcepcion(res, error);
        }
        return responderError(
            res,
            500,
            'INTERNAL_ERROR',
            'No pudimos consultar el inventario para generar el presupuesto.',
            'Intente de nuevo en unos segundos o contacte al administrador.'
        );
    }
};

export const listarInventario = async (req, res) => {
    try {
        const { almacen, tipo } = req.query;
        const soloDisponible = req.query.soloDisponible !== 'false';

        if (almacen && !ALMACENES.includes(almacen)) {
            return responderError(
                res,
                400,
                'VALIDATION_ERROR',
                'El almacén indicado no está disponible.',
                'Use Coro o Punto Fijo.'
            );
        }
        if (tipo && !CATEGORIAS.includes(tipo)) {
            return responderError(
                res,
                400,
                'VALIDATION_ERROR',
                'La categoría indicada no existe.',
                'Use panel, inversor, bateria o accesorio.'
            );
        }

        const filtro = { vigente: true };
        if (almacen) filtro['stock.almacen'] = almacen;
        if (tipo) filtro.categoria = tipo;
        if (soloDisponible) filtro['stock.disponible'] = { $gt: 0 };

        const items = await Inventory.find(filtro).lean();

        return res.status(200).json({
            almacenes: ALMACENES,
            items: items.map((item) => ({
                sku: item.sku,
                tipo: item.categoria,
                modelo: `${item.marca} ${item.modelo}`,
                potenciaWp: item.categoria === 'panel' ? item.capacidad.valor : null,
                capacidadKVA: item.categoria === 'inversor' ? item.capacidad.valor : null,
                capacidadAh: item.categoria === 'bateria' ? item.capacidad.valor : null,
                stock: {
                    almacen: item.stock.almacen,
                    disponible: item.stock.disponible
                },
                disponible: item.vigente && item.stock.disponible > 0,
                precio: {
                    monto: item.precio.monto,
                    moneda: item.precio.moneda
                },
                vigente: item.vigente
            }))
        });
    } catch (error) {
        return responderError(
            res,
            500,
            'INTERNAL_ERROR',
            'No pudimos consultar el inventario local en este momento.',
            'Intente de nuevo en unos segundos o contacte al administrador.'
        );
    }
};
