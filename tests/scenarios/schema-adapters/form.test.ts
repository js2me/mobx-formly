import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { z } from 'zod';
import { Form } from '../../../src/index.js';

describe('schema adapter scenario', () => {
  it('maps duplicate issues for a path to the first schema error', async () => {
    const form = new Form({
      values: { code: '' },
      schema: z.object({ code: z.string().min(2, 'Too short').regex(/^A/, 'Must start with A') }),
    });

    expect(await form.trigger()).toBe(false);
    expect(form.errors.code?.message).toBe('Too short');
  });

  it('accepts a Valibot transform while retaining the original form value', async () => {
    const form = new Form<{ age: string }>({
      values: { age: '21' },
      schema: v.object({ age: v.pipe(v.string(), v.transform(Number), v.number(), v.minValue(18)) }) as never,
    });

    expect(await form.trigger()).toBe(true);
    expect(form.values.age).toBe('21');
  });
});
