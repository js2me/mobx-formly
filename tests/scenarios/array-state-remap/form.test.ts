import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseForm } from '../../../src/index.js';

describe('array mutation scenario', () => {
  it('rebuilds schema errors against current indexes after structural mutation', async () => {
    const form = new BaseForm({
      defaultValues: { items: [{ name: 'One' }, { name: 'Two' }, { name: 'Three' }] },
      schema: z.object({ items: z.array(z.object({ name: z.string().min(5, 'Too short') })) }),
    });
    form.register('items.0.name');
    form.register('items.1.name');
    form.register('items.2.name');
    expect(await form.trigger()).toBe(false);

    form.mutate(() => {
      form.values.items.splice(0, 1);
    });

    await vi.waitFor(() => {
      expect(form.errors.items?.[0]?.name?.message).toBe('Too short');
      expect(form.errors.items?.[1]?.name).toBeUndefined();
    });
    expect(form.values.items).toEqual([{ name: 'Two' }, { name: 'Three' }]);
  });

  it('rebuilds leaf dirty paths from the complete array after mutation', () => {
    const form = new BaseForm({ defaultValues: { items: [{ name: 'One' }, { name: 'Two' }] } });

    form.mutate(() => {
      form.values.items.splice(0, 0, { name: 'Fresh' });
    }, { shouldValidate: false });

    expect(form.dirtyFields).toEqual({
      'items.0.name': true,
      'items.1.name': true,
      'items.2.name': true,
    });
  });

  it('keeps touched state path-based across programmatic reorder', () => {
    const form = new BaseForm({ defaultValues: { items: [{ name: 'One' }, { name: 'Two' }] } });
    form.setValue('items.1.name', 'Edited', { shouldTouch: true });

    form.mutate(() => {
      form.values.items.reverse();
    }, { shouldValidate: false });

    expect(form.touchedFields['items.1.name']).toBe(true);
    expect(form.fieldState.items?.[1]?.name?.isTouched).toBe(true);
  });
});
