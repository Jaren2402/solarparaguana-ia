import mongoose from 'mongoose';

export const CATEGORIAS = ['panel', 'inversor', 'bateria', 'accesorio'];
export const ALMACENES = ['Coro', 'Punto Fijo'];
const UNIDADES = ['Wp', 'kVA', 'Ah', 'kWh', 'und'];
const MONEDAS = ['USD', 'VES'];

const inventorySchema = new mongoose.Schema(
    {
        sku: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },
        categoria: {
            type: String,
            enum: CATEGORIAS,
            required: true
        },
        marca: {
            type: String,
            required: true,
            trim: true
        },
        modelo: {
            type: String,
            required: true,
            trim: true
        },
        capacidad: {
            valor: {
                type: Number,
                required: true,
                min: 0
            },
            unidad: {
                type: String,
                enum: UNIDADES,
                required: true
            }
        },
        voltajeNominalV: {
            type: Number,
            min: 0,
            default: null
        },
        precio: {
            monto: {
                type: Number,
                required: true,
                min: 0
            },
            moneda: {
                type: String,
                enum: MONEDAS,
                default: 'USD'
            }
        },
        stock: {
            almacen: {
                type: String,
                enum: ALMACENES,
                required: true
            },
            disponible: {
                type: Number,
                required: true,
                min: 0,
                default: 0
            }
        },
        vigente: {
            type: Boolean,
            default: true
        }
    },
    {
        collection: 'inventory',
        timestamps: true,
        toJSON: { virtuals: true }
    }
);

inventorySchema.virtual('disponible').get(function disponible() {
    return this.vigente && this.stock.disponible > 0;
});

inventorySchema.statics.findDisponibles = function findDisponibles(filtro = {}) {
    const { almacenes = ALMACENES, ...resto } = filtro;
    const consulta = {
        ...resto,
        vigente: true,
        'stock.almacen': { $in: almacenes },
        'stock.disponible': { $gt: 0 }
    };
    return this.find(consulta).lean();
};

inventorySchema.statics.agruparPorEquipo = function agruparPorEquipo(items) {
    const grupos = new Map();

    items.forEach((item) => {
        const clave = [
            item.categoria,
            item.marca,
            item.modelo,
            item.capacidad?.valor,
            item.capacidad?.unidad
        ].join('|');

        if (!grupos.has(clave)) {
            grupos.set(clave, {
                categoria: item.categoria,
                marca: item.marca,
                modelo: item.modelo,
                capacidad: { ...item.capacidad },
                voltajeNominalV: item.voltajeNominalV,
                precio: { ...item.precio },
                skus: new Set(),
                almacenes: new Set(),
                totalStock: 0
            });
        }

        const grupo = grupos.get(clave);
        grupo.totalStock += item.stock.disponible;
        grupo.almacenes.add(item.stock.almacen);
        if (item.sku) grupo.skus.add(item.sku);
        if (item.precio.monto < grupo.precio.monto) {
            grupo.precio = { ...item.precio };
        }
    });

    return [...grupos.values()]
        .map((grupo) => ({
            ...grupo,
            sku: [...grupo.skus][0] ?? null,
            almacenes: [...grupo.almacenes]
        }))
        .sort((a, b) => a.precio.monto - b.precio.monto || a.almacenes[0].localeCompare(b.almacenes[0]));
};

inventorySchema.index({ categoria: 1, 'stock.almacen': 1, vigente: 1 });

const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);

export default Inventory;
