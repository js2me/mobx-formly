import { autorun } from 'mobx';
import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('MobX derived state scenario', () => {
  it('observes validity and field error changes through computed state', () => {
    const form = new Form({ values: { name: 'Ada' } });
    form.register('name');
    const observed: Array<{ valid: boolean; message?: string }> = [];
    const dispose = autorun(() => observed.push({ valid: form.isValid, message: form.fieldState.name?.error?.message }));

    form.setError('name', { type: 'server', message: 'Taken' });
    form.clearErrors('name');
    dispose();

    expect(observed).toEqual([
      { valid: true, message: undefined },
      { valid: false, message: 'Taken' },
      { valid: true, message: undefined },
    ]);
  });
});
