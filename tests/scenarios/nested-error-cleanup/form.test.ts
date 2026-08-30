import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('nested error cleanup scenario', () => {
  it('clears root and nested field state together', () => {
    const form = new Form({ values: { profile: { email: '' } } });
    form.register('profile.email');
    form.setError('root', { type: 'server', message: 'Locked' });
    form.setError('profile.email', { type: 'server', message: 'Invalid' });

    form.clearErrors();

    expect(form.errors).toEqual({});
    expect(form.fieldState.root?.invalid).toBe(false);
    expect(form.fieldState['profile.email']?.invalid).toBe(false);
  });
});
