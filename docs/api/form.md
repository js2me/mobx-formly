# Form API

## Constructor options

The Form constructor accepts default values, initial values, an optional schema or
resolver, validation modes, error aggregation settings, and a disabled flag. Mode
defaults to onSubmit, reValidateMode to onChange, criteriaMode to firstError, and
disabled to false. Initial values populate the current form; default values are used
by reset and dirty comparison.

Additional validation options are `context`, `delayError`, and
`shouldUseNativeValidation`.

## Observable properties

| Property | Description |
| --- | --- |
| `values` | Current form values. Supports dot-path updates through `setValue`. |
| `defaultValues` | Cached default values used by `reset`, `resetField`, and dirty comparison. Updated by `reset` unless `keepDefaultValues` is set. |
| `errors` | Validation errors nested by field path. |
| `fieldState` | Stable per-field state nested by field path: `error`, `invalid`, `isDirty`, `isTouched`, `isValidating`. |
| `validatingFields` | Field paths currently being validated. |
| `dirtyFields` | Dirty field paths. |
| `touchedFields` | Touched field paths. |
| `isDirty` | Computed aggregate dirty flag. |
| `isTouched` | Computed aggregate touched flag. |
| `isValid` | Computed aggregate validity flag. |
| `isSubmitting` | Whether a submit handler is running. |
| `isSubmitted` | Whether submit has been attempted. |
| `isSubmitSuccessful` | Whether the latest submit succeeded. |
| `submitCount` | Number of submit attempts. |
| `disabled` | Whether registered event handlers ignore changes and blur events. |
| `snapshot` | A cloned plain copy of the current values. |

## Methods

| Method | Description |
| --- | --- |
| `register(name, options?)` | Returns `name`, `ref`, `onChange`, and `onBlur`. |
| `unregister(name)` | Removes a field and its state. |
| `setValue(name, value, config?)` | Updates a value and optionally marks or validates it. |
| `mutate(mutator, config?)` | Groups several value changes into one form update and can mark or validate the changed paths. |
| `setError(name, error, config?)` | Sets a field error. `config.shouldFocus` focuses the field ref. |
| `clearErrors(name?)` | Clears one, many, or all errors. |
| `trigger(name?)` | Runs schema and rule validation. |
| `handleSubmit(handlers)` | Returns an async submit function. Validates before calling `onValid` or `onInvalid`. |
| `reset(values?, options?)` | Resets values and selected form state. Passed values become defaults unless `keepDefaultValues` is true. |
| `resetField(name)` | Resets one field to its default. |
| `setFocus(name)` | Focuses the field ref when available. |

## Resolver and schemas

`resolver(values, context, options)` may return transformed submit values and nested
errors. Its `options` contain `criteriaMode`, registered `fields`, selected `names`,
and `shouldUseNativeValidation`. A resolver takes precedence over `schema`.

Schemas may implement Zod's `safeParseAsync`, Valibot's `~run`, or Standard
Schema's `~standard.validate` contract.

## `register(name, options?)`

Returns `{ name, ref, onChange, onBlur }`. Event handlers accept DOM-like events or
plain values and return promises because validation may be asynchronous.

Supported registration options:

| Option | Description |
| --- | --- |
| `required` | `boolean` or error message. |
| `minLength`, `maxLength` | Length limit with optional message. |
| `min`, `max` | Numeric limit with optional message. |
| `pattern` | Regular expression with optional message. |
| `validate` | Sync or async custom validator receiving `(value, values)`. |
| `valueAsNumber`, `valueAsDate` | Convert event values before storing them. |
| `setValueAs` | Custom value transformation. |

## `setValue(name, value, config?)`

`config` supports `shouldDirty`, `shouldTouch`, and `shouldValidate`. Dirty tracking is
enabled by default for `setValue`; touching and validation are opt-in.

## `reset(values?, options?)`

Reset options are `keepDefaultValues`, `keepValues`, `keepDirty`, `keepDirtyValues`,
`keepTouched`, `keepErrors`, `keepIsValid`, `keepIsValidating`, `keepIsSubmitted`,
`keepIsSubmitSuccessful`, and `keepSubmitCount`. `keepValues` leaves the current values
in place, `keepDirtyValues` keeps dirty values and their dirty flags while only clean
fields take the new values, `keepIsValid` persists the current `isValid` until the next
error or validation update, and `keepIsValidating` keeps the `validatingFields` and
`fieldState.isValidating` flags until the next validation update. In-flight validation
is still discarded by reset.
`resetField(name)` resets one field to its current default value and clears its
field state.
