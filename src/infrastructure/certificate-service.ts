import forge from 'node-forge';
import { randomBytes } from 'crypto';

/**
 * @description Gera certificado X.509 autoassinado
 * @implements {TlsProvider}
 */
export class CertificateService {
  generate(): { privateKey: string; certificate: string } {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = randomBytes(16).toString('hex');
    const now = new Date();
    cert.validity.notBefore = now;
    cert.validity.notAfter = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const attrs = [{ type: '2.5.4.3', value: 'localhost' }];
    cert.subject.attributes = attrs;
    cert.issuer.attributes = attrs;
    cert.sign(keys.privateKey, forge.md.sha256.create());

    return {
      privateKey: forge.pki.privateKeyToPem(keys.privateKey),
      certificate: forge.pki.certificateToPem(cert),
    };
  }
}