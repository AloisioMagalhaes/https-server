import fs from 'fs';
import path from 'path';

/**
 * @description Serviço de manipulação de arquivos
 * @implements {FileHandler}
 */
export class FileService {
  constructor(private readonly wwwRoot: string = path.join(process.cwd(), 'public')) {}

  resolvePath(url: string): string {
    return path.join(this.wwwRoot, url === '/' ? 'index.html' : url || '');
  }

  exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  readStream(filePath: string): AsyncGenerator<Buffer> {
    const stats = fs.statSync(filePath);
    const chunkSize = 64 * 1024;
    const totalChunks = Math.ceil(stats.size / chunkSize);
    const fileHandle = fs.openSync(filePath, 'r');

    return (async function* () {
      try {
        for (let i = 0; i < totalChunks; i++) {
          const buffer = Buffer.alloc(chunkSize);
          const bytesRead = fs.readSync(fileHandle, buffer, 0, chunkSize, i * chunkSize);
          yield buffer.subarray(0, bytesRead);
        }
      } finally {
        fs.closeSync(fileHandle);
      }
    })();
  }

  readFileSync(filePath: string): Uint8Array {
    return fs.readFileSync(filePath);
  }
}