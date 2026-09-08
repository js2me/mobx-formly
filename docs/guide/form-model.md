# How Form works

`Form` is the part of `mobx-formly` that coordinates a form. It does not render
inputs and it does not know whether the UI is React, Vue, Solid, or plain DOM.
Your UI reads values from the form and sends input events back to it.

The usual lifecycle is:

1. Create one `Form` instance.
2. Register each input with a name.
3. Pass the returned handlers to the input component.
4. Read values and state from the form in MobX reactions or UI adapters.
5. Submit through `handleSubmit()`.

## Form properties

| Property | What it tells you |
| --- | --- |
| `values` | The current values. This is the live MobX data used by the form. |
| `defaultValues` | The baseline used to decide whether a value is dirty and what `reset()` restores. |
| `errors` | The current validation errors, addressed by field name. |
| `fieldState` | State for each field: `error`, `invalid`, `isDirty`, `isTouched`, and `isValidating`. |
| `dirtyFields` | Fields whose current value differs from its default value. |
| `touchedFields` | Fields the user has blurred or that you marked touched. |
| `validatingFields` | Fields with validation currently running. |
| `isDirty` | `true` when at least one field is dirty. |
| `isTouched` | `true` when at least one field has been touched. |
| `isValid` | `true` when the form currently has no errors. |
| `isSubmitting` | `true` while one or more submit handlers are running. |
| `isSubmitted` | `true` after the form has attempted submission. |
| `isSubmitSuccessful` | Whether the latest submission passed validation and completed successfully. |
| `submitCount` | How many times submission has been attempted. |
| `disabled` | Whether registered input handlers ignore changes and blur events. |
| `snapshot` | A plain copy of the current values, suitable for validation or side effects. |

## What happens when an input changes

`register('email')` connects a field name with the form. Its `onChange` handler:

- extracts the value from the event;
- applies `valueAsNumber`, `valueAsDate`, or `setValueAs` when configured;
- stores the result in `values.email`;
- updates dirty state;
- starts validation if the selected `mode` requires it.

Its `onBlur` handler marks the field as touched. Depending on `mode`, it may also
validate immediately. `reValidateMode` controls when a field that already has an
error is checked again.

## Reading a field

Use `fieldState` when the UI needs both the value and the field status:

```ts
const emailState = form.fieldState.email;

if (emailState?.invalid) {
  showError(emailState.error?.message);
}
```

Use `errors.email` when only the error matters. Use `isSubmitting`, `isValid`, or
the other aggregate properties for form-level UI such as submit buttons and
loading indicators.

All of these properties are observable, so a MobX reaction updates when the part
of the form it reads changes. Reading `fieldState.email` does not make a reaction
depend on the state of every other field.

## Values outside input events

Use `setValue(name, value, config)` when application code knows exactly which
field changed. The config can request dirty tracking, touched state, or immediate
validation.

Use `mutate()` when several values are changed directly. The form tracks the
changes made inside the callback and processes them together, so related updates
do not cause one validation pass per assignment.

## Validation and submission

Validation can start on change, blur, explicit `trigger()`, or submission. You can
combine field rules with a schema or provide a resolver. The public validation
options are described in the [validation guide](/guide/validation).

`handleSubmit({ onValid, onInvalid })` runs validation first. If validation passes,
`onValid` receives plain values. If a resolver returns transformed values, those
values are passed to `onValid`; otherwise the form snapshot is used. If validation
fails, `onInvalid` receives the current errors.

While this is happening, `isSubmitting`, `isSubmitted`, `isSubmitSuccessful`, and
`submitCount` are updated so the UI can render the submission lifecycle without
extra state.

## Resetting

`reset()` restores the default values and clears selected form state. Its `keep*`
options let you preserve dirty fields, touched fields, errors, validity, or submit
metadata when replacing values.

`resetField(name)` performs the same operation for one field: it restores that
field's default value and clears its error and interaction state.
