import { observe } from 'mobx';

/**
 * Tracks direct mutations of the observable values tree.
 *
 * Installs MobX observers over the current tree, collects the flat paths
 * changed during a tracked mutation, and rebuilds observers when nested
 * objects are replaced or array items are spliced.
 */
export class MutationTracker<T extends object> {
  private observers?: Array<() => void>;
  private cleanupTimer?: ReturnType<typeof setTimeout>;
  private readonly changedPaths = new Set<string>();
  private mutating = false;
  private treeChanged = false;

  constructor(private readonly getValues: () => T) {}

  /** Runs a mutator and returns the flat paths changed by it. */
  track(mutator: () => void): string[] {
    this.ensureObservers();
    this.changedPaths.clear();
    this.mutating = true;

    try {
      mutator();
    } finally {
      this.mutating = false;
    }

    this.scheduleCleanup();
    const paths = [...this.changedPaths];
    if (this.treeChanged) {
      this.disposeObservers();
      this.treeChanged = false;
      this.ensureObservers();
    }
    return paths;
  }

  /** Detaches all observers until the next tracked mutation. */
  dispose(): void {
    this.disposeObservers();
  }

  private ensureObservers(): void {
    if (!this.observers || this.treeChanged) {
      this.disposeObservers();
      this.observers = [];
      this.observeValueTree(this.getValues(), '', this.observers);
      this.treeChanged = false;
    }
    this.scheduleCleanup();
  }

  private scheduleCleanup(): void {
    if (this.cleanupTimer) clearTimeout(this.cleanupTimer);
    this.cleanupTimer = setTimeout(() => this.disposeObservers(), 10 * 60 * 1000);
    const timer = this.cleanupTimer as unknown as { unref?: () => void };
    timer.unref?.();
  }

  private disposeObservers(): void {
    for (const dispose of this.observers ?? []) dispose();
    this.observers = undefined;
    this.cleanupTimer = undefined;
  }

  private observeValueTree(value: unknown, basePath: string, disposers: Array<() => void>): void {
    if (!value || typeof value !== 'object') return;

    if (Array.isArray(value)) {
      disposers.push(observe(value, (change) => {
        if (change.type === 'splice') this.treeChanged = true;
        if (this.mutating && basePath) this.changedPaths.add(basePath);
      }));
    } else {
      disposers.push(observe(value as Record<string, unknown>, (change) => {
        if (change.type === 'update' && (typeof change.newValue === 'object' || typeof change.oldValue === 'object')) {
          this.treeChanged = true;
        }
        if (!this.mutating) return;
        const path = basePath ? `${basePath}.${String(change.name)}` : String(change.name);
        if (path) this.changedPaths.add(path);
      }));
    }

    for (const [key, child] of Object.entries(value)) {
      this.observeValueTree(child, basePath ? `${basePath}.${key}` : key, disposers);
    }
  }
}
