import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('dynamic array scenario', () => {
  it('updates nested items and removes an item without corrupting the array', () => {
    const form = new Form<{ items: Array<{ name: string }> }>({
      defaultValues: { items: [{ name: 'One' }, { name: 'Two' }] },
    });
    form.register('items.0.name');
    form.register('items.1.name');
    form.setValue('items.0.name', 'Updated');
    expect(form.values.items).toEqual([{ name: 'Updated' }, { name: 'Two' }]);
    expect(Array.isArray(form.values.items)).toBe(true);

    form.unregister('items.0.name');
    expect(form.values.items).toEqual([{}, { name: 'Two' }]);
    form.setValue('items.0.name', 'Reused');
    expect(form.values.items[0].name).toBe('Reused');
  });
});
