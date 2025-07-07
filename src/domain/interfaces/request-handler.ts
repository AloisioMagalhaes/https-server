import { IncomingMessage, ServerResponse } from 'http';
import { FileService } from '../use-cases/file-service';
import { FileCache } from '../entities/file-cache';
import { RequestCounter } from '../entities/request-counter';

/**
 * @description Adaptador de requisições HTTP
 * @implements {RequestAdapter}
 */
export class RequestHandler {
  constructor(
    private readonly fileService: FileService,
    private readonly fileCache: FileCache,
    private readonly requestCounter: RequestCounter
  ) {}

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.requestCounter.increment();
    res.setHeader('X-Requests-Count', this.requestCounter.value.toString());

    if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
      return;
    }

    const filePath = this.fileService.resolvePath(req.url!);
    
    if (this.fileCache.get(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(this.fileCache.get(filePath));
      return;
    }

    if (this.fileService.exists(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      for await (const chunk of this.fileService.readStream(filePath)) {
        res.write(chunk);
      }
      res.end();
      this.fileCache.set(filePath, this.fileService.readFileSync(filePath));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  }
}