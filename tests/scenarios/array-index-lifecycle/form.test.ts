import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('array index lifecycle scenario', () => {
  it('keeps values valid while registered metadata remains path keyed after reorder', () => {
    const form = new Form<{ items: Array<{ name: string }> }>({ defaultValues: { items: [{ name: 'One' }, { name: 'Two' }] } });
    form.register('items.0.name');
    form.register('items.1.name');
    form.setValue('items.0.name', 'Changed', { shouldTouch: true });
    form.setError('items.1.name', { type: 'manual' });

    form.mutate(() => form.values.items.reverse(), { shouldValidate: false });

    expect(form.values.items).toEqual([{ name: 'Two' }, { name: 'Changed' }]);
    expect(form.fieldState.items?.[0]?.name?.isTouched).toBe(true);
    expect(form.errors.items?.[1]?.name).toBeDefined();
  });

  it('cleans metadata when the registered index is explicitly unregistered', () => {
    const form = new Form<{ items: Array<{ name: string }> }>({ defaultValues: { items: [{ name: 'One' }] } });
    form.register('items.0.name');
    form.setError('items.0.name', { type: 'manual' });
    form.setValue('items.0.name', 'Changed', { shouldTouch: true });

    form.unregister('items.0.name');

    expect(form.errors.items?.[0]?.name).toBeUndefined();
    expect(form.dirtyFields['items.0.name']).toBeUndefined();
    expect(form.touchedFields['items.0.name']).toBeUndefined();
    expect(form.fieldState.items?.[0]?.name).toBeUndefined();
  });
});
