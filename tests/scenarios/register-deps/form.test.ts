import { describe, expect, it } from 'vitest';
import { BaseForm } from '../../../src/index.js';

describe('register deps scenario', () => {
  it('validates dependent fields on change even in onSubmit mode', async () => {
    const form = new BaseForm({ defaultValues: { password: '', confirm: '' } });
    const password = form.register('password', { deps: ['confirm'] });
    form.register('confirm', {
      validate: (value, values) => value === values.password || 'Must match',
    });

    await password.onChange({ target: { value: 'secret' } });
    expect(form.errors.confirm?.message).toBe('Must match');

    await form.register('confirm').onChange({ target: { value: 'secret' } });
    expect(form.errors.confirm).toBeUndefined();
  });

  it('accepts a single dep path and runs alongside own validation', async () => {
    const form = new BaseForm({
      defaultValues: { country: '', visa: '' },
      mode: 'onChange',
    });
    const country = form.register('country', { deps: 'visa', required: 'Required' });
    form.register('visa', { required: 'Visa required' });

    await country.onChange({ target: { value: 'UK' } });
    expect(form.errors.country).toBeUndefined();
    expect(form.errors.visa?.message).toBe('Visa required');
  });
});
