# Form API

## Constructor options

The `createForm()` factory (backed by the `BaseForm` class) accepts default values, initial values, an optional schema or
resolver, validation modes, error aggregation settings, and a disabled flag. Mode
defaults to onSubmit, reValidateMode to onChange, criteriaMode to firstError, and
disabled to false. Initial values populate the current form; default values are used
by reset and dirty comparison.

Additional validation options are `context`, `delayError`, and
`shouldUseNativeValidation`. `shouldFocusError` defaults to `true` and focuses
the first registered errored field after an invalid submit.

## Form properties

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
| `isValidating` | Computed aggregate flag for pending field validation. |
| `isSubmitting` | Whether a submit handler is running. |
| `isSubmitted` | Whether submit has been attempted. |
| `isSubmitSuccessful` | Whether the latest submit succeeded. |
| `submitCount` | Number of submit attempts. |
| `disabled` | Whether registered event handlers ignore changes and blur events. |
| `snapshot` | A detached clone of the current values. |
| `refs` | Map of field paths to stable refs used to focus registered fields. |

Form state properties are observable or computed from observable state. Read them
directly in a MobX `observer`, `autorun`, or `reaction`; a consumer only tracks the
properties it reads. `refs` is a ref registry rather than form state. Examples
assume `form` is a form created with `createForm()`.

### `values`

The live MobX tree containing current field values. Read it to render inputs or
derive UI state. For an application-side update, prefer `setValue()` or `mutate()`
so dirty, touched, and validation state stays in sync.

```ts
const email = form.values.email;
form.setValue('email', 'ada@example.com');
```

Nested values can be read by normal property access and updated with a dot path:

```ts
const city = form.values.address.city;
form.setValue('address.city', 'London');
```

### `defaultValues`

The cached baseline for dirty comparison and for `reset()` / `resetField()`.
Construction clones the supplied defaults. Calling `reset(nextValues)` updates
the cached defaults with the supplied values unless `keepDefaultValues` is enabled.

```ts
const originalEmail = form.defaultValues.email;
form.reset({ email: 'ada@example.com' });
// The supplied email is now both the current value and the reset baseline.
```

### `errors`

Validation and application errors, nested using the same paths as fields. An
error contains a `type` and may contain a `message` and a `types` record. Errors
can come from registered rules, a schema, a resolver, or `setError()`.

```ts
const message = form.errors.email?.message;
const serverMessage = form.errors.root?.server?.message;
```

Use `clearErrors('email')` or `clearErrors()` to remove errors; assigning to
`errors` is not the supported way to manage them.

### `fieldState`

Per-field observable state addressed by the field path. Each field state exposes
`error`, `invalid`, `isDirty`, `isTouched`, and `isValidating`. Use this when a
component needs several state values for one field; the nested shape also works
for objects and array indexes.

```ts
const emailState = form.fieldState.email;
if (emailState?.invalid) showError(emailState.error?.message);

const firstItemInvalid = form.fieldState.items?.[0]?.invalid;
```

### `dirtyFields`

A path-keyed record whose entries are `true` when the current field value differs
from its default. Nested and array fields use dot paths such as `address.city`
and `items.0.name`. Returning a value to its default removes that path. Use
`isDirty` when the UI only needs the aggregate result.

```ts
if (form.dirtyFields['address.city']) showResetCityButton();
const changedPaths = Object.keys(form.dirtyFields);
```

### `touchedFields`

A path-keyed record of fields marked as visited. Registered `onBlur` marks a field
touched. Programmatic `setValue()` and `mutate()` mark changed fields touched by
default; pass `{ shouldTouch: false }` to opt out. This tracks interaction, not
whether the value differs from its default.

```ts
if (form.touchedFields.email && form.errors.email) {
  showError(form.errors.email.message);
}
form.setValue('email', 'imported@example.com', { shouldTouch: false });
```

### `validatingFields`

A path-keyed record containing fields whose asynchronous validation is pending.
Entries are removed when the applicable validation pass settles. A schema-level
validation may involve multiple fields; use `isValidating` for a form-wide
loading indicator.

```ts
if (form.validatingFields.email) showFieldSpinner('email');
```

### `isDirty`

Computed as `true` when at least one entry exists in `dirtyFields`. It becomes
`false` when all tracked values match their defaults or the dirty state is reset.

```ts
const saveEnabled = form.isDirty && !form.isSubmitting;
```

### `isTouched`

Computed as `true` when at least one entry exists in `touchedFields`. It is useful
for form-level UI that should appear only after the user has interacted with a
field.

```ts
if (form.isTouched) showFormHelpText();
```

### `isValid`

Indicates whether the form currently has no validation errors. If a schema or
resolver is configured, the first read schedules a full validation pass; observe
the property to receive its updated value when that pass completes. Without a
schema or resolver it reflects the current error collection, so it starts `true`
until errors are set or validation runs.

```ts
const canSubmit = form.isValid && !form.isSubmitting;
```

### `isValidating`

Computed as `true` while one or more fields are being validated. This is suitable
for a form-level spinner, while `validatingFields` can drive a spinner on a
specific input.

```ts
const showValidationProgress = form.isValidating;
```

### `isSubmitting`

`true` while one or more submit invocations are running, including validation and
the selected submit callback. It returns to `false` after all active submissions
finish.

```ts
const submitLabel = form.isSubmitting ? 'Saving…' : 'Save';
```

### `isSubmitted`

Becomes `true` as soon as a submit attempt starts, whether validation passes or
fails. `reset()` clears it unless `keepIsSubmitted` is set.

```ts
if (form.isSubmitted && !form.isValid) showSummary(form.errors);
```

### `isSubmitSuccessful`

Becomes `true` after validation passes and the `onValid` callback completes. A
validation failure sets it to `false`; if the callback rejects, the form does not
set the flag to `true` for that attempt (a previous value is not automatically
cleared). `reset()` clears this flag unless `keepIsSubmitSuccessful` is set.

```ts
if (form.isSubmitSuccessful) showToast('Changes saved');
```

### `submitCount`

The number of times the returned `handleSubmit()` function has been invoked. It
includes invalid attempts and resets to `0` with `reset()` unless
`keepSubmitCount` is set.

```ts
const showErrors = form.submitCount > 0;
```

### `disabled`

Reflects the `disabled` constructor option. When `true`, registered `onChange`
and `onBlur` handlers do nothing. It does not set the DOM element's `disabled`
attribute, so bind it to the UI separately when the input itself should be
disabled.

```ts
const inputProps = { ...form.register('email'), disabled: form.disabled };
```

### `snapshot`

Returns a detached clone of the current values at the time it is read. Use it to
pass values to code that should not receive the live MobX tree. Mutating the
snapshot does not update the form; read it again to get a fresh copy.

```ts
const payload = form.snapshot;
await saveDraft(payload);
```

### `refs`

A `Map` from field paths to stable MobX-aware element refs. `register(name)` uses
the same ref as `form.ref(name)`. Refs are removed by `unregister(name)` and are
used internally by `setFocus()` and validation's focus-on-error behavior.

```ts
const emailRef = form.refs.get('email');
emailRef?.current?.focus();
// Equivalent ref access without reading the map directly:
form.ref('email').current?.focus();
```

## Methods

| Method | Description |
| --- | --- |
| `register(name, options?)` | Returns `name`, `ref`, `onChange`, and `onBlur`. |
| `ref(name)` | Returns a stable MobX-aware ref for a field path, creating it on demand. |
| `unregister(name)` | Removes a field and its state. |
| `setValue(name, value, config?)` | Updates a value and optionally marks or validates it. |
| `mutate(mutator, config?)` | Groups several value changes into one form update, rebuilds dirty paths from the complete value tree, and can validate the complete form. |
| `setError(name, error, config?)` | Sets a field error. `config.shouldFocus` focuses the field ref. |
| `clearErrors(name?)` | Clears one, many, or all errors. |
| `trigger(name?, config?)` | Runs schema and rule validation. `config.shouldTouch` marks targeted fields touched; `config.shouldFocus` focuses the first targeted error. |
| `handleSubmit(handlers)` | Returns an async submit function. Validates before calling `onValid` or `onInvalid`. `onValid` receives schema or resolver output values, so schema transforms and coercions reach the submit handler. |
| `reset(values?, options?)` | Resets values and selected form state. Passed values become defaults unless `keepDefaultValues` is true. |
| `resetField(name, options?)` | Resets one field to its default and can preserve dirty, touched, or error state, or set a new field default. |
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

## `ref(name)`

Returns the same `createRef()` result as `register(name).ref` without registering
validation options or field state. It is useful for adapters that need to attach
a ref before registration. The cached ref is removed by `unregister(name)`.

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
field state. Its options are `keepDirty`, `keepTouched`, `keepError`, and
`defaultValue`. A supplied `defaultValue` becomes the field's new default.

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

`mutate` accepts either a synchronous callback or an async callback. The async
overload returns `Promise<void>` and reconciles dirty, touched, and validation
state after the callback settles. In projects using MobX `enforceActions`, any
value writes after `await` must still be wrapped in MobX `runInAction`.

## Root errors and Map paths

Use a root namespace for server or form-level errors that do not belong to a
field:

```ts
form.setError('root.server', { type: 'server', message: 'Try again' });
form.clearErrors('root');
```

`Map<string, V>` fields support dot paths through string keys, for example
`settings.primary.enabled`, in `register`, `setValue`, `resetField`, errors, and
field state. Maps with non-string keys and sets are atomic field values.
