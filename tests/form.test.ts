import { autorun } from 'mobx';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import * as v from 'valibot';
import { Form } from '../src/index.js';

describe('Form', () => {
  it('tracks values and field state reactively', async () => {
    const form = new Form({ defaultValues: { user: { name: '' } }, mode: 'onChange' });
    const observed: boolean[] = [];
    const dispose = autorun(() => observed.push(form.isDirty));

    form.register('user.name', { required: 'Name is required' });
    form.setValue('user.name', 'Ada');
    await Promise.resolve();

    expect(form.values).toEqual({ user: { name: 'Ada' } });
    expect(form.fieldState['user.name']).toMatchObject({ isDirty: true });
    expect(observed).toEqual([false, true]);
    dispose();
  });

  it('validates Zod schemas and submit handlers', async () => {
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    const form = new Form({
      defaultValues: { email: '' },
      schema: z.object({ email: z.string().email('Invalid email') }),
    });

    await form.handleSubmit({ onValid, onInvalid })();
    expect(onInvalid).toHaveBeenCalledOnce();
    expect(form.errors.email).toEqual({ type: 'invalid_format', message: 'Invalid email' });

    form.setValue('email', 'ada@example.test');
    await form.handleSubmit({ onValid })();
    expect(onValid).toHaveBeenCalledWith({ email: 'ada@example.test' }, form);
    expect(form.isValid).toBe(true);
    expect(form.isDirty).toBe(true);
  });

  it('provides RHF-like registration, reset, subscriptions, and refs', async () => {
    const form = new Form({ defaultValues: { age: 1 }, mode: 'onChange' });
    const register = form.register('age', { valueAsNumber: true, min: { value: 18, message: 'Too young' } });
    const listener = vi.fn();
    const unsubscribe = form.subscribe(listener);

    await register.onChange({ target: { value: '17' } });
    expect(form.values.age).toBe(17);
    expect(form.errors.age).toEqual({ type: 'min', message: 'Too young' });
    expect(form.refs.get('age')).toBe(register.ref);
    expect(listener).toHaveBeenCalledWith({ age: 17 }, { name: 'age' });

    form.reset();
    expect(form.values).toEqual({ age: 1 });
    expect(form.fieldState.age?.isDirty).toBe(false);
    unsubscribe();
  });

  it('accepts Valibot schemas through FormSchema', async () => {
    const form = new Form({
      defaultValues: { email: '' },
      schema: v.object({ email: v.pipe(v.string(), v.email('Invalid email')) }),
    });

    expect(await form.trigger()).toBe(false);
    expect(form.errors.email?.type).toBe('email');

    form.setValue('email', 'ada@example.test');
    expect(await form.trigger()).toBe(true);
  });
});
