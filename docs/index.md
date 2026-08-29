---
layout: home

hero:
  name: mobx-formly
  text: Observable forms for MobX
  tagline: A framework-agnostic Form controller with granular field state and built-in Zod validation.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /api/form

features:
  - title: MobX 6 native
    icon: <span class="i-logos:mobx"></span>
    details: Explicit observable, computed, and action annotations. No hooks required.
  - title: Granular updates
    icon: <span class="i-logos:typescript-icon"></span>
    details: Read fieldState.email.error without subscribing to unrelated fields.
  - title: Zod included
    icon: ✅
    details: Pass a Zod schema once and validate synchronously or asynchronously on submit.
---

## Why mobx-formly?

`mobx-formly` provides a small form controller for applications that already use MobX. It does not depend on React and does not require React hooks.

```ts
const form = new Form({
  defaultValues: { email: '' },
  schema: z.object({ email: z.string().email() }),
})

form.values.email
form.errors.email
form.fieldState.email.error
```
