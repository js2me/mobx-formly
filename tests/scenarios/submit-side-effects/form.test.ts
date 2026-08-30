import { describe, expect, it, vi } from 'vitest';
import { Form } from '../../../src/index.js';

describe('submit side effects scenario', () => {
  it('keeps the successful result when an earlier concurrent request fails', async () => {
    let rejectFirst!: (error: Error) => void;
    let resolveSecond!: () => void;
    let calls = 0;
    const form = new Form({ values: { name: 'Ada' } });

    const submit = form.handleSubmit({
      onValid: () => {
        calls += 1;
        if (calls === 1) return new Promise<void>((_, reject) => { rejectFirst = reject; });
        return new Promise<void>((resolve) => { resolveSecond = resolve; });
      },
    });
    const first = submit();
    const second = submit();

    await vi.waitFor(() => expect(calls).toBe(2));
    rejectFirst(new Error('request failed'));
    await expect(first).rejects.toThrow('request failed');
    resolveSecond();
    await second;

    expect(form.isSubmitSuccessful).toBe(true);
    expect(form.isSubmitting).toBe(false);
  });

  it('submits a snapshot and lets the handler update the live form', async () => {
    const received: unknown[] = [];
    const form = new Form({ values: { status: 'draft' } });

    await form.handleSubmit({
      onValid: async (values) => {
        received.push(values);
        form.setValue('status', 'saving');
      },
    })();

    expect(received).toEqual([{ status: 'draft' }]);
    expect(form.values.status).toBe('saving');
  });

  it('keeps reset state when reset is called from the submit handler', async () => {
    const form = new Form({ defaultValues: { name: 'Ada' } });

    await form.handleSubmit({
      onValid: async () => form.reset({ name: 'Fresh' }),
    })();

    expect(form.values.name).toBe('Fresh');
    expect(form.isSubmitting).toBe(false);
    expect(form.isSubmitted).toBe(false);
    expect(form.isSubmitSuccessful).toBe(false);
    expect(form.submitCount).toBe(0);
  });
});
