import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseForm } from '../../../src/index.js';

describe('validity warm-up scenario', () => {
  it('validates the schema on the first isValid read and flips to false', async () => {
    const form = new BaseForm({
      defaultValues: { email: '' },
      schema: z.object({ email: z.string().email('Bad email') }),
    });

    expect(form.isValid).toBe(true);
    await vi.waitFor(() => expect(form.isValid).toBe(false));
    expect(form.errors.email?.message).toBe('Bad email');
    expect(form.validatingFields).toEqual({});
  });

  it('keeps valid defaults valid and still runs the warm-up pass', async () => {
    let runs = 0;
    const form = new BaseForm<{ email: string }>({
      defaultValues: { email: 'ada@example.test' },
      schema: {
        safeParseAsync: async (value) => {
          runs += 1;
          return { success: true as const, data: value as { email: string } };
        },
      },
    });

    expect(form.isValid).toBe(true);
    await vi.waitFor(() => expect(runs).toBe(1));
    expect(form.errors).toEqual({});
    expect(form.isValid).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runs).toBe(1);
  });

  it('re-warms after reset with new values', async () => {
    const form = new BaseForm({
      defaultValues: { email: 'ada@example.test' },
      schema: z.object({ email: z.string().email('Bad email') }),
    });
    expect(form.isValid).toBe(true);
    await vi.waitFor(() => expect(form.errors).toEqual({}));

    form.reset({ email: 'nope' });
    await vi.waitFor(() => expect(form.isValid).toBe(false));
    expect(form.errors.email?.message).toBe('Bad email');
  });

  it('leaves rule-only forms optimistic until an actual validation', () => {
    const form = new BaseForm({ defaultValues: { name: '' } });
    form.register('name', { required: 'Required' });
    expect(form.isValid).toBe(true);
    expect(form.errors).toEqual({});
  });
});
