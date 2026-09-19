import { expectTypeOf, test } from 'vitest';
import { z } from 'zod';
import * as v from 'valibot';
import { BaseForm } from '../src/index.js';

test('infers field types and paths from Zod schemas', () => {
  const form = new BaseForm({
    schema: z.object({
      email: z.string(),
      profile: z.object({ age: z.number() }),
    }),
  });

  expectTypeOf(form.values.email).toEqualTypeOf<string>();
  expectTypeOf<typeof form.values.profile.age>().toEqualTypeOf<number>();
  form.register('email');
  form.register('profile.age');
  // @ts-expect-error Unknown field paths are rejected.
  form.register('missing');
  form.setValue('profile.age', 42);
  // @ts-expect-error Field values are checked against their path.
  form.setValue('profile.age', '42');
});

test('infers field types and paths from Valibot schemas', () => {
  const form = new BaseForm({
    schema: v.object({
      name: v.string(),
      settings: v.object({ enabled: v.boolean() }),
    }),
  });

  expectTypeOf(form.values.name).toEqualTypeOf<string>();
  expectTypeOf<typeof form.values.settings.enabled>().toEqualTypeOf<boolean>();
  form.register('settings.enabled');
  // @ts-expect-error Unknown field paths are rejected.
  form.register('settings.missing');
  form.setValue('settings.enabled', false);
  // @ts-expect-error Field values are checked against their path.
  form.setValue('settings.enabled', 'false');
});

test('infers array field paths and values', () => {
  const form = new BaseForm<{ items: Array<{ label: string; count: number }> }>({
    defaultValues: { items: [{ label: '', count: 0 }] },
  });

  form.register('items');
  form.register('items.0.label');
  form.setValue('items.0.count', 1);
  // @ts-expect-error Array item fields must exist.
  form.register('items.0.missing');
  // @ts-expect-error Array item values are checked by path.
  form.setValue('items.0.count', '1');
});

test('exposes nested errors through the value tree', () => {
  const form = new BaseForm<{ remotes: Array<{ name: string }> }>({
    defaultValues: { remotes: [{ name: '' }] },
  });

  expectTypeOf(form.errors.remotes?.[0]?.name).toEqualTypeOf<import('../src/index.js').FieldError | undefined>();
  expectTypeOf(form.fieldState.remotes?.[0]?.name?.isValidating).toEqualTypeOf<boolean | undefined>();
});

test('infers Map field paths, root errors, and async mutate results', () => {
  const form = new BaseForm<{ settings: Map<'primary', { enabled: boolean }> }>({
    defaultValues: { settings: new Map([['primary', { enabled: true }]]) },
  });

  form.register('settings.primary.enabled');
  form.setValue('settings.primary.enabled', false);
  form.setError('root.server', { type: 'server' });
  form.clearErrors('root.server');
  expectTypeOf(form.errors.root?.server?.message).toEqualTypeOf<string | undefined>();
  expectTypeOf(form.mutate(() => {})).toEqualTypeOf<void>();
  expectTypeOf(form.mutate(async () => {})).toEqualTypeOf<Promise<void>>();
  // @ts-expect-error Map keys participate in checked field paths.
  form.setValue('settings.secondary.enabled', false);
});
