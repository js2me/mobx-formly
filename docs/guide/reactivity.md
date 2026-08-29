# MobX reactivity

The form uses explicit `makeObservable` annotations. There is no React dependency and no hook lifecycle.

## Granular field state

Each registered field gets a stable observable branch:

```ts
form.fieldState.email.error
form.fieldState.email.isDirty
form.fieldState.email.isTouched
form.fieldState.email.isValidating
```

An observer that reads `fieldState.email.error` tracks that property, not a newly-created form-state snapshot. Updating `password` therefore does not invalidate the email error branch.

Aggregate values remain available as computed properties:

```ts
form.isDirty
form.isValid
```

## Plain values for side effects

`handleSubmit` passes a cloned plain object to `onValid`. This makes it safe to hand values to an API client without exposing the observable object directly.
