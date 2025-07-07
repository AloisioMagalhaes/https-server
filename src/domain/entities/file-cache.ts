/**
 * @description Cache de arquivos com gerenciamento de memória eficiente
 * @implements {MemoryManager}
 */
export class FileCache {
  private cache = new Map<string, WeakRef<Uint8Array>>();
  private registry = new FinalizationRegistry((filePath: string) => {
    console.log(`File ${filePath} finalized`);
  });

  get(filePath: string): Uint8Array | undefined {
    return this.cache.get(filePath)?.deref();
  }

  set(filePath: string, data: Uint8Array): void {
    this.cache.set(filePath, new WeakRef(data));
    this.registry.register(data, filePath);
  }
}