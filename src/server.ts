import fs from "fs";
import path from "path";
import https from "https";
import { constants, randomBytes } from "crypto";
import forge from "node-forge";

/**
 * Represents a server event with type and timestamp metadata.
 * @description Core interface for tracking server lifecycle and request events.
 */
interface ServerEvent {
  type: string;
  timestamp: Date;
}
/**
 * Observer interface for receiving server event notifications.
 * @description Implements the Observer pattern for decoupled event handling.
 */
interface Observer {
  update(event: ServerEvent): void;
}
/**
 * Subject class in the Observer pattern for server events.
 * @description Manages observers and notifies them of server events.
 * @implements {Observer}
 */
class ServerSubject {
  private observers: Set<Observer> = new Set();
  /**
   * Attaches an observer to receive notifications.
   * @param observer - The observer to attach.
   * @see ConsoleLogger for an example implementation
   */
  attach(observer: Observer): void {
    this.observers.add(observer);
  }
/**
   * Notifies all attached observers of an event.
   * @param event - The event to broadcast.
   */
  notify(event: ServerEvent): void {
    for (const observer of this.observers) {
      observer.update(event);
    }
  }
}
/**
 * Concrete observer that logs server events to the console.
 * @implements {Observer}
 */
class ConsoleLogger implements Observer {
  /**
   * Updates the logger with a new event.
   * @param event - The event to log.
   * @example
   * // Logs: [2025-07-07T13:04:19.868Z] Event: server-start
   * consoleLogger.update({ type: "server-start", timestamp: new Date() });
   */
  update(event: ServerEvent): void {
    console.log(`[${event.timestamp.toISOString()}] Event: ${event.type}`);
  }
}

/**
 * HTTP Strict Transport Security (HSTS) header configuration.
 * @description Enforces secure HTTPS connections and prevents downgrade attacks.
 * @constant
 * @type {Object}
 * @property {string} Strict-Transport-Security - HSTS policy directives
 */
const HSTS_HEADER = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

/**
 * Caches file contents using WeakRef for memory-efficient storage.
 * @description Uses WeakMap to avoid memory leaks and FinalizationRegistry for cleanup.
 */
class FileCache {
  private cache = new Map<string, WeakRef<Uint8Array>>();
  private registry = new FinalizationRegistry((filePath: string) => {
    console.log(`File ${filePath} finalized`);
  });
/**
   * Retrieves a cached file buffer.
   * @param filePath - Path to the file.
   * @returns {Uint8Array | undefined} The cached buffer or undefined.
   */
  get(filePath: string): Uint8Array | undefined {
    return this.cache.get(filePath)?.deref();
  }
/**
   * Caches a file buffer with WeakRef.
   * @param filePath - Path to the file.
   * @param data - File content as Uint8Array.
   */
  set(filePath: string, data: Uint8Array): void {
    this.cache.set(filePath, new WeakRef(data));
    this.registry.register(data, filePath);
  }
}

/**
 * HTTPS server with HSTS and SharedArrayBuffer for atomic request counting.
 * @description Implements OOP principles, Observer pattern, and modern JavaScript features.
 * @extends ServerSubject
 */
class StaticHttpServer extends ServerSubject {
  private server: https.Server;
  private fileCache = new FileCache();
  private requestCounter = new SharedArrayBuffer(4);
  private counterArray = new Uint32Array(this.requestCounter);
/**
   * Initializes the HTTPS server.
   * @param port - Port number to listen on.
   * @param wwwRoot - Root directory for static files.
   */
  constructor(
    private readonly port: number,
    private readonly wwwRoot: string = path.join(process.cwd(), "public")
  ) {
    super();
    this.server = this.createHttpsServer();
  }
/**
   * Creates an HTTPS server with secure TLS options.
   * @returns {https.Server} Configured HTTPS server.
   * @see constants.SSL_OP_NO_TLSv1_2 for secure protocol settings
   */
  private createHttpsServer(): https.Server {
    const keys = this.generateCertificate();

    return https.createServer({
      key: keys.privateKey,
      cert: keys.certificate,
      secureOptions: constants.SSL_OP_NO_TLSv1_2, // Acesse o constante corretamente
    });
  }
/**
   * Generates a self-signed X.509 certificate.
   * @returns {Object} Contains privateKey and certificate PEM strings.
   * @see forge.pki.rsa.generateKeyPair for key generation
   */
  private generateCertificate(): { privateKey: string; certificate: string } {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = randomBytes(16).toString("hex");

    const now = new Date();
    cert.validity.notBefore = now;
    cert.validity.notAfter = new Date(
      now.getTime() + 365 * 24 * 60 * 60 * 1000
    );

    // Definição correta com OID explícito
    const attrs = [
      {
        type: "2.5.4.3", // OID para "commonName"
        value: "localhost",
      },
    ];

    cert.subject.attributes = attrs;
    cert.issuer.attributes = attrs; // Autoassinado

    cert.sign(keys.privateKey, forge.md.sha256.create());

    return {
      privateKey: forge.pki.privateKeyToPem(keys.privateKey),
      certificate: forge.pki.certificateToPem(cert),
    };
  }
/**
   * Streams file content in chunks.
   * @param filePath - Path to the file.
   * @returns {AsyncGenerator<Buffer>} Asynchronous stream of file chunks.
   * @async
   * @generator
   * @example
   * for await (const chunk of getFileStream("index.html")) {
   *   res.write(chunk);
   * }
   */
  private async *getFileStream(filePath: string): AsyncGenerator<Buffer> {
    const stats = fs.statSync(filePath);
    const chunkSize = 64 * 1024;
    const totalChunks = Math.ceil(stats.size / chunkSize);
    const fileHandle = fs.openSync(filePath, "r");

    try {
      for (let i = 0; i < totalChunks; i++) {
        const buffer = Buffer.alloc(chunkSize);
        const bytesRead = fs.readSync(
          fileHandle,
          buffer,
          0,
          chunkSize,
          i * chunkSize
        );
        yield buffer.subarray(0, bytesRead);
      }
    } finally {
      fs.closeSync(fileHandle);
    }
  }
/**
   * Handles incoming HTTP requests.
   * @param req - Incoming HTTP request.
   * @param res - HTTP response stream.
   * @see Proxy for dynamic header manipulation
   */
  private handleRequest(
    req: import("http").IncomingMessage,
    res: import("http").ServerResponse
  ): void {
    // Atomic operation for request counter
    Atomics.add(this.counterArray, 0, 1);
    res.setHeader(
      "X-Requests-Count",
      Atomics.load(this.counterArray, 0).toString()
    );

    // Proxy for response headers
    const headerProxy = new Proxy({} as { [key: string]: any }, {
      get: (_, prop) => res.getHeader(prop as string),
      set: (_, prop, value) => {
        res.setHeader(prop as string, value);
        return true;
      },
    });

    // HSTS Header
    headerProxy["Strict-Transport-Security"] =
      HSTS_HEADER["Strict-Transport-Security"];

    // Internationalization example

    try {
      const filePath = path.join(
        this.wwwRoot,
        req.url === "/" ? "index.html" : req.url || ""
      );

      // Serve cached file if available
      if (this.fileCache.get(filePath)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(this.fileCache.get(filePath));
        return;
      }

      // Stream file if not cached
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        // Use async generator to stream file content
        if (fs.existsSync(filePath)) {
          (async () => {
            for await (const chunk of this.getFileStream(filePath)) {
              res.write(chunk);
            }
            res.end();
          })();
        }
        // Cache file content
        const fileContent = fs.readFileSync(filePath);
        this.fileCache.set(filePath, fileContent);
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    } catch (error) {
      console.error("Error serving request:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    }
  }
/**
   * Starts the server and begins listening.
   */
  start(): void {
    this.server.on("request", (req, res) => this.handleRequest(req, res));
    this.server.listen(this.port, () => {
      this.notify({ type: "server-start", timestamp: new Date() });
      console.log(`Server running on https://localhost:${this.port}`);
    });
  }
}
export { StaticHttpServer, ConsoleLogger, FileCache, HSTS_HEADER , ServerSubject};
export type { ServerEvent, Observer, StaticHttpServer as Server , ConsoleLogger as Logger, FileCache as Cache , HSTS_HEADER as HstsHeader , ServerSubject as Subject, ServerEvent as Event, Observer as ObserverInterface , StaticHttpServer as ServerInterface, ConsoleLogger as LoggerInterface, FileCache as CacheInterface, HSTS_HEADER as HstsHeaderInterface, ServerSubject as SubjectInterface};
/**
 * Main application entry point.
 * @example
 * const server = new StaticHttpServer(443, path.join(__dirname, "..", "public"));
 * server.attach(new ConsoleLogger());
 * server.start();
 */
const server = new StaticHttpServer(443, path.join(__dirname, "..", "public"));
server.attach(new ConsoleLogger());
server.start();
