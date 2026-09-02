# mobx-formly

## 0.1.0

### Minor Changes

- 0025ea5: Add advanced validation support: `onTouched`, `criteriaMode: 'all'`, custom resolvers with context, delayed errors, native validity reporting, and Standard Schema validation.
  
  Also fixes field state updates for paths that were never registered (for example schema issues mapped to `root`): the first state creation mutated a disconnected object, so `fieldState` changes were dropped until a later update touched the same path.
- 8b152a2: Expose reactive `form.defaultValues` publicly
- 8b152a2: Add `keepValues`, `keepDirtyValues`, and `keepIsValid` reset options
- 8b152a2: Add `keepIsValidating` and `keepIsSubmitSuccessful` reset options; `keepIsSubmitted` no longer keeps `isSubmitSuccessful`
- 208d6e9: Add optional `shouldFocus` config to `setError`

## 0.0.3

### Patch Changes

- 4f3a56d: fix build

## 0.0.2

### Patch Changes

- c21f4f3: rework fieldState errors (no flatten paths)

## 0.0.1

### Patch Changes

- 7692026: Add optional schema validation support for Zod and Valibot.
