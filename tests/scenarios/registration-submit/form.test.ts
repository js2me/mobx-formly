import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Form } from '../../../src/index.js';

describe('registration and submit scenario', () => {
  it('validates, reports errors, then submits corrected values', async () => {
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    const form = new Form({
      defaultValues: { email: '', age: 0 },
      mode: 'onBlur',
      schema: z.object({ email: z.string().email(), age: z.number().min(18) }),
    });
    const email = form.register('email', { required: 'Email required' });
    const age = form.register('age', { valueAsNumber: true, min: { value: 18, message: 'Adult only' } });

    await email.onBlur();
    await age.onBlur();
    expect(form.isValid).toBe(false);
    expect(form.fieldState.email?.invalid).toBe(true);
    expect(form.fieldState.age?.isTouched).toBe(true);

    await form.handleSubmit({ onValid, onInvalid })();
    expect(onInvalid).toHaveBeenCalledOnce();
    expect(form.isSubmitting).toBe(false);
    expect(form.submitCount).toBe(1);

    await email.onChange({ target: { value: 'ada@example.com' } });
    await age.onChange({ target: { value: '21' } });
    await form.handleSubmit({ onValid, onInvalid })();
    expect(onValid).toHaveBeenCalledWith({ email: 'ada@example.com', age: 21 }, form);
    expect(form.isSubmitSuccessful).toBe(true);
    expect(form.submitCount).toBe(2);
  });
});
