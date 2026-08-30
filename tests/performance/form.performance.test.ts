import { autorun } from 'mobx';
import { describe, expect, it } from 'vitest';
import { Form } from '../../src/index.js';

/**
 * These are regression tests for the amount of work performed by the form.
 * They intentionally do not assert elapsed time: wall-clock timings are not
 * portable between developer machines and GitHub-hosted runners.
 */
const runDeterministicCase = (fieldCount: number) => {
  const form = new Form<Record<string, number>>({
    defaultValues: Object.fromEntries(Array.from({ length: fieldCount }, (_, index) => [`field${index}`, 0])),
  });

  for (let index = 0; index < fieldCount; index += 1) form.register(`field${index}`);

  let reactions = 0;
  const dispose = autorun(() => {
    JSON.stringify(form.values);
    reactions += 1;
  });

  form.mutate(() => {
    for (let index = 0; index < fieldCount; index += 1) {
      form.setValue(`field${index}`, index + 1);
    }
  }, { shouldValidate: false });

  const checksum = Object.values(form.values).reduce((sum, value) => sum + value, 0);
  const result = {
    fields: form.refs.size,
    dirtyFields: Object.keys(form.dirtyFields).length,
    checksum,
    reactions,
  };

  dispose();
  form.reset();
  return result;
};

const createFields = (count: number, value = ''): Record<string, string> => Object.fromEntries(
  Array.from({ length: count }, (_, index) => [`field${index}`, value]),
);

const sumStringLengths = (values: Record<string, string>): number => Object.values(values)
  .reduce((sum, value) => sum + value.length, 0);

describe('deterministic performance regressions', () => {
  it.each([
    [32, { fields: 32, dirtyFields: 32, checksum: 528, reactions: 2 }],
    [128, { fields: 128, dirtyFields: 128, checksum: 8256, reactions: 2 }],
    [512, { fields: 512, dirtyFields: 512, checksum: 131328, reactions: 2 }],
  ])('keeps batched updates bounded and deterministic for %i fields', (fieldCount, expected) => {
    expect(runDeterministicCase(fieldCount)).toEqual(expected);
  });

  it('registers a large form without creating duplicate field resources', () => {
    const fieldCount = 2048;
    const form = new Form<Record<string, string>>({ defaultValues: createFields(fieldCount) });

    for (let index = 0; index < fieldCount; index += 1) form.register(`field${index}`);
    for (let index = 0; index < fieldCount; index += 1) form.register(`field${index}`);

    expect({ refs: form.refs.size, states: Object.keys(form.fieldState).length })
      .toEqual({ refs: fieldCount, states: fieldCount });
  });

  it('keeps an isolated update isolated from unrelated field observers', () => {
    const form = new Form<Record<string, string>>({ defaultValues: createFields(512) });
    for (let index = 0; index < 512; index += 1) form.register(`field${index}`);

    let firstFieldReactions = 0;
    let lastFieldReactions = 0;
    const disposeFirst = autorun(() => { form.fieldState.field0?.isDirty; firstFieldReactions += 1; });
    const disposeLast = autorun(() => { form.fieldState.field511?.isDirty; lastFieldReactions += 1; });

    form.setValue('field0', 'changed');

    expect({ firstFieldReactions, lastFieldReactions, dirty: Object.keys(form.dirtyFields) })
      .toEqual({ firstFieldReactions: 2, lastFieldReactions: 1, dirty: ['field0'] });
    disposeFirst();
    disposeLast();
  });

  it('batches nested object and array changes into one reaction', () => {
    type Values = { profile: { name: string; tags: string[] } };
    const form = new Form<Values>({ defaultValues: { profile: { name: '', tags: [] } } });
    form.register('profile.name');
    form.register('profile.tags');
    let reactions = 0;
    const dispose = autorun(() => { JSON.stringify(form.values); reactions += 1; });

    form.mutate(() => {
      form.values.profile.name = 'Ada';
      form.values.profile.tags.push('typescript', 'mobx');
    }, { shouldValidate: false });

    expect({ reactions, values: form.snapshot, dirty: Object.keys(form.dirtyFields) })
      .toEqual({
        reactions: 2,
        values: { profile: { name: 'Ada', tags: ['typescript', 'mobx'] } },
        dirty: ['profile.name', 'profile.tags'],
      });
    dispose();
  });

  it('validates a large fixed workload with stable results', async () => {
    const fieldCount = 512;
    const form = new Form<Record<string, string>>({ values: createFields(fieldCount) });
    for (let index = 0; index < fieldCount; index += 1) {
      form.register(`field${index}`, { required: 'Required', minLength: { value: 3, message: 'Too short' } });
    }
    for (let index = 0; index < fieldCount; index += 2) form.setValue(`field${index}`, `value-${index}`);

    expect(await form.trigger()).toBe(false);
    expect({ errors: Object.keys(form.errors).length, valid: form.isValid })
      .toEqual({ errors: fieldCount / 2, valid: false });
  });

  it('settles a fixed async validation workload deterministically', async () => {
    const fieldCount = 64;
    let validations = 0;
    const form = new Form<Record<string, string>>({ values: createFields(fieldCount, 'ok') });
    for (let index = 0; index < fieldCount; index += 1) {
      form.register(`field${index}`, {
        validate: async (value) => {
          validations += 1;
          return value === 'ok' || 'Invalid';
        },
      });
    }

    form.setValue('field7', 'bad');
    form.setValue('field31', 'bad');
    expect(await form.trigger()).toBe(false);
    expect({ validations, errors: Object.keys(form.errors), validating: Object.keys(form.validatingFields) })
      .toEqual({ validations: fieldCount, errors: ['field7', 'field31'], validating: [] });
  });

  it('resets a large mutated form to a stable baseline', () => {
    const fieldCount = 512;
    const form = new Form<Record<string, string>>({ defaultValues: createFields(fieldCount, 'default') });
    for (let index = 0; index < fieldCount; index += 1) form.register(`field${index}`);
    form.mutate(() => {
      for (let index = 0; index < fieldCount; index += 1) form.setValue(`field${index}`, `next-${index}`);
    }, { shouldValidate: false });

    form.reset();

    expect({ dirty: Object.keys(form.dirtyFields).length, touched: Object.keys(form.touchedFields).length, length: sumStringLengths(form.values) })
      .toEqual({ dirty: 0, touched: 0, length: fieldCount * 'default'.length });
  });

  it('handles dynamic array lifecycle without retaining unregistered fields', () => {
    type Values = { rows: Array<{ name: string }> };
    const form = new Form<Values>({ defaultValues: { rows: [] } });

    for (let index = 0; index < 128; index += 1) {
      form.mutate(() => form.values.rows.push({ name: `row-${index}` }), { shouldValidate: false });
      form.register(`rows.${index}.name`);
    }
    for (let index = 0; index < 128; index += 1) form.unregister(`rows.${index}.name`);

    expect({ rows: form.values.rows.length, refs: form.refs.size, states: Object.keys(form.fieldState).length })
      .toEqual({ rows: 128, refs: 0, states: 1 });
  });

  it('cleans all tracked resources after repeated register/unregister cycles', () => {
    const form = new Form<Record<string, string>>({ defaultValues: createFields(64) });

    for (let cycle = 0; cycle < 8; cycle += 1) {
      for (let index = 0; index < 64; index += 1) form.register(`field${index}`);
      for (let index = 0; index < 64; index += 1) form.unregister(`field${index}`);
    }

    expect({ refs: form.refs.size, fields: Object.keys(form.fieldState).length, errors: Object.keys(form.errors).length })
      .toEqual({ refs: 0, fields: 0, errors: 0 });
  });
});
