import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('reset field scenario', () => {
  it('resets one nested field without affecting its sibling', () => {
    const form = new Form({ defaultValues: { profile: { name: 'Ada', city: 'London' } } });
    form.register('profile.name');
    form.register('profile.city');
    form.setValue('profile.name', 'Grace', { shouldTouch: true });
    form.setValue('profile.city', 'Paris');
    form.setError('profile.name', { type: 'server', message: 'Invalid name' });

    form.resetField('profile.name');

    expect(form.values.profile).toEqual({ name: 'Ada', city: 'Paris' });
    expect(form.errors['profile.name']).toBeUndefined();
    expect(form.fieldState['profile.name']).toMatchObject({ isDirty: false, isTouched: false, invalid: false });
    expect(form.fieldState['profile.city']?.isDirty).toBe(true);
  });
});
