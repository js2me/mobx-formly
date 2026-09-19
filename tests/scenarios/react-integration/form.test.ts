import { observer } from 'mobx-react-lite';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseForm, type Form } from '../../../src/index.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Values = { email: string };

const EmailForm = observer(({ form, onValid }: { form: Form<Values>; onValid: (values: Values) => void }) => {
  const field = form.register('email', { required: 'Email is required' });
  const submit = form.handleSubmit({ onValid });
  return createElement(
    'form',
    {
      onSubmit: async (event: { preventDefault: () => void }) => {
        event.preventDefault();
        await submit();
      },
    },
    createElement('input', {
      name: field.name,
      ref: field.ref,
      value: form.values.email,
      onChange: field.onChange,
      onBlur: field.onBlur,
    }),
  );
});

const ZodEmailForm = observer(({ form, onValid }: { form: Form<Values>; onValid: (values: Values) => void }) => {
  const submit = form.handleSubmit({ onValid });
  return createElement(
    'form',
    {
      onSubmit: async (event: { preventDefault: () => void }) => {
        event.preventDefault();
        await submit();
      },
    },
    createElement('input', {
      name: 'email',
      ref: form.ref('email'),
      value: form.values.email,
      onChange: (event: { target: { value: string } }) => {
        form.setValue('email', event.target.value, { shouldValidate: true });
      },
    }),
    form.errors.email?.message ? createElement('output', { role: 'alert' }, form.errors.email.message) : null,
  );
});

describe('React integration scenario', () => {
  it('binds a MobX-reactive input, stable form ref, handlers, and submit lifecycle', async () => {
    const form = new BaseForm<Values>({ defaultValues: { email: '' } });
    const onValid = vi.fn();
    const focus = vi.fn();
    const node = { focus } as unknown as HTMLElement;
    let renderer!: ReactTestRenderer;

    await act(async () => {
      renderer = create(createElement(EmailForm, { form, onValid }), {
        createNodeMock: () => node,
      });
    });
    const input = () => renderer.root.findByType('input');
    expect(form.ref('email').current).toBe(node);
    expect(input().props.value).toBe('');

    await act(async () => {
      await input().props.onChange({ target: { value: 'ada@example.test' } });
    });
    expect(form.values.email).toBe('ada@example.test');
    expect(form.dirtyFields.email).toBe(true);
    expect(form.touchedFields.email).toBe(true);
    expect(input().props.value).toBe('ada@example.test');

    await act(async () => {
      await input().props.onBlur();
      await renderer.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() });
    });
    expect(onValid).toHaveBeenCalledWith({ email: 'ada@example.test' }, form);
    expect(form.isSubmitSuccessful).toBe(true);

    await act(async () => {
      renderer.unmount();
    });
    expect(form.ref('email').current).toBeNull();
    expect(focus).not.toHaveBeenCalled();
  });

  it('renders Zod validation errors reactively and submits valid values', async () => {
    const form = new BaseForm<Values>({
      defaultValues: { email: '' },
      mode: 'onChange',
      schema: z.object({ email: z.string().email('Enter a valid email') }),
    });
    const onValid = vi.fn();
    const node = {} as HTMLElement;
    let renderer!: ReactTestRenderer;

    await act(async () => {
      renderer = create(createElement(ZodEmailForm, { form, onValid }), { createNodeMock: () => node });
    });
    const input = () => renderer.root.findByType('input');
    expect(form.ref('email').current).toBe(node);

    await act(async () => {
      input().props.onChange({ target: { value: 'not-an-email' } });
    });
    await vi.waitFor(() => expect(renderer.root.findByProps({ role: 'alert' }).children).toEqual(['Enter a valid email']));

    await act(async () => {
      input().props.onChange({ target: { value: 'ada@example.test' } });
    });
    await vi.waitFor(() => expect(renderer.root.findAllByProps({ role: 'alert' })).toEqual([]));

    await act(async () => {
      await renderer.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() });
    });
    expect(onValid).toHaveBeenCalledWith({ email: 'ada@example.test' }, form);
  });
});
