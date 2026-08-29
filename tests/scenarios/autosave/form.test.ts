import { describe, expect, it, vi } from 'vitest';
import { Form } from '../../../src/index.js';

describe('autosave scenario', () => {
  it('saves the latest subscribed value and ignores an older save result', async () => {
    const saves: Array<{ value: string; resolve: () => void }> = [];
    const form = new Form({ values: { title: '' } });
    const save = vi.fn((values: { title: string }) => new Promise<void>((resolve) => saves.push({ value: values.title, resolve })));
    const unsubscribe = form.subscribe((values) => { void save(values); });

    form.setValue('title', 'first');
    form.setValue('title', 'second');
    expect(save).toHaveBeenCalledTimes(2);
    expect(saves.map((item) => item.value)).toEqual(['first', 'second']);
    saves[1].resolve();
    saves[0].resolve();
    await Promise.all(saves.map((item) => item.resolve()));
    expect(form.values.title).toBe('second');
    unsubscribe();
  });
});
