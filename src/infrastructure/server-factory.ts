import https from 'https';
import { Server } from 'http';

/**
 * @description Fábrica de servidores HTTPS
 * @implements {ServerFactory}
 */
export class ServerFactory {
  create(options: https.ServerOptions): Server {
    return https.createServer(options);
  }
}