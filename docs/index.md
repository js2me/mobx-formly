---
layout: home

hero:
  name: mobx-formly
  text: Observable forms for MobX
  tagline: A framework-agnostic Form controller with granular field state and Zod or Valibot validation.
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
  - title: Schema adapters
    icon: ✅
    details: Use Zod, Valibot, or any compatible safe-parse schema. Async validation works out of the box.
---

## Why mobx-formly?

`mobx-formly` provides a small form controller for applications that already use MobX. It does not depend on React and does not require React hooks. Values, errors, touched state, and submission state are observable; aggregate state is exposed through computed properties.

Continue with the [getting started guide](/guide/getting-started), then see [validation](/guide/validation), [MobX reactivity](/guide/reactivity), and the [Form API](/api/form).
