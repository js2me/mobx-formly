# Validation

## Zod schemas

Provide a schema through `schema`. The form calls `safeParseAsync`, so async refinements are supported:

```ts
const form = new Form({
  defaultValues: { username: '' },
  schema: z.object({
    username: z.string().min(3).refine(isUsernameAvailable),
  }),
})
```

Zod issues are exposed by path:

```ts
form.errors.username
// { type: '...', message: '...' }

form.fieldState.username.error
```

Nested paths use dot notation, for example `profile.email`.

## Validation modes

`mode` controls the first validation trigger:

- `onSubmit` — submit only (default)
- `onChange` — after changes
- `onBlur` — after blur
- `all` — after changes and blur

`reValidateMode` controls how an already-invalid field is revalidated. It defaults to `onChange`.

```ts
const form = new Form({
  mode: 'onBlur',
  reValidateMode: 'onChange',
  schema,
})
```

## Rule validation

Registration supports common field rules alongside the schema:

```ts
form.register('email', {
  required: 'Email is required',
  pattern: { value: /@/, message: 'Invalid email' },
  validate: (value) => value !== 'blocked@example.com' || 'Email is blocked',
})
```

Schema errors and registration rules are both evaluated. The field state contains the resulting error for that field.
