interface IContext {
  setItem<T>(key: string, value: T): void;
  getItem<T>(key: string): T;
  deleteItem(key: string): void;
  clear(): void;
}

interface IContextOptions {
  cacheDirectory?: string;
}

export default class Context implements IContext {
  private context: Map<string, any>;
  private readonly options: IContextOptions;

  constructor(options: IContextOptions = {}) {
    this.context = new Map();
    this.options = options;
  }

  setItem<T>(key: string, value: T): void {
    this.context.set(key, value);
  }

  getItem<T>(key: string): T {
    return this.context.get(key) as T;
  }

  deleteItem(key: string): void {
    this.context.delete(key);
  }

  clear(): void {
    this.context.clear();
  }
}
