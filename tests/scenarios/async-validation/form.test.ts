import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('async server validation scenario', () => {
  it('ignores out-of-order server responses', async () => {
    const requests: Array<{ value: string; resolve: (valid: boolean) => void }> = [];
    const form = new Form({ values: { username: '' } });
    form.register('username', {
      validate: (value) => new Promise<boolean>((resolve) => requests.push({ value: String(value), resolve })),
    });

    form.setValue('username', 'old');
    form.setValue('username', 'new');
    const trigger = form.trigger('username');
    const submit = form.handleSubmit({ onValid: async () => undefined, onInvalid: async () => undefined })();
    while (requests.length < 2) await Promise.resolve();
    requests[1].resolve(true);
    requests[0].resolve(false);
    await trigger;
    await submit;
    expect(form.values.username).toBe('new');
    expect(form.errors.username).toBeUndefined();
    expect(form.fieldState.username?.isValidating).toBe(false);
  });

  it('exposes a rejected server request as a validation error', async () => {
    const form = new Form({ values: { username: 'ada' } });
    form.register('username', { validate: async () => { throw new Error('offline'); } });
    expect(await form.trigger('username')).toBe(false);
    expect(form.fieldState.username?.error?.message).toBe('Validation failed');
    expect(form.fieldState.username?.isValidating).toBe(false);
  });
});
