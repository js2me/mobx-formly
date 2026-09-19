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
| `isValid` | Computed aggregate validity flag. With a schema or resolver the first read schedules a full validation pass, so the flag reflects the schema instead of defaulting to true until something validates. |
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
| `mutate(mutator, config?)` | Groups several value changes into one form update, rebuilds dirty paths from the complete value tree, and can validate the complete form. |
| `setError(name, error, config?)` | Sets a field error. `config.shouldFocus` focuses the field ref. |
| `clearErrors(name?)` | Clears one, many, or all errors. |
| `trigger(name?)` | Runs schema and rule validation. |
| `handleSubmit(handlers)` | Returns an async submit function. Validates before calling `onValid` or `onInvalid`. `onValid` receives schema or resolver output values, so schema transforms and coercions reach the submit handler. |
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
| `validate` | Sync or async custom validator receiving `(value, values)`, or a record of named validators whose keys become error types. A validator may return an array of messages. |
| `deps` | One or several field paths re-validated whenever this field changes. |
| `valueAsNumber`, `valueAsDate` | Convert event values before storing them. |
| `setValueAs` | Custom value transformation. |

## `setValue(name, value, config?)`

`config` supports `shouldDirty`, `shouldTouch`, and `shouldValidate`. Dirty tracking and
touching are enabled by default for `setValue`; validation is opt-in. Pass
`{ shouldTouch: false }` for a technical update that must leave touched state unchanged.

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

## Array fields

Use normal MobX mutations inside `mutate`:

```ts
form.mutate(() => {
  form.values.items.splice(1, 1);
  form.values.items.push({ name: 'New item' });
});
```

`mutate` compares the complete current value tree with `defaultValues` after the
callback and rebuilds `dirtyFields`. Plain objects and arrays are compared
recursively; `Map` values with string keys are also compared recursively; `Set`,
`Date`, and `RegExp` are atomic values. By default it then validates the complete
form, so errors reflect current array indexes instead of being remapped by item
identity. Pass `{ shouldValidate: false }` to defer that validation.

`touchedFields` remains path-based across programmatic mutations. `Date` and
`RegExp` must be replaced rather than mutated internally because MobX does not
observe their internal state. Functions and symbols are not supported as form
values because they cannot be cloned reliably.

`mutate` marks only paths that changed between the snapshots before and after its
callback as touched by default. Pass `{ shouldTouch: false }` to opt out. This is
a programmatic touch policy, not a substitute for the user-interaction touch
state set by registered `onBlur` handlers.
