import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('reset during async validation scenario', () => {
  it('ignores a validation result that finishes after reset', async () => {
    let resolveValidation!: (valid: boolean) => void;
    const form = new Form({ values: { name: 'old' } });
    form.register('name', { validate: () => new Promise<boolean>((resolve) => { resolveValidation = resolve; }) });
    const validation = form.trigger('name');
    await Promise.resolve();
    expect(form.fieldState.name?.isValidating).toBe(true);
    form.reset({ name: 'fresh' });
    resolveValidation(false);
    await validation;
    expect(form.values.name).toBe('fresh');
    expect(form.errors.name).toBeUndefined();
    expect(form.fieldState.name?.isValidating).toBe(false);
  });
});
