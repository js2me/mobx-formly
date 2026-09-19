import { describe, expect, it, vi } from 'vitest';
import { BaseForm } from '../../../src/index.js';

describe('checkout flow', () => {
  it('focuses the first invalid field, revalidates dependent confirmation, and submits', async () => {
    const focusCard = vi.fn();
    const form = new BaseForm({
      defaultValues: { card: '', confirmCard: '', acceptedTerms: false },
    });
    const card = form.register('card', { deps: 'confirmCard', required: 'Card is required' });
    card.ref.current = { focus: focusCard } as unknown as HTMLElement;
    const confirm = form.register('confirmCard', {
      validate: (value, values) => value === values.card || 'Card numbers do not match',
    });
    form.register('acceptedTerms', { validate: (value) => value === true || 'Accept the terms' });

    expect(await form.handleSubmit({ onValid: vi.fn() })()).toBeUndefined();
    expect(focusCard).toHaveBeenCalledOnce();
    expect(form.errors.card?.message).toBe('Card is required');

    await card.onChange({ target: { value: '4111111111111111' } });
    expect(form.errors.confirmCard?.message).toBe('Card numbers do not match');
    await confirm.onChange({ target: { value: '4111111111111111' } });
    form.setValue('acceptedTerms', true);

    const onValid = vi.fn();
    await form.handleSubmit({ onValid })();
    expect(onValid).toHaveBeenCalledWith({ card: '4111111111111111', confirmCard: '4111111111111111', acceptedTerms: true }, form);
    expect(form.isSubmitSuccessful).toBe(true);
    expect(form.submitCount).toBe(2);
  });
});
