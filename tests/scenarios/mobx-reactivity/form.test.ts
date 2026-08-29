import { autorun } from 'mobx';
import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('MobX granular reactivity scenario', () => {
  it('does not notify an email observer when only password changes', () => {
    const form = new Form({ values: { email: '', password: '' } });
    form.register('email');
    form.register('password');
    const observed: Array<string | undefined> = [];
    const dispose = autorun(() => observed.push(form.fieldState.email?.error?.message));
    form.setError('password', { type: 'server', message: 'Bad password' });
    expect(observed).toEqual([undefined]);
    form.setError('email', { type: 'server', message: 'Bad email' });
    expect(observed).toEqual([undefined, 'Bad email']);
    dispose();
  });
});
