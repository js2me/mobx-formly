import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('dynamic registration scenario', () => {
  it('can register, unregister, and register a field again', () => {
    const form = new Form({ values: { name: 'Ada' } });
    const first = form.register('name');
    form.setError('name', { type: 'manual' });
    form.unregister('name');
    expect(form.values.name).toBeUndefined();
    expect(form.errors.name).toBeUndefined();
    const second = form.register('name');
    expect(second.ref).not.toBe(first.ref);
    form.setValue('name', 'Grace');
    expect(form.values.name).toBe('Grace');
  });
});
