import { describe, expect, it } from 'vitest';
import { autorun } from 'mobx';
import { Form } from '../../../src/index.js';

describe('nested object replacement scenario', () => {
  it('observes the replacement and observes the new nested object afterwards', () => {
    const form = new Form<{ profile: { email: string; name: string } }>({
      defaultValues: { profile: { email: 'old@example.com', name: 'Ada' } },
    });
    const observed: string[] = [];
    const dispose = autorun(() => observed.push(form.values.profile.email));

    form.mutate(() => {
      form.values.profile = { email: 'new@example.com', name: 'Grace' };
    }, { shouldValidate: false });
    form.mutate(() => {
      form.values.profile.email = 'updated@example.com';
    }, { shouldValidate: false });

    expect(form.values.profile).toEqual({ email: 'updated@example.com', name: 'Grace' });
    expect(observed).toEqual(['old@example.com', 'new@example.com', 'updated@example.com']);
    dispose();
  });

  it('does not keep reacting to the replaced object', () => {
    const form = new Form<{ profile: { email: string } }>({
      defaultValues: { profile: { email: 'old@example.com' } },
    });
    const oldProfile = form.values.profile;
    const observed: string[] = [];
    const dispose = autorun(() => observed.push(form.values.profile.email));

    form.mutate(() => {
      form.values.profile = { email: 'new@example.com' };
    }, { shouldValidate: false });
    oldProfile.email = 'stale@example.com';

    expect(observed).toEqual(['old@example.com', 'new@example.com']);
    dispose();
  });
});
