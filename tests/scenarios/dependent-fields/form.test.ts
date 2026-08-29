import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('dependent fields scenario', () => {
  it('resets and validates a dependent field when its source changes', async () => {
    const form = new Form({ defaultValues: { country: 'UK', city: '' }, mode: 'onChange' });
    form.register('country');
    form.register('city', { validate: (value, values) => value === (values.country === 'UK' ? 'London' : 'Paris') || 'Choose a valid city' });
    form.setValue('city', 'London');
    await form.trigger('city');
    expect(form.isValid).toBe(true);

    form.setValue('country', 'France');
    form.setValue('city', '');
    await form.trigger('city');
    expect(form.errors.city?.message).toBe('Choose a valid city');
    form.setValue('city', 'Paris');
    await form.trigger('city');
    expect(form.errors.city).toBeUndefined();
  });
});
