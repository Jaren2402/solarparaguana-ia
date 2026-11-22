import mongoose from 'mongoose';

/**
 * Conexión a MongoDB de forma tolerante a fallos.
 *
 * El dimensionamiento solar no depende de la base de datos: si no hay
 * MONGO_URI o la conexión falla, el servidor sigue activo y las rutas de
 * cálculo responden. Solo queda pendiente la cotización con stock local.
 */
export function connectMongo() {
    const uri = process.env.MONGO_URI?.trim();
    if (!uri) {
        console.warn('[db] MONGO_URI no configurado: el cálculo funciona, el presupuesto con stock queda pendiente.');
        return Promise.resolve(null);
    }

    return mongoose.connect(uri).catch((error) => {
        console.warn('[db] No se pudo conectar a MongoDB; el servidor continúa activo.', error?.message ?? error);
        return null;
    });
}

export function disconnectMongo() {
    return mongoose.disconnect();
}

export default mongoose;
