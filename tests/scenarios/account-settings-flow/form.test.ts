import { describe, expect, it, vi } from 'vitest';
import { Form } from '../../../src/index.js';

type AccountValues = {
  profile: { displayName: string; timezone: string };
  notifications: Map<'email' | 'push', { enabled: boolean }>;
};

describe('account settings flow', () => {
  it('hydrates asynchronously, edits a Map-backed setting, and saves a new baseline', async () => {
    const form = new Form<AccountValues>({
      defaultValues: {
        profile: { displayName: '', timezone: 'UTC' },
        notifications: new Map([
          ['email', { enabled: true }],
          ['push', { enabled: true }],
        ]),
      },
    });
    const earlyRef = form.ref('profile.displayName');
    expect(form.register('profile.displayName', { required: 'Display name is required' }).ref).toBe(earlyRef);
    form.register('notifications.email.enabled');

    await form.mutate(async () => {
      await Promise.resolve();
      form.values.profile.displayName = 'Ada';
      form.values.profile.timezone = 'Europe/London';
    }, { shouldDirty: false, shouldTouch: false, shouldValidate: false });
    expect(form.snapshot.profile).toEqual({ displayName: 'Ada', timezone: 'Europe/London' });
    expect(form.dirtyFields).toEqual({});
    expect(form.touchedFields).toEqual({});

    // The fetched account becomes the save baseline before the user edits it.
    form.reset(form.snapshot);
    form.setValue('notifications.email.enabled', false);
    expect(form.dirtyFields['notifications.email.enabled']).toBe(true);
    expect(form.touchedFields['notifications.email.enabled']).toBe(true);

    const onValid = vi.fn(async (values: AccountValues) => {
      form.reset(values);
    });
    await form.handleSubmit({ onValid })();

    expect(onValid).toHaveBeenCalledOnce();
    expect(form.isDirty).toBe(false);
    expect(form.values.notifications.get('email')?.enabled).toBe(false);
  });
});
