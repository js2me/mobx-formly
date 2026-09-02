import { describe, expect, it, vi } from 'vitest';
import { Form } from '../../../src/index.js';

describe('advanced validation scenario', () => {
  it('supports onTouched validation mode', async () => {
    const form = new Form({ values: { name: '' }, mode: 'onTouched' });
    const field = form.register('name', { required: 'Required' });

    await field.onChange({ target: { value: '' } });
    expect(form.errors.name).toBeUndefined();
    await field.onBlur();
    expect(form.errors.name?.message).toBe('Required');

    await field.onChange({ target: { value: 'Ada' } });
    expect(form.errors.name).toBeUndefined();
  });

  it('short-circuits remaining rules in firstError mode after the first failure', async () => {
    const validate = vi.fn(async () => 'Should not run');
    const form = new Form({ values: { name: '' } });
    form.register('name', { required: 'Required', validate });

    expect(await form.trigger('name')).toBe(false);
    expect(form.errors.name).toEqual({ type: 'required', message: 'Required' });
    expect(validate).not.toHaveBeenCalled();
  });

  it('collects all rule and schema errors with criteriaMode all', async () => {
    const form = new Form({
      values: { code: '' },
      criteriaMode: 'all',
      schema: {
        safeParseAsync: async () => ({
          success: false as const,
          error: { issues: [
            { code: 'schemaA', path: ['code'], message: 'Schema A' },
            { code: 'schemaB', path: ['code'], message: 'Schema B' },
          ] },
        }),
      },
    });
    form.register('code', { required: 'Required', minLength: { value: 2, message: 'Too short' } });

    expect(await form.trigger()).toBe(false);
    expect(form.errors.code).toMatchObject({
      type: 'schemaA',
      message: 'Schema A',
      types: { schemaA: 'Schema A', schemaB: 'Schema B', required: 'Required', minLength: 'Too short' },
    });
  });

  it('calls a resolver with context and submits transformed values', async () => {
    const resolver = vi.fn(async (values: { name: string }, context: unknown) => {
      expect(context).toEqual({ suffix: '!' });
      return { values: { name: values.name + '!' }, errors: {} };
    });
    const onValid = vi.fn();
    const form = new Form({ values: { name: 'Ada' }, resolver, context: { suffix: '!' } });
    form.register('name');

    await form.handleSubmit({ onValid })();
    expect(resolver).toHaveBeenCalled();
    expect(onValid).toHaveBeenCalledWith({ name: 'Ada!' }, form);
  });

  it('supports Standard Schema validation', async () => {
    const form = new Form({
      values: { email: '' },
      schema: {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: () => ({ issues: [{ path: ['email'], message: 'Invalid email' }] }),
        },
      },
    });
    form.register('email');

    expect(await form.trigger()).toBe(false);
    expect(form.errors.email).toEqual({ type: 'validation', message: 'Invalid email' });
  });

  it('delays errors and applies native validity messages', async () => {
    vi.useFakeTimers();
    try {
      const form = new Form({ values: { name: '' }, mode: 'onChange', delayError: 100, shouldUseNativeValidation: true });
      const setCustomValidity = vi.fn();
      const reportValidity = vi.fn();
      const field = form.register('name', { required: 'Required' });
      field.ref({ setCustomValidity, reportValidity } as unknown as HTMLElement);

      await field.onChange({ target: { value: '' } });
      expect(form.errors.name).toBeUndefined();
      expect(setCustomValidity).toHaveBeenLastCalledWith('Required');
      vi.advanceTimersByTime(100);
      expect(form.errors.name?.message).toBe('Required');
      expect(reportValidity).toHaveBeenCalled();

      await field.onChange({ target: { value: 'Ada' } });
      expect(form.errors.name).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
