import { describe, expect, it, vi } from 'vitest';
import { BaseForm } from '../../../src/index.js';

describe('mutation value types scenario', () => {
  it('marks every supported top-level value shape dirty through mutate', () => {
    const form = new BaseForm({
      defaultValues: {
        text: 'before',
        count: 1,
        enabled: false,
        nullable: null as string | null,
        optional: undefined as string | undefined,
        bigint: 1n,
        date: new Date('2020-01-01T00:00:00.000Z'),
        expression: /before/i,
        object: { city: 'London' },
        items: ['one'],
        settings: new Map([['theme', 'light']]),
        tags: new Set(['one']),
      },
    });

    form.mutate(() => {
      form.values.text = 'after';
      form.values.count = 2;
      form.values.enabled = true;
      form.values.nullable = 'value';
      form.values.optional = 'value';
      form.values.bigint = 2n;
      form.values.date = new Date('2021-01-01T00:00:00.000Z');
      form.values.expression = /after/g;
      form.values.object.city = 'Paris';
      form.values.items.push('two');
      form.values.settings.set('theme', 'dark');
      form.values.tags.add('two');
    }, { shouldTouch: true, shouldValidate: false });

    expect(form.dirtyFields).toMatchObject({
      text: true,
      count: true,
      enabled: true,
      nullable: true,
      optional: true,
      bigint: true,
      date: true,
      expression: true,
      'object.city': true,
      'items.1': true,
      'settings.theme': true,
      tags: true,
    });
    expect(form.touchedFields['object.city']).toBe(true);
    expect(form.touchedFields['items.1']).toBe(true);
    expect(form.touchedFields['settings.theme']).toBe(true);
    expect(form.touchedFields.tags).toBe(true);
  });

  it('tracks direct nested ObservableMap values through their dot path', () => {
    const form = new BaseForm({
      defaultValues: { settings: new Map([['primary', { enabled: true }]]) },
    });

    form.mutate(() => {
      form.values.settings.get('primary')!.enabled = false;
    }, { shouldValidate: false });

    expect(form.dirtyFields['settings.primary.enabled']).toBe(true);
  });

  it('tracks deeply nested objects, Maps, and Sets through their complete paths', () => {
    const form = new BaseForm({
      defaultValues: {
        account: {
          profile: {
            settings: new Map([['regions', new Map([['primary', { enabled: true, tags: new Set(['one']) }]])]]),
          },
        },
      },
    });

    form.mutate(() => {
      const primary = form.values.account.profile.settings.get('regions')!.get('primary')!;
      primary.enabled = false;
      primary.tags.add('two');
    }, { shouldTouch: true, shouldValidate: false });

    expect(form.dirtyFields['account.profile.settings.regions.primary.enabled']).toBe(true);
    expect(form.dirtyFields['account.profile.settings.regions.primary.tags']).toBe(true);
    expect(form.touchedFields['account.profile.settings.regions.primary.enabled']).toBe(true);
    expect(form.touchedFields['account.profile.settings.regions.primary.tags']).toBe(true);
  });

  it('rebuilds error paths for an array nested inside a Map through full validation', async () => {
    const form = new BaseForm({
      defaultValues: {
        settings: new Map([['group', { items: [{ name: 'One' }, { name: 'Two' }] }]]),
      },
      schema: {
        safeParseAsync: async (values: unknown) => {
          const items = (values as { settings: Map<string, { items: Array<{ name: string }> }> }).settings.get('group')!.items;
          const index = items.findIndex(({ name }) => name === 'Two');
          return index < 0
            ? { success: true as const, data: values }
            : { success: false as const, error: { issues: [{ path: ['settings', 'group', 'items', index, 'name'], message: 'Second item' }] } };
        },
      } as never,
    });

    form.mutate(() => {
      form.values.settings.get('group')!.items.splice(0, 1);
    });

    const errors = form.errors as unknown as {
      settings?: { group?: { items?: Array<{ name?: { message?: string } }> } };
    };
    await vi.waitFor(() => expect(errors.settings?.group?.items?.[0]?.name?.message).toBe('Second item'));
    expect(errors.settings?.group?.items?.[1]).toBeUndefined();
  });

  it('does not mark unchanged Map and Set values dirty', () => {
    const form = new BaseForm({
      defaultValues: {
        settings: new Map([['theme', 'light']]),
        tags: new Set(['one']),
      },
    });

    form.mutate(() => {
      form.values.settings.set('theme', 'light');
      form.values.tags.add('one');
    }, { shouldValidate: false });

    expect(form.dirtyFields).toEqual({});
  });
});
