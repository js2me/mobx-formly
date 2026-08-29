import { autorun } from 'mobx';
import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('observable mutation scenario', () => {
  it('reacts to direct values mutation while keeping form metadata explicit', () => {
    const form = new Form({ defaultValues: { count: 0 } });
    const values: number[] = [];
    const dispose = autorun(() => values.push(form.values.count));
    form.values.count = 5;
    expect(values).toEqual([0, 5]);
    expect(form.isDirty).toBe(false);
    form.setValue('count', 6);
    expect(form.isDirty).toBe(true);
    dispose();
  });
});
