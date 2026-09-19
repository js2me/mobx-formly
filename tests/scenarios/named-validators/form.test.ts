import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('named validators scenario', () => {
  it('collects named validator failures in criteriaMode all', async () => {
    const form = new Form({ defaultValues: { name: 'XY' }, criteriaMode: 'all' });
    form.register('name', {
      validate: {
        short: (value) => String(value).length > 3 || 'Too short',
        lower: (value) => value === String(value).toLowerCase() || 'Must be lowercase',
      },
    });

    expect(await form.trigger('name')).toBe(false);
    expect(form.errors.name?.type).toBe('short');
    expect(form.errors.name?.types).toEqual({ short: 'Too short', lower: 'Must be lowercase' });
  });

  it('short-circuits to the first named failure in firstError mode', async () => {
    const form = new Form({ defaultValues: { name: 'XY' } });
    form.register('name', {
      validate: {
        short: (value) => String(value).length > 3 || 'Too short',
        lower: (value) => value === String(value).toLowerCase() || 'Must be lowercase',
      },
    });

    expect(await form.trigger('name')).toBe(false);
    expect(form.errors.name).toEqual({ type: 'short', message: 'Too short' });
  });

  it('supports message arrays from a single validator', async () => {
    const form = new Form({ defaultValues: { name: 'XY' }, criteriaMode: 'all' });
    form.register('name', {
      validate: {
        chars: (value) => {
          const messages: string[] = [];
          if (String(value).includes('X')) messages.push('No X allowed');
          if (String(value).includes('Y')) messages.push('No Y allowed');
          return messages.length ? messages : true;
        },
      },
    });

    expect(await form.trigger('name')).toBe(false);
    expect(form.errors.name?.message).toBe('No X allowed');
    expect(form.errors.name?.types).toEqual({ chars: ['No X allowed', 'No Y allowed'] });
  });

  it('keeps a single validate function working alongside built-in rules', async () => {
    const form = new Form({ defaultValues: { name: 'ab' } });
    form.register('name', { validate: (value) => String(value).length > 2 || 'Too short' });

    expect(await form.trigger('name')).toBe(false);
    expect(form.errors.name?.type).toBe('validate');
    expect(form.errors.name?.message).toBe('Too short');
  });
});
