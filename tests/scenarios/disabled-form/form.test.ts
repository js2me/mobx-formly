import { describe, expect, it, vi } from 'vitest';
import { Form } from '../../../src/index.js';

describe('disabled form scenario', () => {
  it('ignores registered input events but allows imperative value updates', async () => {
    const form = new Form({ defaultValues: { name: 'Ada' }, disabled: true, mode: 'onChange' });
    const field = form.register('name', { required: true });

    await field.onChange({ target: { value: '' } });
    await field.onBlur();
    expect(form.values.name).toBe('Ada');
    expect(form.fieldState.name).toMatchObject({ isTouched: false, isValidating: false });

    form.setValue('name', 'Grace');
    expect(form.values.name).toBe('Grace');
  });

  it('does not block an imperative submit', async () => {
    const onValid = vi.fn();
    const form = new Form({ values: { name: 'Ada' }, disabled: true });
    await form.handleSubmit({ onValid })();
    expect(onValid).toHaveBeenCalledWith({ name: 'Ada' }, form);
  });
});
