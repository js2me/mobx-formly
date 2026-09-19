import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseForm } from '../../../src/index.js';

describe('schema transform scenario', () => {
  it('submits schema-transformed values while keeping raw values observable', async () => {
    const onValid = vi.fn();
    const schema = z.object({ age: z.string().transform(Number).pipe(z.number().min(18)) });
    const form = new BaseForm<{ age: string }>({
      values: { age: '21' },
      schema: schema as never,
    });
    await form.handleSubmit({ onValid })();
    expect(onValid).toHaveBeenCalledWith({ age: 21 }, form);
    expect(form.values.age).toBe('21');
  });

  it('keeps the raw snapshot for onInvalid when the schema rejects the input', async () => {
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    const schema = z.object({ age: z.string().transform(Number).pipe(z.number().min(18)) });
    const form = new BaseForm<{ age: string }>({
      values: { age: '10' },
      schema: schema as never,
    });
    await form.handleSubmit({ onValid, onInvalid })();
    expect(onValid).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledOnce();
  });

  it('coerces values for resolver-based submit through transformed output', async () => {
    const onValid = vi.fn();
    const form = new BaseForm<{ age: string }>({
      values: { age: '21' },
      resolver: (values) => ({ values: { age: Number(values.age) }, errors: {} }),
    });
    await form.handleSubmit({ onValid })();
    expect(onValid).toHaveBeenCalledWith({ age: 21 }, form);
  });
});
