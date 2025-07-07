/**
 * @description Verificação de saúde do serviço
 * @implements {HealthChecker}
 */
export class HealthCheck {
  check(): string {
    return 'OK';
  }
}