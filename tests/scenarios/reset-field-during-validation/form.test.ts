import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('reset field during validation scenario', () => {
  it('ignores a validation result that finishes after resetField', async () => {
    let resolveValidation!: (valid: boolean) => void;
    const form = new Form({ defaultValues: { name: 'old' } });
    form.register('name', {
      validate: () => new Promise<boolean>((resolve) => { resolveValidation = resolve; }),
    });

    const validation = form.trigger('name');
    await Promise.resolve();
    expect(form.fieldState.name?.isValidating).toBe(true);

    form.resetField('name');
    resolveValidation(false);
    await validation;

    expect(form.values.name).toBe('old');
    expect(form.errors.name).toBeUndefined();
    expect(form.fieldState.name?.isDirty).toBe(false);
    expect(form.fieldState.name?.isTouched).toBe(false);
    expect(form.fieldState.name?.isValidating).toBe(false);
  });
});
