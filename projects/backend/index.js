import 'dotenv/config';
import WebServer from './bin/server.js';

const server = new WebServer();
const port = process.env.PORT || 18512;

server.listen(port);
