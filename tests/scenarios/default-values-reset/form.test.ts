import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('default values reset scenario', () => {
  it('uses initial defaults for reset and adopts supplied reset values by default', () => {
    const form = new Form({ defaultValues: { name: 'Ada' } });
    form.setValue('name', 'Grace');
    form.reset();
    expect(form.values.name).toBe('Ada');

    form.reset({ name: 'Lin' });
    form.setValue('name', 'Kim');
    form.reset();
    expect(form.values.name).toBe('Lin');
  });

  it('does not replace defaults when keepDefaultValues is requested', () => {
    const form = new Form({ defaultValues: { name: 'Ada' } });
    form.reset({ name: 'Lin' }, { keepDefaultValues: true });
    form.setValue('name', 'Kim');
    form.reset();
    expect(form.values.name).toBe('Ada');
  });
});
