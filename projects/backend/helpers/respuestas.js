/**
 * Envuelve los errores en un formato legible y sugeridor, consistente con
 * el contrato de errores usado por el módulo solar.
 */
export function responderErrorLegible(res, status, code, message, suggestion, details = []) {
    return res.status(status).json({
        error: { code, message, suggestion, details }
    });
}
