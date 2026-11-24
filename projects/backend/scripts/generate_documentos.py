#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera los documentos del proyecto SolarParaguana IA en dos formatos:
  - Markdown versionable en /documentos
  - PDF para entrega en /documentos

El contenido se define una sola vez (bloques) y se renderiza en ambos formatos.
Uso: python scripts/generate_documentos.py
"""
from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[3]
SALIDA = ROOT / "documentos"
FECHA = "22 de noviembre de 2026"
AMBAR = colors.HexColor("#F59E0B")
NARANJA = colors.HexColor("#D97706")
AZUL = colors.HexColor("#0284C7")
GRIS = colors.HexColor("#64748B")
GRIS_CLARO = colors.HexColor("#F1F5F9")
BORDE = colors.HexColor("#CBD5E1")


# ---------------------------------------------------------------------------
# Normalizacion ortografica del texto en espanol
# ---------------------------------------------------------------------------

CORRECCIONES = {
    "aceptacion": "aceptación",
    "ademas": "además",
    "ambito": "ámbito",
    "anticipacion": "anticipación",
    "aplicacion": "aplicación",
    "auditoria": "auditoría",
    "automatico": "automático",
    "combinacion": "combinación",
    "diagnostico": "diagnóstico",
    "diferiran": "diferirán",
    "diseno": "diseño",
    "genero": "generó",
    "integracion": "integración",
    "investigacion": "investigación",
    "invalido": "inválido",
    "iteracion": "iteración",
    "justificacion": "justificación",
    "logica": "lógica",
    "mayusculas": "mayúsculas",
    "mitigacion": "mitigación",
    "nucleo": "núcleo",
    "peninsula": "península",
    "perdida": "pérdida",
    "perdidas": "pérdidas",
    "preparacion": "preparación",
    "radiacion": "radiación",
    "raiz": "raíz",
    "recomendacion": "recomendación",
    "cotizacion": "cotización",
    "calculos": "cálculos",
    "calculo": "cálculo",
    "analisis": "análisis",
    "atencion": "atención",
    "autenticacion": "autenticación",
    "autonomia": "autonomía",
    "bateria": "batería",
    "baterias": "baterías",
    "catalogo": "catálogo",
    "codigo": "código",
    "coleccion": "colección",
    "comun": "común",
    "configuracion": "configuración",
    "confirmacion": "confirmación",
    "conexion": "conexión",
    "conversion": "conversión",
    "correccion": "corrección",
    "criticas": "críticas",
    "criticos": "críticos",
    "decision": "decisión",
    "definicion": "definición",
    "descripcion": "descripción",
    "despliegue": "despliegue",
    "diagnostico": "diagnóstico",
    "documentacion": "documentación",
    "economico": "económico",
    "electrica": "eléctrica",
    "electricas": "eléctricas",
    "electricos": "eléctricos",
    "electronicos": "electrónicos",
    "energetico": "energético",
    "energia": "energía",
    "especificacion": "especificación",
    "especificos": "específicos",
    "estandar": "estándar",
    "estaticos": "estáticos",
    "excepcion": "excepción",
    "explicita": "explícita",
    "explicitas": "explícitas",
    "extraido": "extraído",
    "extraidos": "extraídos",
    "falcon": "Falcón",
    "formulas": "fórmulas",
    "geografico": "geográfico",
    "generacion": "generación",
    "gestion": "gestión",
    "guia": "guía",
    "imagenes": "imágenes",
    "introduccion": "introducción",
    "maximo": "máximo",
    "modulos": "módulos",
    "movil": "móvil",
    "multiples": "múltiples",
    "numero": "número",
    "operacion": "operación",
    "organizacion": "organización",
    "pendiente": "pendiente",
    "planificacion": "planificación",
    "precondicion": "precondición",
    "produccion": "producción",
    "proposito": "propósito",
    "publicacion": "publicación",
    "publico": "público",
    "razon": "razón",
    "region": "región",
    "revision": "revisión",
    "seccion": "sección",
    "simbolo": "símbolo",
    "situacion": "situación",
    "solucion": "solución",
    "supervision": "supervisión",
    "tamano": "tamaño",
    "tecnica": "técnica",
    "tecnicas": "técnicas",
    "tecnico": "técnico",
    "tecnicos": "técnicos",
    "tecnologia": "tecnología",
    "tecnologias": "tecnologías",
    "tecnologica": "tecnológica",
    "tecnologico": "tecnológico",
    "teorico": "teórico",
    "unica": "única",
    "unicamente": "únicamente",
    "unico": "único",
    "validacion": "validación",
    "valido": "válido",
    "ventilacion": "ventilación",
    "verificacion": "verificación",
    "version": "versión",
    "visualizacion": "visualización",
}


def corregir(texto: str) -> str:
    """Aplica tildes y corrige erratas, preservando mayusculas iniciales."""
    sustituciones = [
        ("de Paraguana", "de Paraguaná"),
        ("se impacto", "se impactó"),
        ("internadel", "interna del"),
        ("incrementalles", "incrementales"),
        ("confirmation", "confirmación"),
        ("Secreticos", "Secretos"),
        ("no esta", "no está"),
    ]
    for mal, bien in sustituciones:
        texto = texto.replace(mal, bien)

    for mal, bien in CORRECCIONES.items():
        for forma in (mal, mal.capitalize(), mal.upper()):
            reemplazo = (
                bien[0].upper() + bien[1:] if forma[0].isupper()
                else bien.upper() if forma.isupper()
                else bien
            )
            texto = re.sub(r"\b" + re.escape(forma) + r"\b", reemplazo, texto)
    return texto


# ---------------------------------------------------------------------------
# Contenido
# ---------------------------------------------------------------------------

DOCUMENTOS = [
    {
        "archivo": "01-documento-principal",
        "titulo": "Documento principal del proyecto",
        "subtitulo": "SolarParaguana IA - Plataforma de diagnostico, dimensionamiento y cotizacion fotovoltaica",
        "bloques": [
            ("h1", "1. Resumen ejecutivo"),
            ("p", "SolarParaguana IA es una plataforma de diagnostico, dimensionamiento y cotizacion de soluciones fotovoltaicas para Coro y la Peninsula de Paraguana, estado Falcon, Venezuela. El sistema convierte datos reales de consumo -ingresados manualmente o extraidos de una factura mediante OCR- en una recomendacion tecnica auditable: consumo diario, numero de paneles, capacidad del inversor en kVA y banco de baterias, ademas de un presupuesto calculado con inventario disponible en Coro y Punto Fijo."),
            ("p", "El proyecto se desarrolla por entregas incrementalles. Este documento resume la identidad, el problema, los objetivos, el publico, la solucion y el estado actual del primer avance, que corresponde al backend. El frontend web, la aplicacion movil y el despliegue remoto estan planificados para entregas posteriores."),

            ("h1", "2. Identidad y alcance"),
            ("table", ["Campo", "Definicion"], [
                ["Nombre oficial", "SolarParaguana IA"],
                ["Proposito", "Convertir datos reales de consumo en una recomendacion tecnica clara, trazable y cotizable"],
                ["Ambito geografico", "Coro y Peninsula de Paraguana, estado Falcon (Venezuela)"],
                ["Estado actual", "Sprint 1 completado: backend funcional y verificado"],
                ["Repositorio", "https://github.com/Jaren2402/solarparaguana-ia"],
            ]),

            ("h1", "3. Problema central"),
            ("p", "La region presenta fluctuaciones electricas constantes que ponen en riesgo equipos electronicos y productivos. A ello se suma el desconocimiento de la capacidad exacta en kVA requerida para inversores, baterias y paneles. Como consecuencia aparecen los siguientes problemas:"),
            ("bullets", [
                "Sobredimensionamiento, con costos innecesarios, o subdimensionamiento, con fallas de suministro.",
                "Cotizaciones imprecisas y perdida de confianza del cliente.",
                "Tiempos largos de analisis manual de facturas y etiquetas de consumo.",
                "Dificultad para ofrecer atencion inmediata a tecnicos y clientes finales.",
            ]),

            ("h1", "4. Objetivos"),
            ("h2", "4.1 Objetivo general"),
            ("p", "Implementar un sistema que automatice el dimensionamiento y la cotizacion de sistemas solares con base en consumo real, stock local y reglas tecnicas explicitas, reduciendo el tiempo de respuesta y mejorando la trazabilidad de cada recomendacion."),
            ("h2", "4.2 Objetivos especificos"),
            ("bullets", [
                "Definir un motor de calculo determinista y auditable con constantes de la region.",
                "Extraer datos de facturas y etiquetas mediante OCR con confirmacion obligatoria.",
                "Cotizar unicamente con equipos disponibles en Coro y Punto Fijo, en USD.",
                "Exponer un conector conversacional de Telegram que reutilice la misma logica.",
                "Manejar fallos de MongoDB y de Telegram sin detener el servidor.",
            ]),

            ("h1", "5. Publico objetivo"),
            ("table", ["Segmento", "Perfil", "Necesidad principal"], [
                ["Comerciantes PYME", "Tiendas, minimercados, talleres", "Reducir costos electricos y proteger equipos"],
                ["Posadas", "Hoteles, hostales, alojamientos", "Continuidad ante apagones y fluctuaciones"],
                ["Familias", "Hogares de la Peninsula", "Dimensionar un sistema seguro y economico"],
                ["Tecnicos instaladores", "Instaladores y empresas locales", "Calcular y cotizar con rapidez"],
            ]),

            ("h1", "6. Solucion propuesta"),
            ("p", "La solucion se organiza en cinco capacidades que comparten un mismo nucleo de calculo:"),
            ("bullets", [
                "Motor de calculo: aplica HSP 6.0, eficiencia 0.80, factor de inversor 1.25 y factor de potencia 0.90.",
                "OCR con confirmation humana: ningun dato extraido alimenta el calculo sin revision y confirmacion previa.",
                "Cotizador local: selecciona paneles, inversores y baterias con stock mayor que cero en Coro o Punto Fijo.",
                "Conector MCP/Telegram: permite calcular y cotizar desde el chat sin HTTP interno.",
                "Errores legibles: toda falla devuelve codigo, mensaje, sugerencia y trazador.",
            ]),

            ("h1", "7. Alcance del primer avance"),
            ("p", "El primer avance cubre la Fase 0 y los prompts 1.1 a 1.3.1 del Manual Maestro. No incluye el frontend Angular (prompt 2.1) ni la aplicacion movil, que se diferiran a entregas siguientes."),
            ("table", ["Componente", "Estado"], [
                ["Estructura y contexto del proyecto", "Completado"],
                ["Calculo y dimensionamiento", "Completado"],
                ["OCR y confirmacion", "Completado"],
                ["Cotizacion con stock local", "Completado"],
                ["Inventario sembrado en MongoDB", "Completado"],
                ["Conector MCP / Telegram", "Completado"],
                ["Frontend Angular", "Pendiente para el siguiente avance"],
                ["Aplicacion movil Kotlin", "Pendiente para entregas posteriores"],
            ]),

            ("h1", "8. Resultados verificados"),
            ("p", "La evidencia se genero con un script de prueba automatizado que inicia el servidor si es necesario, ejecuta 15 casos y guarda cada respuesta. Resultado: 15 de 15 pruebas correctas."),
            ("table", ["Prueba", "Resultado"], [
                ["Calculo manual", "12,3 kWh/dia; 5 paneles de 550 W; inversor 5 kVA"],
                ["Cotizacion", "USD 3.865 con 3 items de stock real"],
                ["OCR", "Subida, confirmacion y calculo con origen OCR correctos"],
                ["Inventario", "16 equipos: 10 en Coro y 6 en Punto Fijo"],
                ["Telegram", "health degraded sin token, servidor activo"],
                ["Manejo de errores", "400, 404 y 422 con mensajes legibles"],
            ]),

            ("h1", "9. Stack tecnologico"),
            ("table", ["Capa", "Tecnologia"], [
                ["Backend", "Node.js 26 (ESM), Express 5, Socket.IO"],
                ["Datos", "MongoDB con Mongoose"],
                ["Archivos", "express-fileupload en /uploads"],
                ["Procesos", "PM2 mediante ecosystem.config.cjs"],
                ["Frontend previsto", "Angular 22 standalone con Signals"],
                ["Movil previsto", "Kotlin nativo con MVVM y Retrofit"],
            ]),

            ("h1", "10. Limitaciones y trabajo futuro"),
            ("bullets", [
                "Los borradores OCR y los calculos se guardan en memoria: se pierden al reiniciar el servidor.",
                "El frontend aun no esta compilado; la raiz del servidor responde JSON de frontend no disponible.",
                "El despliegue remoto queda para la fase de DevOps.",
                "La autenticacion JWT esta prevista en el contrato, pero no forma parte de este primer avance.",
            ]),

            ("h1", "11. Referencias"),
            ("bullets", [
                "context/system_context.md - contexto de negocio.",
                "context/business_rules.md - reglas funcionales y formulas.",
                "context/api_contracts.md - contratos de API.",
                "memory/architecture_decisions.md - decisiones de diseno.",
                "memory/error_solutions.md - incidencias resueltas.",
            ]),
        ],
    },
    {
        "archivo": "02-estudio-investigacion",
        "titulo": "Estudio e investigacion",
        "subtitulo": "Marco teorico, contexto regional y justificacion tecnica de SolarParaguana IA",
        "bloques": [
            ("h1", "1. Introduccion"),
            ("p", "Este estudio recoge el marco teorico y tecnico que sustenta el dimensionamiento realizado por SolarParaguana IA. Su objetivo es explicar de donde provienen las constantes, las formulas y las decisiones de diseno implementadas en el backend, de modo que cada resultado pueda ser justificado ante un tecnico o un cliente."),

            ("h1", "2. Contexto energetico regional"),
            ("p", "La Península de Paraguaná dispone de un recurso solar abundante, con valores de horas sol pico cercanos a 6.0 al dia. Al mismo tiempo, la red electrica presenta fluctuaciones que afectan a equipos comerciales y residenciales. Esta combinacion explica la conveniencia de sistemas fotovoltaicos con almacenamiento, no solo de generacion."),
            ("bullets", [
                "La radiacion solar disponible permite reducir el tamano del arreglo frente a regiones con menor HSP.",
                "La necesidad de continuidad obliga a considerar autonomia y tecnologia de bateria.",
                "La carga pico y el arranque de motores determinan el inversor, no solo el consumo total.",
                "El stock local condiciona la solucion: una recomendacion tecnica debe ser adquirible en la zona.",
            ]),

            ("h1", "3. Marco teórico fotovoltaico"),
            ("h2", "3.1 Constante solar y perdidas"),
            ("p", "El calculo adoptado usa tres constantes fijas para la region. Se mantienen auditables y solo pueden ser sobreescritas por un tecnico dentro de rangos seguros."),
            ("table", ["Constante", "Simbolo", "Valor", "Uso"], [
                ["Horas sol pico", "HSP", "6.0", "Generacion requerida y tamano del arreglo"],
                ["Eficiencia global", "eta", "0.80", "Perdidas de temperatura, cableado y suciedad"],
                ["Factor de seguridad", "k_inv", "1.25", "Margen sobre la carga pico"],
                ["Factor de potencia", "FP", "0.90", "Conversion de kW a kVA"],
                ["Autonomia", "A", "1 dia", "Dimensionamiento de la bateria"],
                ["Voltaje de banco", "V_banco", "48 V", "Capacidad en Ah del banco"],
            ]),

            ("h2", "3.2 Formulas aplicadas"),
            ("code", "E_d (kWh/dia)  = suma(P_i * h_i) / 1000\n"
                     "E_gen          = E_d / eta\n"
                     "P_array (kWp)  = E_gen / HSP\n"
                     "N_paneles      = ceil(P_array / 0.550)\n"
                     "P_inv (kW)     = P_pico * k_inv\n"
                     "S_inv (kVA)    = P_inv / FP\n"
                     "E_nom (kWh)    = E_d * A / (DoD * eta)\n"
                     "C_banco (Ah)   = E_nom * 1000 / V_banco"),
            ("note", "El redondeo de paneles y unidades de bateria siempre se realiza hacia arriba: no se cotizan fracciones de equipo."),

            ("h2", "3.3 Tecnologias de bateria"),
            ("table", ["Tecnologia", "DoD maximo", "Observaciones"], [
                ["Litio LiFePO4", "0.80", "Requiere BMS, mayor vida util, evitar calor excesivo"],
                ["Gel / AGM", "0.50", "Requiere ventilacion, no admitir descargas profundas"],
            ]),

            ("h1", "4. Justificacion tecnologica"),
            ("table", ["Decisión", "Alternativa descartada", "Razon"], [
                ["Node.js y Express", "PHP / Django", "Ecosistema ESM, rapidez de iteracion y JSON nativo"],
                ["MongoDB y Mongoose", "SQL relacional", "Esquema flexible para catalogos y multiples almacenes"],
                ["Socket.IO", "Solo HTTP", "Preparacion para actualizaciones en tiempo real"],
                ["OCR con confirmacion", "OCR automatico sin revision", "Evita errores de lectura en datos criticos"],
                ["Telegram por Bot API", "SDK externo adicional", "Usa fetch nativo; sin dependencias nuevas"],
            ]),

            ("h1", "5. OCR y supervision humana"),
            ("p", "La investigacion sobre lectura de facturas y etiquetas condujo a una decision de diseno importante: el OCR nunca es una fuente de verdad. Extrae campos con un valor de confianza y los presenta como borrador. Si la confianza es inferior a 0.85 o el campo es invalido, se marca para revision."),
            ("bullets", [
                "El borrador queda en estado pendiente_confirmacion.",
                "El usuario debe revisar y confirmar potencia, horas y voltaje antes de calcular.",
                "Un calculo con origen OCR sin confirmar responde 422 OCR_PENDIENTE_CONFIRMACION.",
                "La imagen se conserva bajo /uploads/images para trazabilidad.",
            ]),

            ("h1", "6. Hallazgos aplicados al prototipo"),
            ("p", "El estudio se valido con un caso de prueba real. Los valores obtenidos coinciden con las formulas de la seccion 3."),
            ("table", ["Magnitud", "Valor obtenido", "Verificacion"], [
                ["Consumo diario", "12,3 kWh", "Suma de tres equipos ponderada por horas"],
                ["Generacion requerida", "15,375 kWh/dia", "12,3 / 0.80"],
                ["Arreglo fotovoltaico", "2,563 kWp", "15,375 / 6.0"],
                ["Paneles", "5 de 550 W", "ceil(2,563 / 0,550)"],
                ["Inversor", "5 kVA", "Carga pico x 1,25 / 0,90"],
                ["Banco de baterias", "400,391 Ah a 48 V", "Energia nominal / DoD / eta"],
                ["Presupuesto", "USD 3.865", "Stock real de Coro y Punto Fijo"],
            ]),

            ("h1", "7. Conclusiones"),
            ("bullets", [
                "Las constantes regionales permiten un dimensionamiento reproducible y defendible.",
                "La confirmacion humana reduce el riesgo inherente al OCR sin frenar el flujo de trabajo.",
                "La cotizacion solo es util si refleja stock real; por eso el inventario es parte del calculo.",
                "La tolerancia a fallos permite que el calculo siga disponible aunque MongoDB o Telegram no lo este.",
            ]),

            ("h1", "8. Fuentes"),
            ("bullets", [
                "Documento Maestro Teorico - SolarParaguana IA.",
                "Manual Maestro de Prompts y Contexto - SolarParaguana IA.",
                "context/system_context.md y context/business_rules.md.",
                "AGENTS.md - Guia Maestra y Estandar de Desarrollo.",
            ]),
        ],
    },
    {
        "archivo": "03-requerimientos-casos-uso",
        "titulo": "Requerimientos y casos de uso",
        "subtitulo": "Especificacion funcional del backend de SolarParaguana IA",
        "bloques": [
            ("h1", "1. Proposito"),
            ("p", "Este documento detalla los requisitos funcionales y no funcionales del backend, los actores que interactuan con el sistema y los casos de uso que cubren el flujo completo: entrada de consumo, calculo, cotizacion y atencion por Telegram."),

            ("h1", "2. Requisitos funcionales"),
            ("table", ["ID", "Requisito", "Prioridad", "Estado"], [
                ["RF-01", "Calcular consumo diario a partir de una lista de equipos", "Alta", "Implementado"],
                ["RF-02", "Calcular consumo diario a partir de factura mensual", "Alta", "Implementado"],
                ["RF-03", "Dimensionar paneles, inversor en kVA y banco de baterias", "Alta", "Implementado"],
                ["RF-04", "Subir imagen de factura o etiqueta y extraer campos OCR", "Alta", "Implementado"],
                ["RF-05", "Permitir confirmar o corregir los campos extraidos", "Alta", "Implementado"],
                ["RF-06", "Rechazar calculos con OCR sin confirmar", "Alta", "Implementado"],
                ["RF-07", "Consultar inventario de Coro y Punto Fijo", "Alta", "Implementado"],
                ["RF-08", "Emitir cotizacion con stock disponible en USD", "Alta", "Implementado"],
                ["RF-09", "Ofrecer alias /api/solar/calculate del Manual Maestro", "Media", "Implementado"],
                ["RF-10", "Exponer herramientas MCP y webhook de Telegram", "Media", "Implementado"],
            ]),

            ("h1", "3. Requisitos no funcionales"),
            ("table", ["ID", "Requisito", "Verificacion"], [
                ["RNF-01", "El servidor debe arrancar aunque falte MongoDB", "Probado: calculo disponible, presupuesto pendiente"],
                ["RNF-02", "El servidor debe arrancar aunque falte el token de Telegram", "Probado: health degraded"],
                ["RNF-03", "Los errores deben ser legibles y sugerir una correccion", "Probado en 400, 404 y 422"],
                ["RNF-04", "El seeder no debe duplicar datos al repetirse", "Probado: upsert por sku"],
                ["RNF-05", "El codigo debe pasar node --check", "Probado: 10 archivos JS sin fallos"],
                ["RNF-06", "No se debe versionar .env ni node_modules", "Verificado en el repositorio remoto"],
            ]),

            ("h1", "4. Actores"),
            ("table", ["Actor", "Descripcion", "Canal"], [
                ["Cliente final", "Usuario que desea conocer su sistema solar", "Web, movil, Telegram"],
                ["Tecnico instalador", "Profesional que calcula y emite cotizaciones", "Web, Telegram"],
                ["Administrador", "Gestiona inventario y constantes tecnicas", "Web"],
                ["Sistema externo", "Consume la API o las herramientas MCP", "API, MCP"],
            ]),

            ("h1", "5. Casos de uso"),
            ("h2", "CU-01 Calcular con equipos manuales"),
            ("p", "Actor: tecnico o cliente. Precondicion: servidor disponible."),
            ("bullets", [
                "El usuario indica origen MANUAL y una lista de equipos con potencia, horas y voltaje.",
                "El sistema valida rangos y calcula consumo, generacion, paneles, inversor y bateria.",
                "El sistema devuelve el id del calculo y el bloque calculation auditable.",
                "Postcondicion: el calculo queda disponible en memoria para cotizar.",
            ]),
            ("h2", "CU-02 Extraer y confirmar datos con OCR"),
            ("p", "Actor: cliente o tecnico. Precondicion: imagen JPEG, PNG o WebP de hasta 10 MB."),
            ("bullets", [
                "El usuario sube la imagen y, si aplica, texto auxiliar de la etiqueta.",
                "El sistema guarda la imagen y devuelve un borrador con campos y confianza.",
                "El usuario corrige y confirma potencia, horas y voltaje.",
                "El sistema marca el borrador como confirmado.",
                "Excepcion: si intenta calcular antes de confirmar, responde 422.",
            ]),
            ("h2", "CU-03 Cotizar con inventario local"),
            ("p", "Actor: tecnico. Precondicion: calculo existente y MongoDB conectado."),
            ("bullets", [
                "El usuario envia el calculoId.",
                "El sistema selecciona equipos con stock mayor que cero en Coro o Punto Fijo.",
                "El sistema calcula subtotales y presupuesto en USD.",
                "Excepcion: sin stock responde 409 SIN_STOCK_LOCAL; con monedas distintas, 409 MONEDA_MIXTA.",
            ]),
            ("h2", "CU-04 Consultar inventario"),
            ("p", "Actor: tecnico o sistema externo. Precondicion: MongoDB conectado."),
            ("bullets", [
                "El usuario solicita GET /api/inventory.",
                "El sistema devuelve almacenes y la lista de equipos vigentes.",
                "Postcondicion: se puede verificar disponibilidad antes de cotizar.",
            ]),
            ("h2", "CU-05 Interactuar por Telegram / MCP"),
            ("p", "Actor: cliente o tecnico. Precondicion: token de Telegram configurado para el bot; no necesario para las rutas MCP."),
            ("bullets", [
                "El usuario envia una descripcion de sus equipos o consulta una herramienta.",
                "El sistema reutiliza calculo y cotizacion sin realizar HTTP interno.",
                "Si no hay token, health indica degraded y el servidor continua activo.",
            ]),

            ("h1", "6. Reglas de negocio criticas"),
            ("bullets", [
                "Ningun dato del OCR se usa sin confirmacion explicita.",
                "Solo se cotizan equipos vigentes con stock disponible en Coro o Punto Fijo.",
                "El inversor se expresa en kVA usando FP 0.90 por defecto.",
                "El DoD maximo es 0.80 para litio y 0.50 para Gel/AGM.",
                "No se mezclan monedas en un mismo presupuesto.",
            ]),

            ("h1", "7. Trazabilidad requisito - endpoint"),
            ("table", ["Requisito", "Endpoint"], [
                ["RF-01, RF-02, RF-03", "POST /api/energy/calculate y /api/solar/calculate"],
                ["RF-04", "POST /api/solar/ocr-parse"],
                ["RF-05", "POST /api/solar/ocr-confirm"],
                ["RF-06", "Validacion internadel calculo con origen OCR"],
                ["RF-07", "GET /api/inventory"],
                ["RF-08", "POST /api/solar/quote"],
                ["RF-10", "GET /microservices/telegram/*"],
            ]),

            ("h1", "8. Criterios de aceptacion"),
            ("bullets", [
                "Los 15 casos del smoke test deben devolver el estado esperado.",
                "El bloque calculation debe estar presente en las dos rutas de calculo.",
                "La cotizacion del caso de prueba debe ser USD 3.865.",
                "El repositorio no debe contener .env ni node_modules.",
            ]),
        ],
    },
    {
        "archivo": "04-arquitectura-modelo-datos",
        "titulo": "Arquitectura y modelo de datos",
        "subtitulo": "Diseno tecnico del backend de SolarParaguana IA",
        "bloques": [
            ("h1", "1. Proposito"),
            ("p", "Este documento describe la organizacion del backend, la responsabilidad de cada componente, el flujo de datos de extremo a extremo y el modelo de datos del inventario. Sirve como referencia para mantenimiento y para la futura integracion con el frontend y la aplicacion movil."),

            ("h1", "2. Vista general por capas"),
            ("code", "Cliente web / movil / Telegram\n"
                     "        |\n"
                     "  API REST (/api)  +  MCP (/microservices/telegram)\n"
                     "        |\n"
                     "  Controlador solar (calculos, OCR, cotizacion)\n"
                     "        |\n"
                     "  MongoDB (inventario)  +  /uploads (imagenes)"),
            ("p", "bin/server.js actua como orquestador: configura middlewares, monta rutas, sirve estaticos y delega la conexion a bases de datos, el fallback de errores y el formato de respuesta a modulos independientes."),

            ("h1", "3. Componentes del backend"),
            ("table", ["Archivo", "Responsabilidad"], [
                ["index.js", "Punto de entrada; carga dotenv y llama a WebServer"],
                ["bin/server.js", "Middlewares, rutas, estaticos y arranque del puerto 18512"],
                ["api/solar/calculator.controller.js", "Calculo, OCR, cotizacion y errores tipados"],
                ["api/solar/inventory.model.js", "Esquema Inventory y consultas de stock"],
                ["api/solar/solar.routes.js", "Rutas REST del dominio solar"],
                ["databases/mongodb.js", "Conexion tolerante a fallos"],
                ["middlewares/notFound.js", "Fallback JSON para rutas inexistentes"],
                ["helpers/respuestas.js", "Formato comun de error legible"],
                ["microservices/solar_mcp.service.js", "Bot de Telegram y herramientas MCP"],
                ["seeders/inventory.seeder.js", "Carga idempotente del inventario"],
                ["scripts/smoke-test.mjs", "Pruebas automatizadas y generacion de evidencia"],
            ]),

            ("h1", "4. Flujo de extremo a extremo"),
            ("bullets", [
                "1. El usuario ingresa equipos o envia una imagen desde web, movil o Telegram.",
                "2. Si hay imagen, el OCR genera un borrador pendiente de confirmacion.",
                "3. El usuario revisa y confirma los campos extraidos.",
                "4. El controlador calcula consumo, generacion, paneles, inversor y baterias.",
                "5. El cotizador consulta stock vigente en Coro y Punto Fijo.",
                "6. La respuesta incluye auditoria, bloque calculation y presupuesto cuando aplica.",
            ]),

            ("h1", "5. Modelo de datos"),
            ("p", "La coleccion inventory es la unica fuente de datos persistente del primer avance. Cada documento representa un equipo disponible en un almacen concreto."),
            ("table", ["Campo", "Tipo", "Regla"], [
                ["sku", "String", "Unico, obligatorio, en mayusculas; clave del seeder"],
                ["categoria", "Enum", "panel, inversor, bateria o accesorio"],
                ["marca", "String", "Obligatoria"],
                ["modelo", "String", "Obligatorio"],
                ["capacidad.valor", "Number", "Mayor o igual que cero"],
                ["capacidad.unidad", "Enum", "Wp, kVA, Ah, kWh o und"],
                ["voltajeNominalV", "Number", "Opcional, valor por defecto nulo"],
                ["precio.monto", "Number", "Obligatorio, mayor o igual que cero"],
                ["precio.moneda", "Enum", "USD o VES; por defecto USD"],
                ["stock.almacen", "Enum", "Coro o Punto Fijo"],
                ["stock.disponible", "Number", "Entero mayor o igual que cero"],
                ["vigente", "Boolean", "Por defecto verdadero"],
            ]),
            ("note", "Los inversores se almacenan en kVA para compararlos directamente con el requerimiento calculado S_inv = kW / FP."),

            ("h1", "6. Contratos de respuesta"),
            ("h2", "6.1 Bloque de calculo"),
            ("code", '"calculation": {\n'
                     '  "totalKwhDay": 12.3,\n'
                     '  "recommendedInverterKva": 5,\n'
                     '  "totalPanels": 5,\n'
                     '  "batteryBankAh": 400.391\n'
                     '}'),
            ("h2", "6.2 Bloque de presupuesto"),
            ("code", '"presupuesto": { "monto": 3865, "moneda": "USD" }'),
            ("p", "Ambos bloques conviven con las claves originales de la respuesta, de modo que no se rompe la compatibilidad con consumidores anteriores."),

            ("h1", "7. Manejo de errores"),
            ("table", ["Codigo", "HTTP", "Situacion"], [
                ["ARCHIVO_REQUERIDO", "400", "Falta la imagen en el OCR"],
                ["FORMATO_NO_SOPORTADO", "415", "La imagen no es JPEG, PNG ni WebP"],
                ["OCR_PENDIENTE_CONFIRMACION", "422", "Calculo OCR sin confirmar"],
                ["SIN_STOCK_LOCAL", "409", "No hay stock en Coro ni Punto Fijo"],
                ["MONEDA_MIXTA", "409", "Items con monedas distintas"],
                ["RUTA_NO_ENCONTRADA", "404", "Ruta de API inexistente"],
                ["FRONTEND_NO_DISPONIBLE", "404", "Build de Angular aun no copiado"],
            ]),

            ("h1", "8. Persistencia y estado temporal"),
            ("bullets", [
                "MongoDB guarda el inventario de forma persistente.",
                "Los borradores OCR y los calculos viven en Map en memoria del proceso.",
                "Las imagenes se guardan en /uploads/images y se sirven por express.static.",
                "Al reiniciar el servidor se pierden borradores y calculos, pero no el inventario.",
            ]),

            ("h1", "9. Decisiones de arquitectura"),
            ("bullets", [
                "El bot reutiliza funciones puras del controlador: no llama a la API por HTTP.",
                "Sin token de Telegram el conector queda degradado, sin tumbar el servidor.",
                "Sin MongoDB el calculo sigue funcionando; solo se suspende la cotizacion.",
                "El fallback distingue rutas de API de rutas del frontend para devolver siempre JSON util.",
            ]),

            ("h1", "10. Despliegue"),
            ("p", "La plantilla ecosystem.config.cjs define una aplicacion llamada solarparaguana en modo fork, un sola instancia, puerto 18512 y logs en la carpeta logs. Antes de desplegar deben configurarse PORT, MONGO_URI y, si aplica, los tokens de Telegram en el entorno del servidor."),
        ],
    },
    {
        "archivo": "05-planificacion-riesgos",
        "titulo": "Planificacion y riesgos",
        "subtitulo": "Cronograma, entregables y matriz de riesgos de SolarParaguana IA",
        "bloques": [
            ("h1", "1. Proposito y enfoque"),
            ("p", "La planificacion sigue un modelo incremental por sprints. Cada entrega deja un componente funcionando y verificable, de modo que el avance sea demostrable incluso antes de completar el producto final. El primer sprint se impacto en el backend; los siguientes incorporan interfaz web, integracion, movil y despliegue."),

            ("h1", "2. Plan de sprints"),
            ("table", ["Sprint", "Objetivo", "Entregables principales", "Estado"], [
                ["1", "Backend funcional", "Calculo, OCR, cotizacion, inventario, MCP", "Completado"],
                ["2", "Interfaz web", "SPA Angular, formularios y visualizacion de resultados", "Planificado"],
                ["3", "Integracion y calidad", "Pruebas ampliadas, manejo de errores y pulido de flujos", "Parcialmente anticipado"],
                ["4", "Aplicacion movil", "Cliente Kotlin nativo con MVVM y Retrofit", "Planificado"],
                ["5", "Despliegue y operacion", "Publicacion, PM2, respaldos y actualizaciones APK", "Plantilla lista"],
            ]),

            ("h1", "3. Cronograma propuesto"),
            ("table", ["Semana", "Actividad", "Resultado esperado"], [
                ["1", "Contexto, reglas y contratos", "Documentos base del proyecto"],
                ["2", "Backend: calculo e inventario", "Endpoints de calculo y stock"],
                ["3", "Backend: OCR y cotizacion", "Flujo completo verificado"],
                ["4", "MCP, evidencia y cierre", "Backend entregable y documentado"],
                ["5 en adelante", "Frontend, movil y despliegue", "Siguientes avances"],
            ]),

            ("h1", "4. Entregables de este avance"),
            ("table", ["Entregable", "Estado", "Evidencia"], [
                ["Documento principal", "Listo", "documentos/01-documento-principal.pdf"],
                ["Estudio o investigacion", "Listo", "documentos/02-estudio-investigacion.pdf"],
                ["Requerimientos y casos de uso", "Listo", "documentos/03-requerimientos-casos-uso.pdf"],
                ["Arquitectura y modelo de datos", "Listo", "documentos/04-arquitectura-modelo-datos.pdf"],
                ["Planificacion y riesgos", "Listo", "documentos/05-planificacion-riesgos.pdf"],
                ["Repositorio backend", "Listo", "github.com/Jaren2402/solarparaguana-ia"],
                ["README y manual", "Listo", "README.md"],
                ["Documentacion API / Postman", "Listo", "postman/SolarParaguana.postman_collection.json"],
                ["Evidencia de pruebas", "Listo", "evidence/smoke-test-result.txt"],
                ["URL del backend desplegado", "Listo", "https://solarparaguana-ia-production.up.railway.app"],
            ]),

            ("h1", "5. Matriz de riesgos"),
            ("table", ["Riesgo", "Prob.", "Impacto", "Mitigacion"], [
                ["MongoDB no disponible", "Media", "Medio", "Conexion no bloqueante; calculo sigue activo"],
                ["Falta de token de Telegram", "Alta", "Bajo", "Modo degraded y aviso legible"],
                ["Datos OCR incorrectos", "Media", "Alto", "Borrador con confianza y confirmacion obligatoria"],
                ["Sin stock local", "Media", "Medio", "Error 409 y sugerencia de revision"],
                ["Cambios de Node en el hosting", "Media", "Alto", "Declarar version compatible y probar arranque"],
                ["Secreticos versionados", "Baja", "Alto", ".gitignore y revision antes de cada commit"],
                ["Retraso en el despliegue", "Media", "Medio", "Definir hosting y Atlas con anticipacion"],
            ]),

            ("h1", "6. Hitos de aceptacion"),
            ("bullets", [
                "El backend arranca sin errores en el puerto 18512.",
                "Las 15 pruebas automatizadas devuelven el estado esperado.",
                "El presupuesto de referencia es USD 3.865 con stock real.",
                "El repositorio no contiene .env ni node_modules.",
                "Los cinco documentos estan disponibles en PDF y Markdown.",
            ]),

            ("h1", "7. Recursos y supuestos"),
            ("bullets", [
                "Node.js 26, npm y Git en el entorno de desarrollo.",
                "MongoDB local para desarrollo y MongoDB Atlas para produccion.",
                "Cuenta de GitHub para el repositorio y cuenta de hosting para la URL publica.",
                "Los valores de inventario corresponden al catalogo sembrado en este avance.",
            ]),

            ("h1", "8. Seguimiento y control"),
            ("p", "El estado de cada decision y de cada incidencia queda registrado en la carpeta memory del repositorio. Ante un cambio de arquitectura se actualiza architecture_decisions.md; ante un error resuelto se documenta la causa, la solucion y la verificacion en error_solutions.md. Este registro permite retomar el trabajo en cualquier punto sin depender de conversaciones previas."),
        ],
    },
]


# ---------------------------------------------------------------------------
# Render Markdown
# ---------------------------------------------------------------------------

def md_texto(texto: str) -> str:
    return corregir(texto).replace("\n", "\n\n")


def a_markdown(doc: dict) -> str:
    lineas = [
        f"# {corregir(doc['titulo'])}",
        "",
        f"> {corregir(doc['subtitulo'])}",
        "",
        f"**Proyecto:** SolarParaguana IA  ",
        f"**Fecha:** {FECHA}",
        "",
        "---",
        "",
    ]
    for bloque in doc["bloques"]:
        tipo = bloque[0]
        if tipo in ("h1", "h2", "h3"):
            nivel = int(tipo[1])
            lineas += ["#" * nivel + " " + corregir(bloque[1]), ""]
        elif tipo == "p":
            lineas += [md_texto(bloque[1]), ""]
        elif tipo == "note":
            lineas += ["> " + corregir(bloque[1]).replace("\n", " "), ""]
        elif tipo == "bullets":
            lineas += ["- " + corregir(item) for item in bloque[1]] + [""]
        elif tipo == "code":
            lineas += ["```text", bloque[1].rstrip(), "```", ""]
        elif tipo == "table":
            cabeceras, filas = bloque[1], bloque[2]
            lineas += ["| " + " | ".join(corregir(c) for c in cabeceras) + " |",
                       "| " + " | ".join(["---"] * len(cabeceras)) + " |"]
            for fila in filas:
                celdas = [corregir(str(c)).replace("|", "\\|").replace("\n", " ") for c in fila]
                lineas.append("| " + " | ".join(celdas) + " |")
            lineas.append("")
    return "\n".join(lineas).rstrip() + "\n"


# ---------------------------------------------------------------------------
# Render PDF
# ---------------------------------------------------------------------------

def estilos():
    base = getSampleStyleSheet()
    return {
        "portada": ParagraphStyle(
            "portada", parent=base["Title"], fontName="Helvetica-Bold",
            fontSize=23, leading=28, textColor=AMBAR, alignment=TA_CENTER,
        ),
        "subportada": ParagraphStyle(
            "subportada", parent=base["Normal"], fontName="Helvetica",
            fontSize=12, leading=17, textColor=GRIS, alignment=TA_CENTER,
        ),
        "h1": ParagraphStyle(
            "h1", parent=base["Heading1"], fontName="Helvetica-Bold",
            fontSize=15, leading=19, textColor=NARANJA, spaceBefore=16, spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=12, leading=16, textColor=AZUL, spaceBefore=11, spaceAfter=5,
        ),
        "h3": ParagraphStyle(
            "h3", parent=base["Heading3"], fontName="Helvetica-Bold",
            fontSize=10.5, leading=14, textColor=colors.HexColor("#334155"),
            spaceBefore=8, spaceAfter=4,
        ),
        "p": ParagraphStyle(
            "p", parent=base["Normal"], fontName="Helvetica", fontSize=10,
            leading=14.5, alignment=TA_JUSTIFY, spaceAfter=7,
        ),
        "bullet": ParagraphStyle(
            "bullet", parent=base["Normal"], fontName="Helvetica", fontSize=10,
            leading=14, leftIndent=14, bulletIndent=3, spaceAfter=3,
        ),
        "code": ParagraphStyle(
            "code", parent=base["Code"], fontName="Courier", fontSize=8,
            leading=11, textColor=colors.HexColor("#0F172A"),
            backColor=GRIS_CLARO, borderPadding=6, leftIndent=4, spaceAfter=8,
        ),
        "note": ParagraphStyle(
            "note", parent=base["Normal"], fontName="Helvetica-Oblique", fontSize=9.5,
            leading=13, textColor=colors.HexColor("#475569"), leftIndent=10,
            borderPadding=6, backColor=GRIS_CLARO, spaceAfter=8,
        ),
        "celda": ParagraphStyle(
            "celda", fontName="Helvetica", fontSize=8, leading=10.5, alignment=TA_LEFT,
        ),
        "celdahead": ParagraphStyle(
            "celdahead", fontName="Helvetica-Bold", fontSize=8, leading=10.5,
            textColor=colors.white,
        ),
    }


def txt(valor: str) -> str:
    return html.escape(corregir(str(valor)), quote=False).replace("\n", "<br/>")


def anchos(cabeceras, filas, disponible):
    maxlens = []
    for i, cabecera in enumerate(cabeceras):
        largo = max([len(str(cabecera))] + [len(str(f[i])) for f in filas])
        maxlens.append(max(largo, 6))
    total = sum(maxlens)
    anchos_ = [disponible * m / total for m in maxlens]
    minimo = 2.0 * cm
    anchos_ = [max(minimo, a) for a in anchos_]
    if sum(anchos_) > disponible:
        factor = disponible / sum(anchos_)
        anchos_ = [a * factor for a in anchos_]
    return anchos_


def tabla(cabeceras, filas, est) -> Table:
    disponible = A4[0] - 4 * cm
    datos = [[Paragraph(txt(c), est["celdahead"]) for c in cabeceras]]
    for fila in filas:
        datos.append([Paragraph(txt(c), est["celda"]) for c in fila])
    t = Table(datos, colWidths=anchos(cabeceras, filas, disponible), repeatRows=1, hAlign="LEFT")
    estilo = [
        ("BACKGROUND", (0, 0), (-1, 0), NARANJA),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(datos)):
        if i % 2 == 0:
            estilo.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#F8FAFC")))
    t.setStyle(TableStyle(estilo))
    return t


def pie(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(BORDE)
    canvas.line(2 * cm, 1.45 * cm, A4[0] - 2 * cm, 1.45 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GRIS)
    canvas.drawString(2 * cm, 1.05 * cm, "SolarParaguana IA - Documentos del proyecto")
    canvas.drawRightString(A4[0] - 2 * cm, 1.05 * cm, "Pagina %d" % doc.page)
    canvas.restoreState()


def a_pdf(doc: dict, ruta: Path) -> None:
    est = estilos()
    plantilla = PageTemplate(
        id="normal",
        frames=[Frame(2 * cm, 1.7 * cm, A4[0] - 4 * cm, A4[1] - 3.4 * cm, id="cuerpo")],
        onPage=pie,
    )
    pdf = BaseDocTemplate(
        str(ruta), pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.7 * cm, bottomMargin=1.7 * cm,
        title=doc["titulo"], author="SolarParaguana IA", subject=doc["subtitulo"],
    )
    pdf.addPageTemplates([plantilla])

    flujo = [
        Spacer(1, 3.2 * cm),
        Paragraph(txt(doc["titulo"]), est["portada"]),
        Spacer(1, 0.5 * cm),
        Paragraph(txt(doc["subtitulo"]), est["subportada"]),
        Spacer(1, 1.2 * cm),
        Paragraph("Proyecto: SolarParaguana IA", est["subportada"]),
        Paragraph("Fecha: " + FECHA, est["subportada"]),
        PageBreak(),
    ]

    for bloque in doc["bloques"]:
        tipo = bloque[0]
        if tipo in ("h1", "h2", "h3"):
            flujo.append(Paragraph(txt(bloque[1]), est[tipo]))
        elif tipo == "p":
            flujo.append(Paragraph(txt(bloque[1]), est["p"]))
        elif tipo == "note":
            flujo.append(Paragraph(txt(bloque[1]), est["note"]))
        elif tipo == "bullets":
            for item in bloque[1]:
                flujo.append(Paragraph(txt(item), est["bullet"], bulletText="-"))
            flujo.append(Spacer(1, 4))
        elif tipo == "code":
            flujo.append(Preformatted(bloque[1].rstrip(), est["code"]))
        elif tipo == "table":
            flujo.append(tabla(bloque[1], bloque[2], est))
            flujo.append(Spacer(1, 8))

    pdf.build(flujo)


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    for doc in DOCUMENTOS:
        base = doc["archivo"]
        md = SALIDA / f"{base}.md"
        pdf = SALIDA / f"{base}.pdf"
        md.write_text(a_markdown(doc), encoding="utf-8")
        a_pdf(doc, pdf)
        print(f"OK  {base}.md ({md.stat().st_size} bytes)")
        print(f"OK  {base}.pdf ({pdf.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
