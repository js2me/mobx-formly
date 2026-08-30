import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('reset during submit scenario', () => {
  it('keeps reset state after a successful submit handler', async () => {
    const form = new Form({ defaultValues: { name: 'Ada' } });
    const submit = form.handleSubmit({
      onValid: async () => {
        form.reset({ name: 'Fresh' });
      },
    });

    await submit();

    expect(form.values.name).toBe('Fresh');
    expect(form.isSubmitting).toBe(false);
    expect(form.isSubmitted).toBe(false);
    expect(form.submitCount).toBe(0);
  });
});
