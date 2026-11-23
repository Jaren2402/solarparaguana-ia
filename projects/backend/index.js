import 'dotenv/config';
import WebServer from './bin/server.js';
import { seedInventory } from './seeders/inventory.seeder.js';

const server = new WebServer();
const port = process.env.PORT || 18512;

server.listen(port);

// En producción cargamos el inventario de Coro / Punto Fijo al arrancar.
// Es idempotente (upsert por sku) y no detiene la API si MongoDB falla.
if (process.env.NODE_ENV === 'production' && process.env.MONGO_URI) {
    seedInventory({ disconnect: false })
        .then((resumen) => {
            console.log(`[seed] Inventario listo: ${resumen.procesados} equipos.`);
        })
        .catch((error) => {
            console.warn('[seed] No se pudo cargar el inventario:', error?.message ?? error);
        });
}
