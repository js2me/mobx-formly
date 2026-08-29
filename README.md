# mobx-formly

[![NPM version](https://img.shields.io/npm/v/mobx-formly.svg)](https://npmjs.org/package/mobx-formly)
[![Build status](https://github.com/js2me/mobx-formly/actions/workflows/main.yml/badge.svg)](https://github.com/js2me/mobx-formly/actions/workflows/main.yml)
[![Documentation](https://img.shields.io/badge/docs-online-blue)](https://js2me.github.io/mobx-formly/)

Observable, framework-agnostic forms for MobX 6. No React dependency and no hooks required. Includes first-class Zod schema validation.

## Documentation

[Read the documentation →](https://js2me.github.io/mobx-formly/)

## Installation

```bash
pnpm add mobx-formly mobx zod
```

`mobx` and `zod` are peer dependencies. Zod is optional when schemas are not used.

## Quick start

```ts
import { z } from 'zod'
import { Form } from 'mobx-formly'

const form = new Form({
  defaultValues: { email: '' },
  mode: 'onChange',
  schema: z.object({
    email: z.string().email('Enter a valid email'),
  }),
})

const email = form.register('email')
await email.onChange({ target: { value: 'ada@example.com' } })

form.values.email
form.errors.email
form.fieldState.email.error
form.fieldState.email.isDirty

await form.handleSubmit({
  onValid: async (values) => saveUser(values),
  onInvalid: (errors) => console.log(errors),
})()
```

## Features

- Explicit MobX `makeObservable` wiring.
- Stable, granular `fieldState[name]` branches.
- Zod `safeParseAsync` support, including async refinements.
- Valibot schema support through the same `FormSchema` interface.
- Field rules such as `required`, `minLength`, `pattern`, and `validate`.
- MobX-aware refs from [`yummies/mobx`](https://github.com/js2me/yummies).
- Framework agnostic: usable with React, Vue, Solid, or plain TypeScript.

## Development

```bash
pnpm install
pnpm check
pnpm build
pnpm test
pnpm docs:dev
```

## License

[MIT](https://github.com/js2me/mobx-formly/blob/main/LICENSE)
