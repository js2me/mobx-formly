import { toJS } from 'mobx';
import { isUnsafeProperty } from 'yummies/data';
import type { FieldError, FieldErrors } from './types.js';

export const clone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    try {
      // toJS strips MobX proxies so structuredClone can run; it keeps
      // Dates, Maps, and Sets intact instead of stringifying them.
      return structuredClone(toJS(value)) as T;
    } catch {
      // Values may still contain non-cloneable data such as functions or DOM nodes.
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

/** Returns the field error stored at the path in a nested errors object. */
export const findErrorAtPath = (errors: FieldErrors, path: string): FieldError | undefined => {
  const value = getAtPath(errors, path);
  return value && typeof value === 'object' && 'type' in value ? value as FieldError : undefined;
};

/** Collects the flat paths of all field errors in a nested errors object. */
export const collectErrorPaths = (errors: FieldErrors, base = ''): string[] => {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(errors)) {
    if (value === undefined) continue;
    const path = base ? `${base}.${key}` : key;
    if (value && typeof value === 'object' && 'type' in value) paths.push(path);
    if (value && typeof value === 'object') paths.push(...collectErrorPaths(value as unknown as FieldErrors, path));
  }
  return paths;
};

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
