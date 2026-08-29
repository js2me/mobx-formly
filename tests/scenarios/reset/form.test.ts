import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('reset scenario', () => {
  it('resets during an invalid submit and supports selective preservation', async () => {
    const form = new Form({ defaultValues: { email: '' } });
    form.register('email', { required: 'Required' });
    await form.handleSubmit({ onValid: async () => undefined, onInvalid: async () => undefined })();
    form.setValue('email', 'ada@example.com', { shouldTouch: true });
    form.setError('email', { type: 'server', message: 'Try again' });
    form.reset({ email: 'new@example.com' }, { keepErrors: true, keepTouched: true, keepSubmitCount: true });
    expect(form.values.email).toBe('new@example.com');
    expect(form.errors.email?.message).toBe('Try again');
    expect(form.fieldState.email?.isTouched).toBe(true);
    expect(form.submitCount).toBe(1);
    form.reset();
    expect(form.values.email).toBe('new@example.com');
    expect(form.errors.email).toBeUndefined();
    expect(form.submitCount).toBe(0);
  });
});
