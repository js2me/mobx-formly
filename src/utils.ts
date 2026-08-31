import { isUnsafeProperty } from 'yummies/data';

export const clone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // MobX observable proxies cannot be structured-cloned directly.
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

export const getAtPath = (source: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((value, key) => {
    if (isUnsafeProperty(key) || value === null || value === undefined) return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);

export const setAtPath = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const keys = path.split('.');
  let current: Record<string, unknown> = target;
  for (const [index, key] of keys.slice(0, -1).entries()) {
    if (isUnsafeProperty(key)) return;
    const next = current[key];
    const nextKey = keys[index + 1];
    if (!next || typeof next !== 'object') current[key] = /^\d+$/.test(nextKey) ? [] : {};
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = keys.at(-1);
  if (lastKey && !isUnsafeProperty(lastKey)) current[lastKey] = value;
};

export const deleteAtPath = (target: Record<string, unknown>, path: string): void => {
  const keys = path.split('.');
  const lastKey = keys.pop();
  if (!lastKey || isUnsafeProperty(lastKey)) return;
  const parent = keys.reduce<unknown>((value, key) => {
    if (isUnsafeProperty(key) || !value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, target);
  if (!parent || typeof parent !== 'object') return;
  delete (parent as Record<string, unknown>)[lastKey];
};

export const isEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export const extractValue = (eventOrValue: unknown): unknown => {
  if (!eventOrValue || typeof eventOrValue !== 'object' || !('target' in eventOrValue)) return eventOrValue;
  const target = (eventOrValue as { target: HTMLInputElement }).target;
  if (target.type === 'checkbox') return target.checked;
  if (target.type === 'radio') return target.checked ? target.value : undefined;
  if (target.multiple && typeof HTMLSelectElement !== 'undefined' && target instanceof HTMLSelectElement) {
    return Array.from(target.selectedOptions, (option) => option.value);
  }
  return target.value;
};
