# Validation

## Zod schemas

Provide a schema through `schema`. Zod schemas support async refinements and asynchronous validation:

Validation issues are exposed by field path through the form errors and field state.
Async refinements are supported.

## Valibot schemas

Valibot schemas are accepted directly through the same `FormSchema` interface. No Valibot runtime is loaded unless the application uses it:

Valibot issues use the same error and field-state shape as Zod issues.

Nested paths use dot notation, for example `profile.email`.

## Validation modes

`mode` controls the first validation trigger:

- `onSubmit` — submit only (default)
- `onChange` — after changes
- `onBlur` — after blur
- `onTouched` — after the first blur, then after changes
- `all` — after changes and blur

`reValidateMode` controls how an already-invalid field is revalidated. It defaults to `onChange`.

## Rule validation

Registration supports common field rules alongside the schema:

Schema errors and registration rules are both evaluated. The field state contains the resulting error for that field.

Rules are checked in this order: `required`, length and numeric bounds, `pattern`, then `validate`. The first failing rule for a field is exposed. A rule validator receives both the field value and the current form snapshot and may return `true`, `false`, an error message, or a promise of one of those values.

Set `criteriaMode: 'all'` to retain every failing rule and schema issue in
`error.types`; the default `firstError` mode retains only the first error.

Validation can be supplied with a custom `resolver(values, context, options)`.
The resolver receives `context` and returns either `{ values, errors: {} }` or
`{ values: {}, errors }`. Resolver values are passed to `onValid` after submission.
Zod-like schemas, Valibot schemas, and Standard Schema objects are supported;
`resolver` takes precedence over `schema`.

`delayError` delays displaying validation errors in milliseconds. Clearing an error
is immediate. With `shouldUseNativeValidation`, registered DOM elements receive
`setCustomValidity` and `reportValidity` calls.

## Manual errors

Use `setError` for server-side or application errors and `clearErrors` to remove them:

Server-side or application errors can be added and cleared independently from schema
validation. Errors can be cleared for one field, several fields, or the whole form.

`trigger(name?)` validates one field, several fields, or the complete form and returns a boolean indicating whether the selected fields are valid. Validation results from older async runs are ignored when a newer run supersedes them.
