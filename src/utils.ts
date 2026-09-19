import { isObservableMap, toJS } from 'mobx';
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
    if (value instanceof Map || isObservableMap(value)) return value.get(key);
    return (value as Record<string, unknown>)[key];
  }, source);

export const setAtPath = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const keys = path.split('.');
  let current: unknown = target;
  for (const [index, key] of keys.slice(0, -1).entries()) {
    if (isUnsafeProperty(key)) return;
    const nextKey = keys[index + 1];
    const create = () => /^\d+$/.test(nextKey) ? [] : {};
    if (current instanceof Map || isObservableMap(current)) {
      let next = current.get(key);
      if (!next || typeof next !== 'object') current.set(key, next = create());
      current = next;
    } else {
      const record = current as Record<string, unknown>;
      let next = record[key];
      if (!next || typeof next !== 'object') record[key] = next = create();
      current = next;
    }
  }
  const lastKey = keys.at(-1);
  if (!lastKey || isUnsafeProperty(lastKey)) return;
  if (current instanceof Map || isObservableMap(current)) current.set(lastKey, value);
  else (current as Record<string, unknown>)[lastKey] = value;
};

export const deleteAtPath = (target: Record<string, unknown>, path: string): void => {
  const keys = path.split('.');
  const lastKey = keys.pop();
  if (!lastKey || isUnsafeProperty(lastKey)) return;
  const parent = keys.reduce<unknown>((value, key) => {
    if (isUnsafeProperty(key) || !value || typeof value !== 'object') return undefined;
    if (value instanceof Map || isObservableMap(value)) return value.get(key);
    return (value as Record<string, unknown>)[key];
  }, target);
  if (!parent || typeof parent !== 'object') return;
  if (parent instanceof Map || isObservableMap(parent)) parent.delete(lastKey);
  else delete (parent as Record<string, unknown>)[lastKey];
};

/** Compares form values while preserving Maps, Sets, Dates, and RegExps. */
export const isEqual = (a: unknown, b: unknown): boolean => deepEqual(toJS(a), toJS(b), new WeakMap());

/** Returns leaf paths whose current values differ from their defaults. */
export const collectDirtyPaths = (values: unknown, defaultValues: unknown): string[] => {
  return collectDifferencePaths(values, defaultValues);
};

/** Returns leaf paths changed between two value snapshots. */
export const collectChangedPaths = (before: unknown, after: unknown): string[] => {
  return collectDifferencePaths(before, after);
};

const collectDifferencePaths = (values: unknown, defaultValues: unknown): string[] => {
  const paths: string[] = [];
  const visit = (value: unknown, defaultValue: unknown, path: string): void => {
    if (isEqual(value, defaultValue)) return;
    if (value instanceof Map || defaultValue instanceof Map) {
      if (!(value instanceof Map) || !(defaultValue instanceof Map) || !hasStringKeys(value) || !hasStringKeys(defaultValue)) {
        if (path) paths.push(path);
        return;
      }
      const keys = new Set([...value.keys(), ...defaultValue.keys()]);
      for (const key of keys) {
        if (!isUnsafeProperty(key)) visit(value.get(key), defaultValue.get(key), path ? `${path}.${key}` : key);
      }
      return;
    }
    if (Array.isArray(value) || Array.isArray(defaultValue)) {
      const current = Array.isArray(value) ? value : [];
      const defaults = Array.isArray(defaultValue) ? defaultValue : [];
      const length = Math.max(current.length, defaults.length);
      for (let index = 0; index < length; index += 1) visit(current[index], defaults[index], path ? `${path}.${index}` : String(index));
      return;
    }
    if (isRecord(value) || isRecord(defaultValue)) {
      const current = isRecord(value) ? value : {};
      const defaults = isRecord(defaultValue) ? defaultValue : {};
      const keys = new Set([...Object.keys(current), ...Object.keys(defaults)]);
      for (const key of keys) {
        if (!isUnsafeProperty(key)) visit(current[key], defaults[key], path ? `${path}.${key}` : key);
      }
      return;
    }
    if (isAtomicValue(value) || isAtomicValue(defaultValue)) {
      if (path) paths.push(path);
      return;
    }
    if (path) paths.push(path);
  };
  visit(toJS(values), toJS(defaultValues), '');
  return paths;
};

const isAtomicValue = (value: unknown): boolean =>
  value === null || value === undefined || typeof value !== 'object' || value instanceof Date || value instanceof RegExp || value instanceof Map || value instanceof Set;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) && !isAtomicValue(value);

const hasStringKeys = (value: Map<unknown, unknown>): value is Map<string, unknown> =>
  [...value.keys()].every((key) => typeof key === 'string');

const deepEqual = (a: unknown, b: unknown, seen: WeakMap<object, object>): boolean => {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = a as object;
  const right = b as object;
  if (seen.get(left) === right) return true;
  seen.set(left, right);

  if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  if (a instanceof RegExp || b instanceof RegExp) return a instanceof RegExp && b instanceof RegExp && a.source === b.source && a.flags === b.flags;
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size) return false;
    const unmatched = [...b.entries()];
    return [...a.entries()].every(([key, value]) => {
      const index = unmatched.findIndex(([otherKey, otherValue]) => deepEqual(key, otherKey, seen) && deepEqual(value, otherValue, seen));
      if (index < 0) return false;
      unmatched.splice(index, 1);
      return true;
    });
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size) return false;
    const unmatched = [...b];
    return [...a].every((value) => {
      const index = unmatched.findIndex((other) => deepEqual(value, other, seen));
      if (index < 0) return false;
      unmatched.splice(index, 1);
      return true;
    });
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => deepEqual(value, b[index], seen));
  }
  const leftKeys = Reflect.ownKeys(a);
  const rightKeys = Reflect.ownKeys(b);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => (
    rightKeys.includes(key) && deepEqual((a as Record<PropertyKey, unknown>)[key], (b as Record<PropertyKey, unknown>)[key], seen)
  ));
};

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
