import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path, { dirname } from 'path';
import os from 'os';
import cors from 'cors';
import helmet from 'helmet';
import fileUpload from 'express-fileupload';
import { fileURLToPath } from 'url';
import solarRoutes from '../api/solar/solar.routes.js';
import createTelegramRouter, { startTelegramPolling } from '../microservices/solar_mcp.service.js';
import { connectMongo } from '../databases/mongodb.js';
import { crearFallbackFrontend } from '../middlewares/notFound.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_PORT = 18512;

class WebServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new SocketIOServer(this.server, {
            cors: { origin: true, credentials: true },
            path: '/socket.io'
        });

        this.app.set('io', this.io);
        this.app.set('trust proxy', 1);

        this.database();
        this.middlewares();
        this.routes();
        this.publics();
    }

    database() {
        connectMongo();
    }

    middlewares() {
        this.app.use(helmet({ contentSecurityPolicy: false }));
        this.app.use(cors({ origin: true, credentials: true }));
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use(fileUpload({
            useTempFiles: true,
            tempFileDir: path.join(os.tmpdir(), 'solarparaguana-ia'),
            createParentPath: true
        }));
    }

    routes() {
        this.app.use('/api', solarRoutes);
        this.app.use('/microservices/telegram', createTelegramRouter());
    }

    publics() {
        const uploadsPath = path.join(__dirname, '../uploads');
        const publicPath = path.join(__dirname, '../public');
        const fallback = crearFallbackFrontend(publicPath);

        this.app.use('/uploads', express.static(uploadsPath));
        this.app.use(express.static(publicPath));
        this.app.get('/', fallback);
        this.app.get('/*path', fallback);
    }

    listen(port = process.env.PORT || DEFAULT_PORT) {
        try {
            startTelegramPolling();
        } catch (error) {
            console.warn('[telegram] No se pudo iniciar el bot; el servidor HTTP continúa activo.', error?.message ?? error);
        }

        this.server.listen(port, () => {
            console.log(`Servidor ejecutándose en el puerto ${port}`);
        });
    }
}

export default WebServer;
