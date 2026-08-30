import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('event value extraction scenario', () => {
  it('extracts checkbox, checked radio, and unchecked radio values', async () => {
    const form = new Form({ defaultValues: { active: false, choice: 'old' } });
    const active = form.register('active');
    const choice = form.register('choice');

    await active.onChange({ target: { type: 'checkbox', checked: true } });
    await choice.onChange({ target: { type: 'radio', checked: true, value: 'new' } });
    expect(form.values).toEqual({ active: true, choice: 'new' });

    await choice.onChange({ target: { type: 'radio', checked: false, value: 'ignored' } });
    expect(form.values.choice).toBeUndefined();
  });

  it('uses a direct value and preserves a select value without browser globals', async () => {
    const form = new Form({ defaultValues: { choice: '' } });
    const field = form.register('choice');
    await field.onChange('direct');
    expect(form.values.choice).toBe('direct');
    await field.onChange({ target: { type: 'select-one', value: 'selected', multiple: false } });
    expect(form.values.choice).toBe('selected');
  });
});
