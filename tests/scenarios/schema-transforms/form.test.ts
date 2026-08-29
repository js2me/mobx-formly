import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Form } from '../../../src/index.js';

describe('schema transform scenario', () => {
  it('validates transformed input and submits the form value snapshot', async () => {
    const onValid = vi.fn();
    const schema = z.object({ age: z.string().transform(Number).pipe(z.number().min(18)) });
    const form = new Form<{ age: string }>({
      values: { age: '21' },
      schema: schema as never,
    });
    await form.handleSubmit({ onValid })();
    expect(onValid).toHaveBeenCalledWith({ age: '21' }, form);
  });
});
