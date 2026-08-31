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
    expect(form.fieldState.user?.name).toMatchObject({ isDirty: true });
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

  it('provides RHF-like registration, reset, and refs', async () => {
    const form = new Form({ defaultValues: { age: 1 }, mode: 'onChange' });
    const register = form.register('age', { valueAsNumber: true, min: { value: 18, message: 'Too young' } });
    await register.onChange({ target: { value: '17' } });
    expect(form.values.age).toBe(17);
    expect(form.errors.age).toEqual({ type: 'min', message: 'Too young' });
    expect(form.refs.get('age')).toBe(register.ref);
    form.reset();
    expect(form.values).toEqual({ age: 1 });
    expect(form.fieldState.age?.isDirty).toBe(false);
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

  it('supports focus refs, select events, and custom schemas', async () => {
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

  it('supports constructor values and disabled forms', async () => {
    const form = new Form({ values: { name: 'Ada' }, disabled: true, mode: 'onChange' });
    expect(form.values.name).toBe('Ada');
    expect(form.disabled).toBe(true);
    const field = form.register('name', { required: true });
    await field.onChange({ target: { value: '' } });
    await field.onBlur();
    expect(form.values.name).toBe('Ada');
    expect(form.fieldState.name).toMatchObject({ isTouched: false, isValidating: false });

    form.setValue('name', 'Grace');
    expect(form.values.name).toBe('Grace');
  });

  it('ignores stale async validation results', async () => {
    const pending: Array<(result: boolean) => void> = [];
    const form = new Form<{ name: string }>({
      values: { name: '' },
      schema: {
        safeParseAsync: () => new Promise((resolve) => {
          pending.push((valid) => resolve(valid
            ? { success: true, data: { name: 'valid' } }
            : { success: false, error: { issues: [{ code: 'custom', path: ['name'], message: 'Stale' }] } }));
        }),
      },
    });
    form.register('name');

    const first = form.trigger('name');
    const second = form.trigger('name');
    while (pending.length < 2) await Promise.resolve();
    expect(form.fieldState.name?.isValidating).toBe(true);
    pending[1](true);
    expect(await second).toBe(true);
    pending[0](false);
    expect(await first).toBe(true);
    expect(form.errors.name).toBeUndefined();
    expect(form.fieldState.name?.isValidating).toBe(false);
  });

  it('normalizes rejected async validators into field errors', async () => {
    const form = new Form({ values: { name: 'Ada' } });
    form.register('name', { validate: async () => { throw new Error('network'); } });
    expect(await form.trigger('name')).toBe(false);
    expect(form.errors.name).toEqual({ type: 'validate', message: 'Validation failed' });
    expect(form.fieldState.name).toMatchObject({ invalid: true, isValidating: false });
  });

  it('honors every reset option', async () => {
    const form = new Form({ defaultValues: { name: 'Ada' } });
    form.register('name');
    form.setValue('name', 'Grace', { shouldTouch: true });
    await form.handleSubmit({ onValid: async () => undefined, onInvalid: async () => undefined })();
    form.setError('name', { type: 'manual' });

    form.reset({ name: 'Lin' }, { keepDefaultValues: true, keepDirty: true, keepTouched: true, keepErrors: true, keepIsSubmitted: true, keepSubmitCount: true });
    expect(form.values.name).toBe('Lin');
    expect(form.fieldState.name).toMatchObject({ isDirty: true, isTouched: true, invalid: true });
    expect(form.isSubmitted).toBe(true);
    expect(form.isSubmitSuccessful).toBe(false);
    expect(form.submitCount).toBe(1);

    form.clearErrors();
    await form.handleSubmit({ onValid: async () => undefined, onInvalid: async () => undefined })();
    expect(form.isSubmitSuccessful).toBe(true);
    form.reset({ name: 'Lin' }, { keepIsSubmitSuccessful: true, keepDefaultValues: true });
    expect(form.isSubmitted).toBe(false);
    expect(form.isSubmitSuccessful).toBe(true);

    form.reset();
    expect(form.values.name).toBe('Ada');
    expect(form.fieldState.name).toMatchObject({ isDirty: false, isTouched: false, invalid: false });
    expect(form.isSubmitted).toBe(false);
    expect(form.isSubmitSuccessful).toBe(false);
    expect(form.submitCount).toBe(0);

    form.setValue('name', 'Bea');
    form.reset({ name: 'Kim' }, { keepDefaultValues: false, keepDirty: false, keepTouched: false, keepErrors: false, keepIsSubmitted: false, keepSubmitCount: false });
    form.reset();
    expect(form.values.name).toBe('Kim');
  });

  it('exposes reactive default values', async () => {
    const form = new Form({ defaultValues: { name: 'Ada' } });
    const observed: Array<unknown> = [];
    const dispose = autorun(() => observed.push(form.defaultValues.name));

    expect(form.defaultValues).toEqual({ name: 'Ada' });
    form.setValue('name', 'Grace');
    expect(form.defaultValues.name).toBe('Ada');

    form.reset({ name: 'Lin' });
    expect(form.defaultValues).toEqual({ name: 'Lin' });
    form.resetField('name');
    expect(form.values.name).toBe('Lin');

    form.reset({ name: 'Kim' }, { keepDefaultValues: true });
    expect(form.defaultValues.name).toBe('Lin');
    expect(observed).toEqual(['Ada', 'Lin']);
    dispose();
  });

  it('honors keepValues, keepDirtyValues, and keepIsValid reset options', async () => {
    const form = new Form({
      defaultValues: { name: 'Ada', email: '', nested: { city: 'London' } },
    });
    form.register('name');
    form.register('email');
    form.register('nested.city');

    form.setValue('name', 'Grace');
    form.setError('email', { type: 'manual', message: 'Bad email' });
    expect(form.isValid).toBe(false);
    form.reset({ name: 'Lin', email: '', nested: { city: 'London' } }, { keepIsValid: true });
    expect(form.errors).toEqual({});
    expect(form.isValid).toBe(false);
    await form.trigger('email');
    expect(form.isValid).toBe(true);

    form.setValue('name', 'Grace');
    form.setError('email', { type: 'manual', message: 'Bad email' });
    form.reset({ name: 'Lin', email: '', nested: { city: 'London' } }, { keepValues: true });
    expect(form.values).toEqual({ name: 'Grace', email: '', nested: { city: 'London' } });
    expect(form.defaultValues).toEqual({ name: 'Lin', email: '', nested: { city: 'London' } });

    form.reset({ name: 'Kim', email: '', nested: { city: 'Oslo' } });
    form.setValue('name', 'Grace');
    form.setValue('nested.city', 'Paris');
    form.reset(
      { name: 'Kim', email: 'kim@example.test', nested: { city: 'Oslo' } },
      { keepDirtyValues: true },
    );
    expect(form.values.name).toBe('Grace');
    expect(form.values.nested.city).toBe('Paris');
    expect(form.values.email).toBe('kim@example.test');
    expect(form.dirtyFields).toEqual({ name: true, 'nested.city': true });
    expect(form.isDirty).toBe(true);
    expect(form.fieldState.name?.isDirty).toBe(true);

    form.reset({ name: 'Kim', email: 'kim@example.test', nested: { city: 'Oslo' } });
    expect(form.values).toEqual({ name: 'Kim', email: 'kim@example.test', nested: { city: 'Oslo' } });
    expect(form.dirtyFields).toEqual({});
  });

  it('keeps validating state through reset with keepIsValidating', async () => {
    const pending: Array<(valid: boolean) => void> = [];
    const form = new Form<{ name: string }>({
      defaultValues: { name: '' },
      schema: {
        safeParseAsync: () => new Promise((resolve) => {
          pending.push((valid) => resolve(valid
            ? { success: true as const, data: { name: '' } }
            : { success: false as const, error: { issues: [{ code: 'custom', path: ['name'], message: 'Bad' }] } }));
        }),
      },
    });
    form.register('name');

    const first = form.trigger('name');
    while (pending.length < 1) await Promise.resolve();
    expect(form.validatingFields.name).toBe(true);
    expect(form.fieldState.name?.isValidating).toBe(true);

    form.reset({ name: 'Ada' }, { keepIsValidating: true });
    expect(form.validatingFields.name).toBe(true);
    expect(form.fieldState.name?.isValidating).toBe(true);

    pending[0](false);
    await first;
    expect(form.errors).toEqual({});
    expect(form.validatingFields.name).toBe(true);
    expect(form.fieldState.name?.isValidating).toBe(true);

    const second = form.trigger('name');
    while (pending.length < 2) await Promise.resolve();
    pending[1](true);
    expect(await second).toBe(true);
    expect(form.validatingFields.name).toBeUndefined();
    expect(form.fieldState.name?.isValidating).toBe(false);

    const third = form.trigger('name');
    while (pending.length < 3) await Promise.resolve();
    form.reset({ name: 'Ada' }, { keepIsValidating: true });
    expect(form.validatingFields.name).toBe(true);
    form.reset({ name: 'Ada' });
    expect(form.validatingFields.name).toBeUndefined();
    expect(form.fieldState.name?.isValidating).toBe(false);
    pending[2](true);
    await third;
  });

  it('reports schema root issues and preserves unrelated errors', async () => {
    const form = new Form({
      values: { first: 'Ada', second: 'Lin' },
      schema: {
        safeParseAsync: async () => ({
          success: false as const,
          error: { issues: [{ code: 'custom', path: [], message: 'Form is locked' }, { code: 'custom', path: ['second'], message: 'Second invalid' }] },
        }),
      },
    });
    form.register('first');
    form.register('second');
    form.setError('first', { type: 'old', message: 'Old error' });
    expect(await form.trigger('second')).toBe(false);
    expect(form.errors.root).toBeUndefined();
    expect(form.errors.second?.message).toBe('Second invalid');
    expect(form.errors.first?.message).toBe('Old error');
    expect(await form.trigger()).toBe(false);
    expect(form.errors.root?.message).toBe('Form is locked');
    expect(form.fieldState.root?.invalid).toBe(true);
  });

  it('settles concurrent trigger and submit validations', async () => {
    const pending: Array<(valid: boolean) => void> = [];
    const form = new Form<{ name: string }>({
      values: { name: 'Ada' },
      schema: {
        safeParseAsync: () => new Promise((resolve) => {
          pending.push((valid) => resolve(valid
            ? { success: true, data: { name: 'Ada' } }
            : { success: false, error: { issues: [{ code: 'custom', path: ['name'], message: 'Invalid' }] } }));
        }),
      },
    });
    form.register('name');
    const trigger = form.trigger('name');
    const submit = form.handleSubmit({ onValid: async () => undefined, onInvalid: async () => undefined })();
    while (pending.length < 2) await Promise.resolve();
    pending[0](false);
    pending[1](true);
    await trigger;
    await submit;
    expect(form.fieldState.name?.isValidating).toBe(false);
    expect(form.isSubmitting).toBe(false);
    expect(form.errors.name).toBeUndefined();
  });

  it('combines schema and rule errors without keeping stale results', async () => {
    const form = new Form({
      values: { email: '' },
      schema: z.object({ email: z.string().min(5, 'Schema error') }),
    });
    form.register('email', { required: 'Rule error' });
    expect(await form.trigger('email')).toBe(false);
    expect(form.errors.email?.message).toBe('Rule error');
    form.setValue('email', 'x');
    expect(await form.trigger('email')).toBe(false);
    expect(form.errors.email?.message).toBe('Schema error');
    form.setValue('email', '');
    expect(await form.trigger('email')).toBe(false);
    expect(form.errors.email?.message).toBe('Rule error');
    form.setValue('email', 'valid@example.com');
    expect(await form.trigger('email')).toBe(true);
    expect(form.errors.email).toBeUndefined();
  });

  it('updates array fields at runtime without replacing the array', () => {
    const form = new Form<{ items: Array<{ name: string; quantity: number }> }>({
      defaultValues: { items: [{ name: 'One', quantity: 1 }, { name: 'Two', quantity: 2 }] },
    });

    form.register('items.0.name');
    form.register('items.1.quantity');
    form.setValue('items.0.name', 'Updated');
    form.setValue('items.1.quantity', 5);

    expect(Array.isArray(form.values.items)).toBe(true);
    expect(form.values.items).toEqual([{ name: 'Updated', quantity: 1 }, { name: 'Two', quantity: 5 }]);
    expect(form.fieldState.items?.[0]?.name?.isDirty).toBe(true);
  });

  it('tracks multiple direct mutations through mutate', async () => {
    const form = new Form({
      defaultValues: { items: [{ name: 'One' }], count: 0 },
      schema: z.object({ items: z.array(z.object({ name: z.string() })), count: z.number().min(1, 'Count is required') }),
    });
    form.mutate(() => {
      form.values.items.push({ name: 'Two' });
      form.values.count = 1;
    });

    expect(form.dirtyFields.items).toBe(true);
    expect(form.dirtyFields.count).toBe(true);
    await vi.waitFor(() => expect(form.errors.count).toBeUndefined());
  });

  it('tracks nested mutations and validates changed fields', async () => {
    const form = new Form({
      defaultValues: { profile: { name: 'Ada' } },
      schema: z.object({ profile: z.object({ name: z.string().min(3, 'Name is too short') }) }),
    });
    form.register('profile.name');

    form.mutate(() => {
      form.values.profile.name = 'Al';
    });

    expect(form.dirtyFields['profile.name']).toBe(true);
    await vi.waitFor(() => expect(form.errors.profile?.name?.message).toBe('Name is too short'));
  });

  it('respects mutate metadata options', async () => {
    const form = new Form({
      defaultValues: { count: 1 },
      schema: z.object({ count: z.number().min(3, 'Count is too small') }),
    });

    form.mutate(() => {
      form.values.count = 3;
    }, { shouldDirty: false, shouldValidate: false });

    expect(form.dirtyFields.count).toBeUndefined();
    expect(form.errors.count).toBeUndefined();

    form.mutate(() => {
      form.values.count = 2;
    });

    expect(form.dirtyFields.count).toBe(true);
    await vi.waitFor(() => expect(form.errors.count?.message).toBe('Count is too small'));
  });

  it('cleans up cached mutate observers after inactivity', () => {
    vi.useFakeTimers();
    try {
      const form = new Form({ defaultValues: { count: 0 } });

      form.mutate(() => { form.values.count = 1; });
      expect((form as unknown as { valueObservers?: unknown[] }).valueObservers?.length).toBeGreaterThan(0);

      vi.advanceTimersByTime(10 * 60 * 1000);

      expect((form as unknown as { valueObservers?: unknown[] }).valueObservers).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('runs complex asynchronous schema refinements and maps every issue', async () => {
    const schema = z.object({
      username: z.string(),
      confirmation: z.string(),
    }).superRefine(async (value, context) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      if (value.username === 'taken') context.addIssue({ code: 'custom', path: ['username'], message: 'Username is taken' });
      if (value.confirmation !== value.username) context.addIssue({ code: 'custom', path: ['confirmation'], message: 'Does not match' });
    });
    const form = new Form({
      values: { username: 'taken', confirmation: 'other' },
      schema,
    });

    expect(await form.trigger()).toBe(false);
    expect(form.errors.username?.message).toBe('Username is taken');
    expect(form.errors.confirmation?.message).toBe('Does not match');
    form.setValue('username', 'available');
    form.setValue('confirmation', 'available');
    expect(await form.trigger()).toBe(true);
    expect(form.errors.username).toBeUndefined();
    expect(form.errors.confirmation).toBeUndefined();
  });
});
