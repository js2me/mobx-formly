import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('server edit flow', () => {
  it('keeps user field state through a server normalization error and clears the root namespace', () => {
    const form = new Form({ defaultValues: { title: 'Initial title', slug: 'initial-title' } });
    form.register('title');
    form.register('slug');

    form.setValue('title', 'New title');
    form.setError('root.conflict', { type: 'conflict', message: 'Another editor saved first' });
    form.setError('slug', { type: 'server', message: 'Slug is unavailable' });

    // The server canonicalizes the title but the UI keeps the user's state and the field error.
    form.resetField('title', {
      defaultValue: 'New title',
      keepDirty: true,
      keepTouched: true,
    });
    form.resetField('slug', { keepError: true });

    expect(form.values.title).toBe('New title');
    expect(form.fieldState.title).toMatchObject({ isDirty: true, isTouched: true });
    expect(form.fieldState.slug?.error?.message).toBe('Slug is unavailable');
    expect(form.errors.root?.conflict?.message).toBe('Another editor saved first');

    form.clearErrors(['root.conflict', 'slug']);
    expect(form.errors.root).toBeUndefined();
    expect(form.errors.slug).toBeUndefined();
  });
});
