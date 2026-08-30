import { describe, expect, it } from 'vitest';
import { Form } from '../../../src/index.js';

describe('direct mutation contract scenario', () => {
  it('updates the value tree without claiming dirty metadata', () => {
    const form = new Form({ defaultValues: { profile: { name: 'Ada' } } });

    form.values.profile.name = 'Grace';

    expect(form.values.profile.name).toBe('Grace');
    expect(form.isDirty).toBe(false);
    expect(form.dirtyFields['profile.name']).toBeUndefined();
  });

  it('isolates snapshots from later direct mutations', () => {
    const form = new Form({ values: { tags: ['one'] } });
    const snapshot = form.snapshot;
    form.values.tags.push('two');
    expect(snapshot.tags).toEqual(['one']);
  });
});
