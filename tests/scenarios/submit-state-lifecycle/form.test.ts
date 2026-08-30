import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Form } from '../../../src/index.js';

describe('submit state lifecycle scenario', () => {
  it('clears a previous success when a later submit is invalid', async () => {
    const form = new Form({ defaultValues: { email: 'ada@example.com' }, schema: z.object({ email: z.string().email() }) });
    await form.handleSubmit({ onValid: async () => undefined })();
    expect(form.isSubmitSuccessful).toBe(true);

    form.setValue('email', 'not-an-email');
    await form.handleSubmit({ onValid: async () => undefined, onInvalid: async () => undefined })();

    expect(form.isSubmitSuccessful).toBe(false);
    expect(form.isSubmitting).toBe(false);
  });

  it('clears submitting state when the invalid handler throws', async () => {
    const onInvalid = vi.fn(async () => { throw new Error('render failed'); });
    const form = new Form({ defaultValues: { email: '' } });
    form.register('email', { required: true });

    await expect(form.handleSubmit({ onValid: async () => undefined, onInvalid })()).rejects.toThrow('render failed');

    expect(onInvalid).toHaveBeenCalledOnce();
    expect(form.isSubmitting).toBe(false);
    expect(form.isSubmitted).toBe(true);
  });
});
