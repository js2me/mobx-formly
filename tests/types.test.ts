import { expectTypeOf, test } from 'vitest';
import { z } from 'zod';
import * as v from 'valibot';
import { Form } from '../src/index.js';

test('infers field types and paths from Zod schemas', () => {
  const form = new Form({
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
  const form = new Form({
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
