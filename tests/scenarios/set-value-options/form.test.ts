import { describe, expect, it, vi } from 'vitest';
import { Form } from '../../../src/index.js';

describe('setValue options scenario', () => {
  it('applies dirty, touched, and validation flags independently', async () => {
    const form = new Form({ defaultValues: { count: 0 } });
    form.register('count', { min: { value: 1, message: 'At least one' } });

    form.setValue('count', 1, { shouldDirty: false, shouldTouch: true, shouldValidate: false });
    expect(form.values.count).toBe(1);
    expect(form.dirtyFields.count).toBeUndefined();
    expect(form.fieldState.count).toMatchObject({ isDirty: false, isTouched: true });
    expect(form.errors.count).toBeUndefined();

    form.setValue('count', 0, { shouldDirty: true, shouldValidate: true });
    await vi.waitFor(() => expect(form.errors.count?.message).toBe('At least one'));
    expect(form.dirtyFields.count).toBeUndefined();

    form.setValue('count', 2, { shouldValidate: true });
    await vi.waitFor(() => expect(form.errors.count).toBeUndefined());
    expect(form.dirtyFields.count).toBe(true);
    expect(form.fieldState.count?.isTouched).toBe(true);
  });
});
