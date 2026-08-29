import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('validation modes scenario', () => {
  it('validates on change, blur, all, and revalidation mode', async () => {
    const change = new Form({ values: { name: '' }, mode: 'onChange' });
    const changeField = change.register('name', { required: 'Required' });
    await changeField.onChange({ target: { value: '' } });
    expect(change.errors.name?.message).toBe('Required');

    const blur = new Form({ values: { name: '' }, mode: 'onBlur' });
    const blurField = blur.register('name', { required: 'Required' });
    await blurField.onChange({ target: { value: '' } });
    expect(blur.errors.name).toBeUndefined();
    await blurField.onBlur();
    expect(blur.errors.name?.message).toBe('Required');

    const all = new Form({ values: { name: '' }, mode: 'all' });
    const allField = all.register('name', { required: 'Required' });
    await allField.onChange({ target: { value: '' } });
    expect(all.errors.name?.message).toBe('Required');
    await allField.onBlur();
    expect(all.fieldState.name?.isTouched).toBe(true);

    const submitOnly = new Form({ values: { name: '' }, mode: 'onSubmit', reValidateMode: 'onBlur' });
    const submitField = submitOnly.register('name', { required: 'Required' });
    await submitOnly.handleSubmit({ onValid: async () => undefined })();
    await submitField.onChange({ target: { value: '' } });
    expect(submitOnly.errors.name?.message).toBe('Required');
    await submitField.onBlur();
    expect(submitOnly.fieldState.name?.isTouched).toBe(true);
  });
});
