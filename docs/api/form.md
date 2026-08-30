# Form API

## Constructor options

The Form constructor accepts default values, initial values, an optional schema,
validation modes, and a disabled flag. Mode defaults to onSubmit, reValidateMode to
onChange, and disabled to false. Initial values populate the current form; default
values are used by reset and dirty comparison.

## Observable properties

| Property | Description |
| --- | --- |
| `values` | Current form values. Supports dot-path updates through `setValue`. |
| `errors` | Errors keyed by field path. |
| `fieldState` | Stable per-field state: `error`, `invalid`, `isDirty`, `isTouched`, `isValidating`. |
| `validatingFields` | Field paths currently being validated. |
| `dirtyFields` | Dirty field paths. |
| `touchedFields` | Touched field paths. |
| `isDirty` | Computed aggregate dirty flag. |
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
| `setError(name, error)` | Sets a field error. |
| `clearErrors(name?)` | Clears one, many, or all errors. |
| `trigger(name?)` | Runs schema and rule validation. |
| `handleSubmit(handlers)` | Returns an async submit function. Validates before calling `onValid` or `onInvalid`. |
| `reset(values?, options?)` | Resets values and selected form state. Passed values become defaults unless `keepDefaultValues` is true. |
| `resetField(name)` | Resets one field to its default. |
| `setFocus(name)` | Focuses the field ref when available. |

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

Reset options are `keepDefaultValues`, `keepDirty`, `keepTouched`, `keepErrors`,
`keepIsSubmitted`, and `keepSubmitCount`. `resetField(name)` resets one field to its
current default value and clears its field state.
