import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Form } from '../../../src/index.js';

describe('full user flow scenario', () => {
  it('moves from invalid input to a successful submission and back to invalid', async () => {
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    const form = new Form({
      defaultValues: { email: '' },
      mode: 'onChange',
      schema: z.object({ email: z.string().email('Invalid email') }),
    });
    const email = form.register('email');

    await email.onChange({ target: { value: 'not-an-email' } });
    expect(form.errors.email?.message).toBe('Invalid email');
    expect(form.fieldState.email?.isDirty).toBe(true);

    await email.onChange({ target: { value: 'ada@example.com' } });
    await email.onBlur();
    expect(form.errors.email).toBeUndefined();
    expect(form.fieldState.email?.isTouched).toBe(true);

    await form.handleSubmit({ onValid, onInvalid })();
    expect(onValid).toHaveBeenCalledWith({ email: 'ada@example.com' }, form);
    expect(onInvalid).not.toHaveBeenCalled();
    expect(form.isSubmitSuccessful).toBe(true);

    await email.onChange({ target: { value: 'broken' } });
    expect(form.errors.email).toBeDefined();
    await form.handleSubmit({ onValid, onInvalid })();
    expect(onInvalid).toHaveBeenCalledOnce();
    expect(form.isSubmitSuccessful).toBe(false);
    expect(form.isSubmitting).toBe(false);
  });
});
