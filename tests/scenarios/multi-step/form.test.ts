import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('multi-step form scenario', () => {
  it('keeps values and field metadata while moving between steps', async () => {
    const form = new Form({ defaultValues: { name: '', address: '' } });
    const name = form.register('name', { required: 'Name required' });
    const address = form.register('address', { required: 'Address required' });

    await name.onChange({ target: { value: 'Ada' } });
    await name.onBlur();
    expect(await form.trigger('name')).toBe(true);
    expect(form.values.name).toBe('Ada');
    expect(form.fieldState.name?.isTouched).toBe(true);

    expect(await form.trigger('address')).toBe(false);
    expect(form.fieldState.address?.invalid).toBe(true);
    await address.onChange({ target: { value: 'London' } });
    expect(await form.trigger('address')).toBe(true);
    expect(form.values).toEqual({ name: 'Ada', address: 'London' });
    expect(form.fieldState.name?.isTouched).toBe(true);
  });
});
