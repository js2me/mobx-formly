import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('registration edge cases scenario', () => {
  it('re-registers a field with updated rules while preserving its ref', async () => {
    const form = new Form({ values: { name: '' } });
    const first = form.register('name', { required: 'Required' });
    const second = form.register('name', { minLength: { value: 3, message: 'Too short' } });

    expect(second.ref).toBe(first.ref);
    expect(await form.trigger('name')).toBe(false);
    expect(form.errors.name).toEqual({ type: 'minLength', message: 'Too short' });
  });

  it('unregisters a field without removing its parent object', () => {
    const form = new Form({ defaultValues: { profile: { name: 'Ada', city: 'London' } } });
    form.register('profile.name');
    form.unregister('profile.name');
    expect(form.values.profile).toEqual({ city: 'London' });
  });
});
