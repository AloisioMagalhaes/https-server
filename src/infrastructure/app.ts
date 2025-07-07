import { ServerFactory } from "./server-factory";
import { FileService } from "../domain/use-cases/file-service";
import { FileCache } from "../domain/entities/file-cache";
import { RequestCounter } from "../domain/entities/request-counter";
import { RequestHandler } from "../domain/interfaces/request-handler";
import { CertificateService } from "./certificate-service";

/**
 * @description Configuração centralizada do servidor
 * @implements {App}
 */
export const app = {
  start(port: number, host: string): void {
    const certOptions = new CertificateService().generate();
    const options = {
      key: certOptions.privateKey,
      cert: certOptions.certificate,
    };
    const server = new ServerFactory().create(options);
    const handler = new RequestHandler(
      new FileService(),
      new FileCache(),
      new RequestCounter()
    );

    server.on("request", (req, res) => handler.handle(req, res));

    server.listen({ port, host }, () => {
      console.log(`Server running on https://${host}:${port}`);
    });
  },
};
