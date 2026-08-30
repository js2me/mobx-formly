# Form API

## Constructor

```ts
new Form({
  defaultValues?,
  values?,
  schema?,
  mode?,
  reValidateMode?,
  disabled?,
})
```

## Observable properties

| Property | Description |
| --- | --- |
| `values` | Current form values. Supports dot-path updates through `setValue`. |
| `errors` | Errors keyed by field path. |
| `fieldState` | Stable per-field state: `error`, `invalid`, `isDirty`, `isTouched`, `isValidating`. |
| `dirtyFields` | Dirty field paths. |
| `touchedFields` | Touched field paths. |
| `isDirty` | Computed aggregate dirty flag. |
| `isValid` | Computed aggregate validity flag. |
| `isSubmitting` | Whether a submit handler is running. |
| `isSubmitted` | Whether submit has been attempted. |
| `isSubmitSuccessful` | Whether the latest submit succeeded. |
| `submitCount` | Number of submit attempts. |

## Methods

| Method | Description |
| --- | --- |
| `register(name, options?)` | Returns `name`, `ref`, `onChange`, and `onBlur`. |
| `unregister(name)` | Removes a field and its state. |
| `setValue(name, value, config?)` | Updates a value and optionally marks or validates it. |
| `mutate(mutator, config?)` | Applies direct observable mutations as one form update; detects changed paths and marks/validates them. Observers are cached for 10 minutes after the last call. |
| `setError(name, error)` | Sets a field error. |
| `clearErrors(name?)` | Clears one, many, or all errors. |
| `trigger(name?)` | Runs schema and rule validation. |
| `handleSubmit(handlers)` | Returns an async submit function. |
| `reset(values?, options?)` | Resets the form. |
| `resetField(name)` | Resets one field to its default. |
| `setFocus(name)` | Focuses the field ref when available. |
