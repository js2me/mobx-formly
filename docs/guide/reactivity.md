# MobX reactivity

The form is designed for MobX applications and does not depend on React or a hook
lifecycle.

## Granular field state

Each registered field exposes stable observable state for its error, dirty, touched, and
validating status.

The form also exposes computed dirty and valid flags, together with its disabled state.

## Plain values for side effects

The submit callback receives a plain snapshot of the current values, separate from the
observable form data.

## Updating nested values

Nested values can be addressed with dot-separated paths. Updates can independently
control dirty tracking, touched state, and validation.

When changing several values directly, use `mutate()` to group the changes and validate
the changed paths together.
