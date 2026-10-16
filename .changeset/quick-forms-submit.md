---
"mobx-formly": minor
---

added `form.submit()` which resolves with validated values or throws `FormValidationError`
added `handleSubmit(event?)` overload (bound) that calls `preventDefault()` and submits with `onValid` / `onInvalid` from form options
