/**
 * @description Contador de requisições usando SharedArrayBuffer
 * @implements {AtomicCounter}
 */
export class RequestCounter {
  private readonly buffer = new SharedArrayBuffer(4);
  private readonly counter = new Uint32Array(this.buffer);

  increment(): void {
    Atomics.add(this.counter, 0, 1);
  }

  get value(): number {
    return Atomics.load(this.counter, 0);
  }
}
