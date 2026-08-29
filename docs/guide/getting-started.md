# Getting started

## Installation

```bash
pnpm add mobx-formly mobx
```

`mobx` is a peer dependency. Install Zod only if you want schema validation:

```bash
pnpm add zod
```

Valibot is also supported as an optional alternative:

```bash
pnpm add valibot
```

## Create a form

```ts
import { z } from 'zod'
import { Form } from 'mobx-formly'

const form = new Form({
  defaultValues: {
    email: '',
    age: 0,
  },
  mode: 'onChange',
  schema: z.object({
    email: z.string().email('Enter a valid email'),
    age: z.number().int().min(18, 'Must be at least 18'),
  }),
})
```

`Form` infers the form value type from either a Zod or Valibot schema. This powers autocomplete and validation for field paths:

```ts
form.register('email')
form.setValue('email', 'ada@example.com')
// form.register('unknown') // TypeScript error
// form.setValue('email', 123) // TypeScript error
```

## Register fields

`register()` returns event handlers and a MobX-aware field ref:

```ts
const email = form.register('email')

await email.onChange({ target: { value: 'ada@example.com' } })
await email.onBlur()

console.log(form.values.email)
console.log(form.fieldState.email.error)
```

Values can also be updated directly:

```ts
form.setValue('email', 'ada@example.com', {
  shouldDirty: true,
  shouldValidate: true,
})
```

## Submit

Validation always runs before `onValid`, regardless of `mode`:

```ts
const submit = form.handleSubmit({
  onValid: async (values) => saveUser(values),
  onInvalid: (errors) => console.log(errors),
})

await submit()
```

## MobX consumers

Read observable properties from an `autorun`, MobX reaction, or a UI adapter:

```ts
autorun(() => {
  renderEmailError(form.fieldState.email?.error?.message)
})
```
