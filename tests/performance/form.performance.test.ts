import { arch, cpus, platform, totalmem } from 'node:os';
import { autorun } from 'mobx';
import { describe, expect, it } from 'vitest';
import { Form } from '../../src/index.js';

/**
 * Two layers of portable performance regression tests.
 *
 * 1. Deterministic work counters: assert the exact amount of work performed
 * (reactions, resources, checksums). No elapsed time is involved, so these are
 * bit-identical on every machine.
 *
 * 2. Calibrated timing budgets: the runner measures its own speed with a trivial
 * pure-JS reference loop, and every scenario is charged in reference units
 * (scenario time divided by reference time per operation). A slow CI runner
 * slows the reference and the scenario together, so the ratio is stable across
 * machines. Every scenario warms up first for the JIT, is timed several times,
 * and the minimum is taken, which removes GC pauses and scheduler noise.
 *
 * Budgets are set at roughly 10x the observed reference-unit cost. They catch
 * structural regressions (accidental O(n^2), extra passes, lost batching) and
 * stay green across machine and runner variance. They are not a micro-benchmark
 * and do not measure small optimizations.
 */
const REFERENCE_OPS = 200_000;
const TIMED_RUNS = 5;
const WARMUP_RUNS = 2;

const formatMemory = (bytes: number): string => `${(bytes / 1024 ** 3).toFixed(1)} GB`;
const cpuInfo = cpus();

console.info(
  `[perf] environment: ${cpuInfo[0]?.model ?? 'unknown CPU'} | ${cpuInfo.length} logical cores | `
  + `${platform()} ${arch()} | RAM ${formatMemory(totalmem())} | `
  + `Node ${process.version} | V8 ${process.versions.v8} | `
  + `CI ${process.env.CI === 'true' ? 'yes' : 'no'}`,
);

const measureMin = (fn: () => void | Promise<void>, runs: number, warmups = WARMUP_RUNS): Promise<number> =>
  (async () => {
    for (let index = 0; index < warmups; index += 1) await fn();
    let min = Number.POSITIVE_INFINITY;
    for (let index = 0; index < runs; index += 1) {
      const start = performance.now();
      await fn();
      min = Math.min(min, performance.now() - start);
    }
    return min;
  })();

let referenceSink = 0;
const referencePerOp = measureMin(() => {
  let sum = 0;
  for (let index = 0; index < REFERENCE_OPS; index += 1) sum += (index * 7) & 0xffff;
  referenceSink = sum;
}, 7).then((ms) => {
  if (referenceSink === -1) throw new Error('unreachable');
  return ms / REFERENCE_OPS;
});

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

describe('portable timing budgets', () => {
  const fieldCount = 1000;
  const names = Array.from({ length: fieldCount }, (_, index) => `field${index}`);
  const values = createFields(fieldCount);

  const expectWithinBudget = async (
    label: string,
    operations: number,
    budget: number,
    fn: () => void | Promise<void>,
  ): Promise<void> => {
    const elapsed = await measureMin(fn, TIMED_RUNS);
    const reference = await referencePerOp;
    const unitsPerOperation = elapsed / operations / reference;
    const operationsPerSecond = operations / (elapsed / 1000);
    console.info(
      `[perf] ${label}: ${elapsed.toFixed(2)} ms | ${operationsPerSecond.toFixed(0)} ops/s | ${unitsPerOperation.toFixed(0)} calibrated units/op | budget ${budget}`,
    );
    expect(
      unitsPerOperation,
      `${label}: ${elapsed.toFixed(2)} ms = ${unitsPerOperation.toFixed(0)} calibrated units/op; budget ${budget}`,
    ).toBeLessThanOrEqual(budget);
  };

  it('keeps registration within a portable budget', async () => {
    await expectWithinBudget('register', fieldCount, 200_000, () => {
      const form = new Form<Record<string, string>>({ defaultValues: values });
      for (const name of names) form.register(name);
    });
  });

  it('keeps individual updates within a portable budget', async () => {
    const form = new Form<Record<string, string>>({ defaultValues: values });
    await expectWithinBudget('setValue', fieldCount, 60_000, () => {
      for (let index = 0; index < fieldCount; index += 1) {
        form.setValue(`field${index}`, `value${index}`, { shouldValidate: false });
      }
    });
  });

  it('keeps batched updates within a portable budget', async () => {
    const form = new Form<Record<string, string>>({ defaultValues: values });
    await expectWithinBudget('mutate', fieldCount, 20_000, () => {
      form.mutate(() => {
        for (let index = 0; index < fieldCount; index += 1) {
          form.setValue(`field${index}`, `value${index}`, { shouldDirty: false, shouldValidate: false });
        }
      }, { shouldValidate: false });
    });
  });

  it('keeps full validation within portable budgets', async () => {
    const form = new Form<Record<string, string>>({ defaultValues: values });
    for (const name of names) form.register(name, { required: 'Required', minLength: { value: 2, message: 'Too short' } });

    await expectWithinBudget('trigger invalid', fieldCount, 80_000, async () => {
      form.reset(values);
      await form.trigger();
    });
    await expectWithinBudget('trigger valid', fieldCount, 90_000, async () => {
      form.reset(values);
      for (const name of names) form.setValue(name, 'ok', { shouldDirty: false });
      await form.trigger();
    });
  });

  it('keeps one-field change validation within a portable budget', async () => {
    const form = new Form({ defaultValues: { name: '' }, mode: 'onChange' });
    const field = form.register('name', { required: 'Required' });
    await expectWithinBudget('single field onChange', 1, 250_000, async () => {
      await field.onChange({ target: { value: '' } });
    });
  });

  it('keeps proxy reads and snapshots within portable budgets', async () => {
    const form = new Form<Record<string, string>>({ defaultValues: values });
    for (const name of names) form.register(name);

    await expectWithinBudget('fieldState reads', fieldCount, 3_000, () => {
      const tree = form.fieldState as Record<string, { isDirty: boolean }>;
      let sum = 0;
      for (const name of names) sum += tree[name]?.isDirty ? 1 : 0;
      if (sum < 0) throw new Error('unreachable');
    });
    await expectWithinBudget('errors reads', fieldCount, 1_000, () => {
      const tree = form.errors as Record<string, unknown>;
      let sum = 0;
      for (const name of names) sum += tree[name] ? 1 : 0;
      if (sum < 0) throw new Error('unreachable');
    });
    await expectWithinBudget('snapshot', fieldCount, 12_000, () => {
      if (Object.keys(form.snapshot).length !== fieldCount) throw new Error('unreachable');
    });
  });

  it('keeps reset within a portable budget', async () => {
    const form = new Form<Record<string, string>>({ defaultValues: values });
    for (const name of names) form.register(name);
    await expectWithinBudget('reset', fieldCount, 45_000, () => form.reset(values));
  });
});
