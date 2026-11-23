import 'dotenv/config';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import Inventory, { ALMACENES } from '../api/solar/inventory.model.js';

const __filename = fileURLToPath(import.meta.url);

const PRECIO = (monto) => ({ monto, moneda: 'USD' });
const CAPACIDAD = (valor, unidad) => ({ valor, unidad });
const STOCK = (almacen, disponible) => ({ almacen, disponible });

/**
 * Catálogo de referencia para Coro y Punto Fijo.
 * Los valores de inversor se expresan en kVA (kW / FP 0.90) para que sean
 * comparables con el requerimiento que calcula `calculator.controller.js`.
 */
const EQUIPOS = [
    {
        sku: 'PAN-JINKO-550-CORO',
        categoria: 'panel',
        marca: 'Jinko Solar',
        modelo: 'Tiger Neo N-Type 550 W',
        capacidad: CAPACIDAD(550, 'Wp'),
        voltajeNominalV: 41.5,
        precio: PRECIO(165),
        stock: STOCK('Coro', 120)
    },
    {
        sku: 'PAN-JINKO-550-PFJ',
        categoria: 'panel',
        marca: 'Jinko Solar',
        modelo: 'Tiger Neo N-Type 550 W',
        capacidad: CAPACIDAD(550, 'Wp'),
        voltajeNominalV: 41.5,
        precio: PRECIO(168),
        stock: STOCK('Punto Fijo', 86)
    },
    {
        sku: 'INV-MUST-3KW-CORO',
        categoria: 'inversor',
        marca: 'Must',
        modelo: 'PV18-3024 3 kW senoidal pura',
        capacidad: CAPACIDAD(3.3, 'kVA'),
        voltajeNominalV: 48,
        precio: PRECIO(340),
        stock: STOCK('Coro', 18)
    },
    {
        sku: 'INV-MUST-3KW-PFJ',
        categoria: 'inversor',
        marca: 'Must',
        modelo: 'PV18-3024 3 kW senoidal pura',
        capacidad: CAPACIDAD(3.3, 'kVA'),
        voltajeNominalV: 48,
        precio: PRECIO(348),
        stock: STOCK('Punto Fijo', 11)
    },
    {
        sku: 'INV-GROWATT-3KW-CORO',
        categoria: 'inversor',
        marca: 'Growatt',
        modelo: 'SPF 3000 TL 3 kW senoidal pura',
        capacidad: CAPACIDAD(3.3, 'kVA'),
        voltajeNominalV: 48,
        precio: PRECIO(395),
        stock: STOCK('Coro', 9)
    },
    {
        sku: 'INV-MUST-5KW-CORO',
        categoria: 'inversor',
        marca: 'Must',
        modelo: 'PV18-5048 5 kW senoidal pura',
        capacidad: CAPACIDAD(5.6, 'kVA'),
        voltajeNominalV: 48,
        precio: PRECIO(520),
        stock: STOCK('Coro', 14)
    },
    {
        sku: 'INV-MUST-5KW-PFJ',
        categoria: 'inversor',
        marca: 'Must',
        modelo: 'PV18-5048 5 kW senoidal pura',
        capacidad: CAPACIDAD(5.6, 'kVA'),
        voltajeNominalV: 48,
        precio: PRECIO(535),
        stock: STOCK('Punto Fijo', 7)
    },
    {
        sku: 'INV-GROWATT-5KW-CORO',
        categoria: 'inversor',
        marca: 'Growatt',
        modelo: 'SPF 5000 ES 5 kW senoidal pura',
        capacidad: CAPACIDAD(5.6, 'kVA'),
        voltajeNominalV: 48,
        precio: PRECIO(610),
        stock: STOCK('Coro', 6)
    },
    {
        sku: 'INV-GROWATT-5KW-PFJ',
        categoria: 'inversor',
        marca: 'Growatt',
        modelo: 'SPF 5000 ES 5 kW senoidal pura',
        capacidad: CAPACIDAD(5.6, 'kVA'),
        voltajeNominalV: 48,
        precio: PRECIO(625),
        stock: STOCK('Punto Fijo', 5)
    },
    {
        sku: 'BAT-FELICITY-48V100-CORO',
        categoria: 'bateria',
        marca: 'Felicity',
        modelo: 'Lithium LiFePO4 48 V 100 Ah con BMS',
        capacidad: CAPACIDAD(100, 'Ah'),
        voltajeNominalV: 48,
        precio: PRECIO(980),
        stock: STOCK('Coro', 40)
    },
    {
        sku: 'BAT-FELICITY-48V100-PFJ',
        categoria: 'bateria',
        marca: 'Felicity',
        modelo: 'Lithium LiFePO4 48 V 100 Ah con BMS',
        capacidad: CAPACIDAD(100, 'Ah'),
        voltajeNominalV: 48,
        precio: PRECIO(995),
        stock: STOCK('Punto Fijo', 25)
    },
    {
        sku: 'BAT-FELICITY-48V200-CORO',
        categoria: 'bateria',
        marca: 'Felicity',
        modelo: 'Lithium LiFePO4 48 V 200 Ah con BMS',
        capacidad: CAPACIDAD(200, 'Ah'),
        voltajeNominalV: 48,
        precio: PRECIO(1750),
        stock: STOCK('Coro', 12)
    },
    {
        sku: 'BAT-GEL-12V200-CORO',
        categoria: 'bateria',
        marca: 'Volt',
        modelo: 'Gel 12 V 200 Ah',
        capacidad: CAPACIDAD(200, 'Ah'),
        voltajeNominalV: 12,
        precio: PRECIO(210),
        stock: STOCK('Coro', 60)
    },
    {
        sku: 'ACC-MPPT60-CORO',
        categoria: 'accesorio',
        marca: 'Epever',
        modelo: 'Controlador MPPT 60 A',
        capacidad: CAPACIDAD(60, 'und'),
        precio: PRECIO(180),
        stock: STOCK('Coro', 20)
    },
    {
        sku: 'ACC-ESTRUCTURA-CORO',
        categoria: 'accesorio',
        marca: 'SolarParaguaná',
        modelo: 'Estructura metálica para 4 paneles',
        capacidad: CAPACIDAD(1, 'und'),
        precio: PRECIO(145),
        stock: STOCK('Coro', 30)
    },
    {
        sku: 'ACC-CABLEADO-PFJ',
        categoria: 'accesorio',
        marca: 'SolarParaguaná',
        modelo: 'Kit cableado solar 10 mm²',
        capacidad: CAPACIDAD(1, 'und'),
        precio: PRECIO(75),
        stock: STOCK('Punto Fijo', 35)
    }
];

export async function seedInventory({ disconnect = true } = {}) {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/solarparaguana_ia';
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(uri);
    }

    try {
        const operaciones = EQUIPOS.map((equipo) => ({
            updateOne: {
                filter: { sku: equipo.sku },
                update: {
                    $set: {
                        ...equipo,
                        vigente: equipo.vigente ?? true
                    }
                },
                upsert: true
            }
        }));

        const resultado = await Inventory.bulkWrite(operaciones);
        const totales = ALMACENES.reduce((acc, almacen) => {
            acc[almacen] = EQUIPOS.filter((equipo) => equipo.stock.almacen === almacen).length;
            return acc;
        }, {});

        return {
            procesados: EQUIPOS.length,
            insertados: resultado.upsertedCount ?? 0,
            modificados: resultado.modifiedCount ?? 0,
            porAlmacen: totales
        };
    } finally {
        if (disconnect) {
            await mongoose.disconnect();
        }
    }
}

const esEjecucionDirecta = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (esEjecucionDirecta) {
    seedInventory()
        .then((resumen) => {
            console.log('Inventario local cargado correctamente.');
            console.log(`  Equipos procesados: ${resumen.procesados}`);
            console.log(`  Nuevos: ${resumen.insertados} | Actualizados: ${resumen.modificados}`);
            console.log(`  Coro: ${resumen.porAlmacen.Coro} | Punto Fijo: ${resumen.porAlmacen['Punto Fijo']}`);
        })
        .catch((error) => {
            console.error('No se pudo cargar el inventario local.');
            console.error(error?.message ?? 'Error desconocido.');
            console.error('Verifique MONGO_URI y que MongoDB esté disponible.');
            process.exitCode = 1;
        });
}
