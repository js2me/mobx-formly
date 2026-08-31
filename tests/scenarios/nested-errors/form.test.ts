import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Form } from '../../../src/index.js';

describe('nested error precedence scenario', () => {
  it('clears one nested error without affecting sibling errors', async () => {
    const form = new Form({
      values: { profile: { email: '', name: '' } },
      schema: z.object({ profile: z.object({ email: z.string().email(), name: z.string().min(2) }) }),
    });
    form.register('profile.email');
    form.register('profile.name');
    const errors = form.errors;
    expect(await form.trigger()).toBe(false);
    expect(form.errors.profile?.email).toBeDefined();
    expect(form.errors.profile?.name).toBeDefined();
    form.clearErrors('profile.email');
    expect(form.errors.profile?.email).toBeUndefined();
    expect(form.errors.profile?.name).toBeDefined();
    form.setError('profile.email', { type: 'manual' });
    form.clearErrors(['profile.email', 'profile.name']);
    expect(form.errors).toEqual({});
    expect(form.errors).toBe(errors);
  });
});
