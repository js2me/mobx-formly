import { describe, expect, it, vi } from 'vitest';
import { Form } from '../../../src/index.js';

describe('form controls scenario', () => {
  it('supports resetField keep options and a replacement default value', () => {
    const form = new Form({ defaultValues: { name: 'Ada' } });
    form.register('name');
    form.setValue('name', 'Grace');
    form.setError('name', { type: 'server', message: 'Taken' });

    form.resetField('name', {
      defaultValue: 'Lin',
      keepDirty: true,
      keepTouched: true,
      keepError: true,
    });

    expect(form.values.name).toBe('Lin');
    expect(form.defaultValues.name).toBe('Lin');
    expect(form.fieldState.name).toMatchObject({ isDirty: true, isTouched: true, error: { message: 'Taken' } });

    form.resetField('name');
    expect(form.fieldState.name).toMatchObject({ isDirty: false, isTouched: false, invalid: false, error: undefined });
  });

  it('can touch and focus fields through trigger options', async () => {
    const focus = vi.fn();
    const form = new Form({ defaultValues: { email: '' } });
    const registration = form.register('email', { required: 'Required' });
    registration.ref.current = { focus } as unknown as HTMLElement;

    expect(await form.trigger('email', { shouldTouch: true, shouldFocus: true })).toBe(false);
    expect(form.touchedFields.email).toBe(true);
    expect(focus).toHaveBeenCalledOnce();
  });

  it('focuses the first field error after an invalid submit unless disabled', async () => {
    const focused = vi.fn();
    const focusedDisabled = vi.fn();
    const enabled = new Form({ defaultValues: { email: '' } });
    const disabled = new Form({ defaultValues: { email: '' }, shouldFocusError: false });
    enabled.register('email', { required: 'Required' }).ref.current = { focus: focused } as unknown as HTMLElement;
    disabled.register('email', { required: 'Required' }).ref.current = { focus: focusedDisabled } as unknown as HTMLElement;

    await enabled.handleSubmit({ onValid: vi.fn() })();
    await disabled.handleSubmit({ onValid: vi.fn() })();

    expect(focused).toHaveBeenCalledOnce();
    expect(focusedDisabled).not.toHaveBeenCalled();
  });

  it('exposes aggregate isValidating while validation is pending', async () => {
    let resolve!: (result: { success: true; data: { name: string } }) => void;
    const form = new Form<{ name: string }>({
      defaultValues: { name: '' },
      schema: { safeParseAsync: () => new Promise((done) => { resolve = done; }) },
    });
    form.register('name');

    const validation = form.trigger('name');
    expect(form.isValidating).toBe(true);
    resolve({ success: true, data: { name: '' } });
    expect(await validation).toBe(true);
    expect(form.isValidating).toBe(false);
  });

  it('stores and clears typed root error namespaces', () => {
    const form = new Form<{ email: string }>({ defaultValues: { email: '' } });
    form.setError('root.server', { type: 'server', message: 'Try again' });
    form.setError('root.network', { type: 'network', message: 'Retry later' });

    expect(form.errors.root?.server?.message).toBe('Try again');
    expect(form.isValid).toBe(false);
    form.clearErrors(['root.server']);
    expect(form.errors.root?.server).toBeUndefined();
    expect(form.errors.root?.network?.message).toBe('Retry later');
    form.clearErrors('root');
    expect(form.errors.root).toBeUndefined();
  });

  it('supports Map field paths in setValue and resetField', () => {
    const form = new Form<{ settings: Map<'primary', { enabled: boolean }> }>({
      defaultValues: { settings: new Map([['primary', { enabled: true }]]) },
    });

    form.setValue('settings.primary.enabled', false);
    expect(form.values.settings.get('primary')?.enabled).toBe(false);
    expect(form.dirtyFields['settings.primary.enabled']).toBe(true);
    expect(form.touchedFields['settings.primary.enabled']).toBe(true);

    form.resetField('settings.primary.enabled');
    expect(form.values.settings.get('primary')?.enabled).toBe(true);
  });

  it('reconciles async mutate after its callback resolves', async () => {
    const form = new Form({ defaultValues: { name: '' } });

    await form.mutate(async () => {
      await Promise.resolve();
      form.values.name = 'Ada';
    }, { shouldValidate: false });

    expect(form.dirtyFields.name).toBe(true);
    expect(form.touchedFields.name).toBe(true);
  });

  it('reconciles writes made before an async mutate rejects', async () => {
    const form = new Form({ defaultValues: { name: '' } });

    await expect(form.mutate(async () => {
      form.values.name = 'Ada';
      throw new Error('Request failed');
    }, { shouldValidate: false })).rejects.toThrow('Request failed');

    expect(form.dirtyFields.name).toBe(true);
    expect(form.touchedFields.name).toBe(true);
  });
});
