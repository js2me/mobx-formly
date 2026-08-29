import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('submit failure scenario', () => {
  it('always clears isSubmitting when the submit handler fails', async () => {
    const form = new Form({ values: { name: 'Ada' } });
    const submit = form.handleSubmit({ onValid: async () => { throw new Error('API failed'); } });
    await expect(submit()).rejects.toThrow('API failed');
    expect(form.isSubmitting).toBe(false);
    expect(form.isSubmitSuccessful).toBe(false);
    expect(form.isSubmitted).toBe(true);
    expect(form.submitCount).toBe(1);
  });
});
