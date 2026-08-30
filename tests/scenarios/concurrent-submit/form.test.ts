import { describe, expect, it, vi } from 'vitest';
import { Form } from '../../../src/index.js';

describe('concurrent submit scenario', () => {
  it('keeps submitting state active until every submit finishes', async () => {
    const resolvers: Array<() => void> = [];
    const form = new Form({ values: { name: 'Ada' } });
    const submit = form.handleSubmit({
      onValid: () => new Promise<void>((resolve) => resolvers.push(resolve)),
    });

    const first = submit();
    const second = submit();
    await vi.waitFor(() => expect(resolvers).toHaveLength(2));
    expect(form.isSubmitting).toBe(true);

    resolvers[0]();
    await Promise.resolve();
    expect(form.isSubmitting).toBe(true);

    resolvers[1]();
    await Promise.all([first, second]);
    expect(form.isSubmitting).toBe(false);
    expect(form.submitCount).toBe(2);
  });
});
