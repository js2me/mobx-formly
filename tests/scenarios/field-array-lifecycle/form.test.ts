import { describe, expect, it } from 'vitest';
import { autorun } from 'mobx';
import { Form } from '../../../src/index.js';

describe('field array lifecycle scenario', () => {
  it('supports add, update, remove, reorder, and reactive array changes', () => {
    const form = new Form<{ items: Array<{ name: string }> }>({ defaultValues: { items: [] } });
    const observed: number[] = [];
    const dispose = autorun(() => observed.push(form.values.items.length));
    form.values.items.push({ name: 'One' });
    form.values.items.push({ name: 'Two' });
    form.setValue('items.0.name', 'Updated');
    form.values.items.splice(0, 1);
    form.values.items.unshift({ name: 'New first' });
    expect(form.values.items).toEqual([{ name: 'New first' }, { name: 'Two' }]);
    expect(observed).toContain(2);
    dispose();
  });
});
