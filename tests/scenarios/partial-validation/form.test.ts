import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Form } from '../../../src/index.js';

describe('partial validation scenario', () => {
  it('validates only the requested fields while preserving unrelated errors', async () => {
    const form = new Form({
      values: { email: '', password: '' },
      schema: z.object({
        email: z.string().email('Email is invalid'),
        password: z.string().min(8, 'Password is too short'),
      }),
    });
    form.register('email');
    form.register('password');

    expect(await form.trigger()).toBe(false);
    expect(form.errors.email).toBeDefined();
    expect(form.errors.password).toBeDefined();

    form.setValue('email', 'ada@example.com');
    expect(await form.trigger('email')).toBe(true);
    expect(form.errors.email).toBeUndefined();
    expect(form.errors.password).toBeDefined();

    form.setValue('password', 'short');
    expect(await form.trigger(['email', 'password'])).toBe(false);
    expect(form.errors.email).toBeUndefined();
    expect(form.errors.password?.message).toBe('Password is too short');
  });

  it('reports root schema issues when there are no field paths', async () => {
    const form = new Form({
      values: { password: 'secret', confirmation: 'different' },
      schema: z.object({ password: z.string(), confirmation: z.string() }).refine(
        (value) => value.password === value.confirmation,
        { path: [], message: 'Passwords must match' },
      ),
    });

    expect(await form.trigger()).toBe(false);
    expect(form.errors.root?.message).toBe('Passwords must match');
  });
});
