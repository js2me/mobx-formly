import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Form } from '../../../src/index.js';

describe('array mutation scenario', () => {
  it('tracks and validates a nested field added through direct mutation', async () => {
    const form = new Form({
      defaultValues: { items: [{ name: 'One' }] },
      schema: z.object({ items: z.array(z.object({ name: z.string().min(3, 'Name is too short') })) }),
    });
    form.register('items.1.name');

    form.mutate(() => {
      form.values.items.push({ name: 'Two' });
    });
    form.mutate(() => {
      form.values.items[1].name = 'No';
    });

    expect(form.dirtyFields['items.1.name']).toBe(true);
    await vi.waitFor(() => expect(form.errors.items?.[1]?.name?.message).toBe('Name is too short'));
  });

  it('clears errors after removing and revalidating an array item', async () => {
    const form = new Form({
      values: { items: [{ name: '' }, { name: 'Two' }] },
      schema: z.object({ items: z.array(z.object({ name: z.string().min(1, 'Name is required') })) }),
    });
    form.register('items.0.name');
    form.register('items.1.name');

    expect(await form.trigger()).toBe(false);
    expect(form.errors.items?.[0]?.name).toBeDefined();

    form.mutate(() => {
      form.values.items.reverse();
    }, { shouldValidate: false });
    expect(await form.trigger()).toBe(false);
    expect(form.errors.items?.[1]?.name).toBeDefined();

    form.mutate(() => {
      form.values.items.splice(1, 1);
    }, { shouldValidate: false });
    expect(form.values.items).toEqual([{ name: 'Two' }]);

    expect(await form.trigger()).toBe(true);
    expect(form.errors).toEqual({});
  });
});
