"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerSubject = exports.HSTS_HEADER = exports.FileCache = exports.ConsoleLogger = exports.StaticHttpServer = void 0;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
const https_1 = tslib_1.__importDefault(require("https"));
const crypto_1 = require("crypto");
const node_forge_1 = tslib_1.__importDefault(require("node-forge"));
class ServerSubject {
    observers = new Set();
    attach(observer) {
        this.observers.add(observer);
    }
    notify(event) {
        for (const observer of this.observers) {
            observer.update(event);
        }
    }
}
exports.ServerSubject = ServerSubject;
class ConsoleLogger {
    update(event) {
        console.log(`[${event.timestamp.toISOString()}] Event: ${event.type}`);
    }
}
exports.ConsoleLogger = ConsoleLogger;
const HSTS_HEADER = {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};
exports.HSTS_HEADER = HSTS_HEADER;
class FileCache {
    cache = new Map();
    registry = new FinalizationRegistry((filePath) => {
        console.log(`File ${filePath} finalized`);
    });
    get(filePath) {
        return this.cache.get(filePath)?.deref();
    }
    set(filePath, data) {
        this.cache.set(filePath, new WeakRef(data));
        this.registry.register(data, filePath);
    }
}
exports.FileCache = FileCache;
class StaticHttpServer extends ServerSubject {
    port;
    wwwRoot;
    server;
    fileCache = new FileCache();
    requestCounter = new SharedArrayBuffer(4);
    counterArray = new Uint32Array(this.requestCounter);
    constructor(port, wwwRoot = path_1.default.join(process.cwd(), "public")) {
        super();
        this.port = port;
        this.wwwRoot = wwwRoot;
        this.server = this.createHttpsServer();
    }
    createHttpsServer() {
        const keys = this.generateCertificate();
        return https_1.default.createServer({
            key: keys.privateKey,
            cert: keys.certificate,
            secureOptions: crypto_1.constants.SSL_OP_NO_TLSv1_2,
        });
    }
    generateCertificate() {
        const keys = node_forge_1.default.pki.rsa.generateKeyPair(2048);
        const cert = node_forge_1.default.pki.createCertificate();
        cert.publicKey = keys.publicKey;
        cert.serialNumber = (0, crypto_1.randomBytes)(16).toString("hex");
        const now = new Date();
        cert.validity.notBefore = now;
        cert.validity.notAfter = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        const attrs = [
            {
                type: "2.5.4.3",
                value: "localhost",
            },
        ];
        cert.subject.attributes = attrs;
        cert.issuer.attributes = attrs;
        cert.sign(keys.privateKey, node_forge_1.default.md.sha256.create());
        return {
            privateKey: node_forge_1.default.pki.privateKeyToPem(keys.privateKey),
            certificate: node_forge_1.default.pki.certificateToPem(cert),
        };
    }
    async *getFileStream(filePath) {
        const stats = fs_1.default.statSync(filePath);
        const chunkSize = 64 * 1024;
        const totalChunks = Math.ceil(stats.size / chunkSize);
        const fileHandle = fs_1.default.openSync(filePath, "r");
        try {
            for (let i = 0; i < totalChunks; i++) {
                const buffer = Buffer.alloc(chunkSize);
                const bytesRead = fs_1.default.readSync(fileHandle, buffer, 0, chunkSize, i * chunkSize);
                yield buffer.subarray(0, bytesRead);
            }
        }
        finally {
            fs_1.default.closeSync(fileHandle);
        }
    }
    handleRequest(req, res) {
        Atomics.add(this.counterArray, 0, 1);
        res.setHeader("X-Requests-Count", Atomics.load(this.counterArray, 0).toString());
        const headerProxy = new Proxy({}, {
            get: (_, prop) => res.getHeader(prop),
            set: (_, prop, value) => {
                res.setHeader(prop, value);
                return true;
            },
        });
        headerProxy["Strict-Transport-Security"] =
            HSTS_HEADER["Strict-Transport-Security"];
        try {
            const filePath = path_1.default.join(this.wwwRoot, req.url === "/" ? "index.html" : req.url || "");
            if (this.fileCache.get(filePath)) {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(this.fileCache.get(filePath));
                return;
            }
            if (fs_1.default.existsSync(filePath)) {
                res.writeHead(200, { "Content-Type": "text/html" });
                if (fs_1.default.existsSync(filePath)) {
                    (async () => {
                        for await (const chunk of this.getFileStream(filePath)) {
                            res.write(chunk);
                        }
                        res.end();
                    })();
                }
                const fileContent = fs_1.default.readFileSync(filePath);
                this.fileCache.set(filePath, fileContent);
            }
            else {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Not Found");
            }
        }
        catch (error) {
            console.error("Error serving request:", error);
            if (!res.headersSent) {
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end("Internal Server Error");
            }
        }
    }
    start() {
        this.server.on("request", (req, res) => this.handleRequest(req, res));
        this.server.listen(this.port, () => {
            this.notify({ type: "server-start", timestamp: new Date() });
            console.log(`Server running on https://localhost:${this.port}`);
        });
    }
}
exports.StaticHttpServer = StaticHttpServer;
const server = new StaticHttpServer(443, path_1.default.join(__dirname, "..", "public"));
server.attach(new ConsoleLogger());
server.start();
//# sourceMappingURL=server.js.map