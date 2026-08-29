import { describe, expect, it, vi } from 'vitest';
import { Form } from '../../../src/index.js';

describe('subscription lifecycle scenario', () => {
  it('supports multiple listeners and independent unsubscribe', () => {
    const form = new Form({ values: { name: '' } });
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = form.subscribe(first);
    form.subscribe(second);
    form.setValue('name', 'Ada');
    unsubscribeFirst();
    form.setValue('name', 'Grace');
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledTimes(2);
  });
});
