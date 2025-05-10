import { IContext, IContextOptions } from "./type";

export default class Context implements IContext {
  private context: Map<string, any>;
  private readonly options: IContextOptions;

  constructor(options: IContextOptions = {}) {
    this.context = new Map();
    this.options = options;
  }

  setItem<T>(key: string, value: T) {
    this.context.set(key, value);
  }

  getItem<T>(key: string) {
    return this.context.get(key) as T;
  }

  deleteItem(key: string) {
    this.context.delete(key);
  }

  clear() {
    this.context.clear();
  }
}
