import fs from 'fs';
import path from 'path';
import { responderErrorLegible } from '../helpers/respuestas.js';

/**
 * Última ruta de la cadena: responde JSON para rutas de API inexistentes
 * y sirve el SPA cuando el frontend ya fue compilado en /public.
 */
export function crearFallbackFrontend(publicPath) {
    const indexPath = path.resolve(publicPath, 'index.html');

    return (req, res) => {
        if (/^\/(api|microservices)(\/|$)/.test(req.path)) {
            return responderErrorLegible(
                res,
                404,
                'RUTA_NO_ENCONTRADA',
                'La ruta solicitada no existe en esta API.',
                'Revise /context/api_contracts.md o consulte GET /api/energy/constants.'
            );
        }

        if (!fs.existsSync(indexPath)) {
            return responderErrorLegible(
                res,
                404,
                'FRONTEND_NO_DISPONIBLE',
                'La interfaz web todavía no está compilada en este servidor.',
                'Mientras tanto, use los endpoints bajo /api.'
            );
        }

        return res.sendFile(indexPath);
    };
}
