import { observable } from 'mobx';

/**
 * Path-indexed observable store with lazy nested proxies.
 *
 * Values are stored flat by dot-separated path while reads go through
 * stable proxies that expose the same data as a nested tree. A reverse
 * index of path counts and children sets keeps parent branches alive
 * while any child path exists.
 */
export class PathStore<V extends object> {
  private readonly store = observable.map<string, V>();
  private readonly counts = new Map<string, number>();
  private readonly children = new Map<string, Set<string>>();
  private readonly proxies = new Map<string, object>();

  /** Whether a value is stored at the exact path. */
  has(path: string): boolean { return this.store.has(path); }

  /** Number of stored values. */
  get size(): number { return this.store.size; }

  /** Returns the stored value at the exact path. */
  get(path: string): V | undefined { return this.store.get(path); }

  /** All stored path and value pairs. */
  entries(): Array<[string, V]> { return [...this.store.entries()]; }

  /** All stored paths. */
  paths(): string[] { return [...this.store.keys()]; }

  /** Stores a value and registers its path in the reverse index. */
  set(path: string, value: V): void {
    if (!this.store.has(path)) this.addPathToIndex(path);
    this.store.set(path, value);
  }

  /** Removes a value and prunes empty parent branches of the index. */
  delete(path: string): void {
    if (!this.store.delete(path)) return;
    this.evictProxies(path);
    const parts = path.split('.');
    for (let index = parts.length; index > 0; index -= 1) {
      const current = parts.slice(0, index).join('.');
      const count = (this.counts.get(current) ?? 1) - 1;
      if (count > 0) {
        this.counts.set(current, count);
        continue;
      }
      this.counts.delete(current);
      const parent = parts.slice(0, index - 1).join('.');
      const siblings = this.children.get(parent);
      siblings?.delete(parts[index - 1]);
      if (siblings?.size === 0) {
        this.children.delete(parent);
        if (parent) this.proxies.delete(parent);
      }
    }
  }

  /** Removes all values and index data. */
  clear(): void {
    this.store.clear();
    this.counts.clear();
    this.children.clear();
    // The root proxy stays cached so public getters keep a stable identity across clearErrors and reset.
    const root = this.proxies.get('');
    this.proxies.clear();
    if (root) this.proxies.set('', root);
  }

  /** Returns the stored value or creates, stores, and returns it. */
  ensure(path: string, create: () => V): V {
    const existing = this.store.get(path);
    if (existing) return existing;
    this.set(path, create());
    return this.store.get(path)!;
  }

  /** Returns the stable read-only nested view of the stored values. */
  proxy(): object {
    return this.createProxy('');
  }

  private createProxy(path: string): object {
    const cached = this.proxies.get(path);
    if (cached) return cached;
    const proxy = new Proxy({}, {
      get: (_, property) => {
        if (typeof property !== 'string') return undefined;
        const current = this.store.get(path);
        if (current && property in current) return current[property as keyof V];
        const childPath = path ? `${path}.${property}` : property;
        const value = this.store.get(childPath);
        if (value && !this.children.has(childPath)) return value;
        return this.counts.has(childPath) ? this.createProxy(childPath) : undefined;
      },
      ownKeys: () => [...Object.keys(this.store.get(path) ?? {}), ...(this.children.get(path) ?? [])],
      getOwnPropertyDescriptor: (_, property) => {
        if (typeof property !== 'string') return undefined;
        const value = this.store.get(path);
        if (value && property in value) return { configurable: true, enumerable: true, value: value[property as keyof V] };
        return this.children.get(path)?.has(property) ? { configurable: true, enumerable: true } : undefined;
      },
      set: () => false,
      deleteProperty: () => false,
    });
    this.proxies.set(path, proxy);
    return proxy;
  }

  /** Drops cached proxies for the removed path and its children so churn does not accumulate. */
  private evictProxies(path: string): void {
    if (path) this.proxies.delete(path);
    const prefix = `${path}.`;
    for (const key of this.proxies.keys()) {
      if (key.startsWith(prefix)) this.proxies.delete(key);
    }
  }

  private addPathToIndex(path: string): void {
    const parts = path.split('.');
    for (let index = 1; index <= parts.length; index += 1) {
      const current = parts.slice(0, index).join('.');
      this.counts.set(current, (this.counts.get(current) ?? 0) + 1);
      const parent = parts.slice(0, index - 1).join('.');
      let siblings = this.children.get(parent);
      if (!siblings) this.children.set(parent, siblings = new Set());
      siblings.add(parts[index - 1]);
    }
  }
}
