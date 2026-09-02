import { describe, expect, it } from 'vitest';
import { PathStore } from '../src/path-store.js';

describe('PathStore', () => {
  const makeState = () => ({ invalid: false, isDirty: false, isTouched: false, isValidating: false, error: undefined });
  const cachedProxies = (store: PathStore<ReturnType<typeof makeState>>) =>
    (store as unknown as { proxies: Map<string, unknown> }).proxies.size;

  it('stores values flat and reads them nested', () => {
    const store = new PathStore<ReturnType<typeof makeState>>();
    store.set('user.name', makeState());

    expect(store.has('user.name')).toBe(true);
    expect(store.get('user.name')).toBeDefined();
    const tree = store.proxy() as Record<string, Record<string, { isTouched: boolean }>>;
    expect(tree.user?.name?.isTouched).toBe(false);
    expect(Object.keys(tree)).toEqual(['user']);
    expect(Object.keys(tree.user ?? {})).toEqual(['name']);
  });

  it('returns the stored instance from ensure', () => {
    const store = new PathStore<ReturnType<typeof makeState>>();
    const first = store.ensure('email', makeState);

    const second = store.ensure('email', () => {
      throw new Error('must not recreate');
    });
    expect(first).toBe(second);
    expect(store.size).toBe(1);
  });

  it('keeps parent branches alive while siblings exist', () => {
    const store = new PathStore<ReturnType<typeof makeState>>();
    store.set('user.name', makeState());
    store.set('user.email', makeState());

    store.delete('user.name');
    const tree = store.proxy() as Record<string, Record<string, unknown>>;
    expect(Object.keys(tree)).toEqual(['user']);
    expect(Object.keys(tree.user ?? {})).toEqual(['email']);
    expect(store.size).toBe(1);
  });

  it('prunes empty parent branches and their cached proxies', () => {
    const store = new PathStore<ReturnType<typeof makeState>>();
    store.set('user.name', makeState());
    const tree = store.proxy() as Record<string, unknown>;
    void tree.user;

    store.delete('user.name');
    expect(store.size).toBe(0);
    // Only the stable root proxy remains; the branch proxy is evicted.
    expect(cachedProxies(store)).toBe(1);
    expect(Object.keys(store.proxy() as object)).toEqual([]);
  });

  it('evicts cached proxies for removed paths and their children', () => {
    const store = new PathStore<ReturnType<typeof makeState>>();
    store.set('user.name', makeState());
    store.set('user.extra', makeState());
    const tree = store.proxy() as Record<string, Record<string, unknown>>;
    void tree.user?.name;
    void tree.user?.extra;
    expect(cachedProxies(store)).toBe(2);

    store.delete('user.name');
    store.delete('user.extra');
    expect(cachedProxies(store)).toBe(1);

    store.set('user.name', makeState());
    expect((store.proxy() as Record<string, Record<string, unknown>>).user?.name).toBeDefined();
  });

  it('keeps the stable root proxy on clear and drops the rest', () => {
    const store = new PathStore<ReturnType<typeof makeState>>();
    const root = store.proxy();
    store.set('user.name', makeState());
    void (store.proxy() as Record<string, Record<string, unknown>>).user?.name;
    expect(cachedProxies(store)).toBe(2);

    store.clear();
    expect(store.size).toBe(0);
    expect(cachedProxies(store)).toBe(1);
    expect(store.proxy()).toBe(root);
    expect(Object.keys(store.proxy() as object)).toEqual([]);
  });
});
