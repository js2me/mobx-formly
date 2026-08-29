import { autorun } from 'mobx';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import * as v from 'valibot';
import { createForm, Form } from '../src/index.js';
import { deleteAtPath, extractValue, getAtPath, setAtPath } from '../src/utils.js';

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

  it('validates registration rules and all value transforms', async () => {
    const form = new Form({ defaultValues: { text: '', count: 0, date: new Date(0) }, mode: 'all' });
    const required = form.register('text', {
      required: true,
      minLength: { value: 2, message: 'Short' },
      maxLength: { value: 5, message: 'Long' },
      pattern: { value: /^ok$/, message: 'Pattern' },
      validate: async (value) => value === 'ok' || 'Custom',
    });
    await form.trigger('text');
    expect(form.fieldState.text?.error?.type).toBe('required');
    await required.onChange({ target: { value: 'x' } });
    expect(form.errors.text?.type).toBe('minLength');
    await required.onChange({ target: { value: 'toolong' } });
    expect(form.errors.text?.type).toBe('maxLength');
    await required.onChange({ target: { value: 'bad' } });
    expect(form.errors.text?.type).toBe('pattern');
    await required.onChange({ target: { value: 'ok' } });
    expect(form.errors.text).toBeUndefined();

    const count = form.register('count', { valueAsNumber: true, max: { value: 10 } });
    await count.onChange({ target: { value: '11' } });
    expect(form.values.count).toBe(11);
    expect(form.errors.count?.type).toBe('max');
    const date = form.register('date', { valueAsDate: true });
    await date.onChange({ target: { value: '2020-01-01' } });
    expect(form.values.date).toBeInstanceOf(Date);
    form.register('text', { setValueAs: (value) => String(value).trim() });
    form.setValue('text', '  ok  ');
    expect(form.values.text).toBe('  ok  ');
  });

  it('supports manual errors, touch state, reset options, and unregister', async () => {
    const form = new Form({ defaultValues: { name: 'Ada', extra: true }, mode: 'onBlur' });
    const field = form.register('name', { required: 'Required' });
    await field.onBlur();
    expect(form.fieldState.name).toMatchObject({ isTouched: true, isValidating: false });
    form.setError('name', { type: 'manual', message: 'Nope' });
    expect(form.fieldState.name?.invalid).toBe(true);
    form.clearErrors('name');
    expect(form.fieldState.name?.invalid).toBe(false);
    form.setError('name', { type: 'manual' });
    form.clearErrors();
    expect(form.errors).toEqual({});

    form.setValue('name', 'Grace', { shouldTouch: true });
    form.setValue('extra', false);
    form.reset({ name: 'Lin', extra: false }, {
      keepDirty: true, keepTouched: true, keepErrors: true, keepIsSubmitted: true, keepSubmitCount: true,
    });
    expect(form.values).toEqual({ name: 'Lin', extra: false });
    expect(form.fieldState.name?.isDirty).toBe(true);
    form.resetField('name');
    expect(form.values.name).toBe('Lin');
    form.unregister('extra');
    expect('extra' in form.values).toBe(false);
  });

  it('supports subscriptions, focus refs, select events, and custom schemas', async () => {
    const form = createForm({
      defaultValues: { choice: '', active: false },
      schema: { safeParseAsync: async (value: unknown) => ({ success: true as const, data: value as { choice: string; active: boolean } }) },
    });
    const choice = form.register('choice');
    const active = form.register('active');
    const input = { focus: vi.fn() } as unknown as HTMLElement;
    choice.ref(input);
    form.setFocus('choice');
    expect(input.focus).toHaveBeenCalledOnce();
    await choice.onChange({ target: { value: 'one', multiple: false } });
    await active.onChange({ target: { type: 'checkbox', checked: true } });
    expect(form.values).toEqual({ choice: 'one', active: true });
    const select = { value: 'one', type: 'select-one', multiple: true };
    await choice.onChange({ target: select });
    expect(form.values.choice).toBe('one');
    expect(await form.trigger()).toBe(true);
    const unsub = form.subscribe(() => undefined);
    unsub();
    form.reset(undefined, { keepDefaultValues: true });
  });

  it('handles safe path utilities and SSR-compatible values', () => {
    const data: Record<string, unknown> = {};
    setAtPath(data, 'profile.name', 'Ada');
    setAtPath(data, 'profile.tags.0', 'typescript');
    expect(getAtPath(data, 'profile.name')).toBe('Ada');
    expect(getAtPath(data, '__proto__.polluted')).toBeUndefined();
    expect(getAtPath(null, 'name')).toBeUndefined();
    setAtPath(data, '__proto__.polluted', true);
    deleteAtPath(data, 'profile.name');
    deleteAtPath(data, '__proto__.polluted');
    deleteAtPath(data, 'profile.missing');
    expect(getAtPath(data, 'profile.name')).toBeUndefined();
    expect(extractValue('plain')).toBe('plain');
    expect(extractValue(null)).toBeNull();
    expect(extractValue({ target: { type: 'radio', checked: false, value: 'no' } })).toBeUndefined();
    expect(extractValue({ target: { type: 'radio', checked: true, value: 'yes' } })).toBe('yes');
  });
});
