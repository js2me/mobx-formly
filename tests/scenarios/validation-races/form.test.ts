import { describe, expect, it, vi } from 'vitest';
import { Form } from '../../../src/index.js';

describe('validation race scenario', () => {
  it('keeps the newest setValue validation result', async () => {
    const pending: Array<{ value: string; resolve: (valid: boolean) => void }> = [];
    const form = new Form({ values: { name: '' } });
    form.register('name', { validate: (value) => new Promise<boolean>((resolve) => pending.push({ value: String(value), resolve })) });

    form.setValue('name', 'old', { shouldValidate: true });
    form.setValue('name', 'new', { shouldValidate: true });
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[1].resolve(true);
    pending[0].resolve(false);
    await vi.waitFor(() => expect(form.fieldState.name?.isValidating).toBe(false));

    expect(form.values.name).toBe('new');
    expect(form.errors.name).toBeUndefined();
  });

  it('removes an unregistered field while its validation is pending', async () => {
    let resolveValidation!: (valid: boolean) => void;
    const form = new Form({ values: { name: 'Ada' } });
    form.register('name', { validate: () => new Promise<boolean>((resolve) => { resolveValidation = resolve; }) });
    const validation = form.trigger('name');
    await vi.waitFor(() => expect(form.fieldState.name?.isValidating).toBe(true));

    form.unregister('name');
    expect(form.values.name).toBeUndefined();
    expect(form.refs.has('name')).toBe(false);
    expect(form.errors.name).toBeUndefined();
    resolveValidation(false);
    expect(await validation).toBe(true);

    expect(form.fieldState.name).toBeUndefined();
    expect(form.errors.name).toBeUndefined();
    expect(form.validatingFields.name).toBeUndefined();
  });
});
