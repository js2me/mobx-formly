import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Form } from '../../../src/index.js';

describe('schema and rule precedence scenario', () => {
  it('uses the field rule when both schema and field validation fail', async () => {
    const form = new Form({
      values: { username: '' },
      schema: z.object({ username: z.string().min(3, 'Schema error') }),
    });
    form.register('username', { required: 'Required error' });

    expect(await form.trigger('username')).toBe(false);
    expect(form.errors.username).toEqual({ type: 'required', message: 'Required error' });
  });

  it('keeps a schema error when the rule passes, then clears it after schema validation passes', async () => {
    const form = new Form({
      values: { username: 'ab' },
      schema: z.object({ username: z.string().min(3, 'Schema error') }),
    });
    form.register('username', { minLength: { value: 1, message: 'Rule error' } });

    expect(await form.trigger('username')).toBe(false);
    expect(form.errors.username?.message).toBe('Schema error');

    form.setValue('username', 'abc');
    expect(await form.trigger('username')).toBe(true);
    expect(form.errors.username).toBeUndefined();
    expect(form.fieldState.username?.invalid).toBe(false);
  });

  it('does not remove an unrelated error while validating one field', async () => {
    const form = new Form({ values: { email: '', name: '' } });
    form.register('email', { required: 'Email required' });
    form.register('name', { required: 'Name required' });
    await form.trigger();

    form.setValue('email', 'ada@example.com');
    await form.trigger('email');
    expect(form.errors.email).toBeUndefined();
    expect(form.errors.name?.message).toBe('Name required');
  });
});
