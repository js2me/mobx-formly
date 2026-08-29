# mobx-formly

An observable, framework-agnostic form controller for MobX 6. Its API follows the non-hook parts of React Hook Form and includes first-class Zod validation.

```ts
import { autorun } from 'mobx';
import { z } from 'zod';
import { Form } from 'mobx-formly';

const form = new Form({
  defaultValues: { email: '' },
  mode: 'onChange',
  schema: z.object({ email: z.string().email() }),
});

const email = form.register('email');
email.onChange({ target: { value: 'ada@example.test' } });

autorun(() => console.log(form.formState.errors));
await form.handleSubmit({ onValid: (values) => save(values) })();
```

`register()` returns `name`, `onChange`, `onBlur`, and a MobX-aware `ref` created by `yummies/mobx`. The form exposes observable `values` and granular field state such as `fieldState.email.error`, `fieldState.email.isDirty`, and `fieldState.email.isTouched`. Aggregate status is available through `isDirty` and `isValid`.

## API

- `register(name, rules)` / `unregister(name)`
- Observable state: `values`, `errors`, `dirtyFields`, `touchedFields`, `fieldState[name]`
- `trigger(name?)`, `setError(name, error)`, `clearErrors(name?)`
- `handleSubmit({ onValid, onInvalid })`
- `reset(values?, options)`, `resetField(name)`, `setFocus(name)`
- `subscribe(listener)` for non-MobX consumers
