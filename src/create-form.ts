import { BaseForm } from './form.js';
import type { Form } from './form.js';
import type { FieldValues, FormOptions, FormSchema, SchemaOutput } from './types.js';

export type InferredFormValues<S> = Extract<SchemaOutput<S>, FieldValues>;

/**
 * Creates a form with values inferred from its schema.
 *
 * [**Documentation**](https://js2me.github.io/mobx-formly/guide/getting-started.html)
 */
export function createForm<S extends FormSchema<any>>(
  options: FormOptions<InferredFormValues<S>> & { schema: S },
): Form<InferredFormValues<S>>;
/**
 * Creates a form with an explicit values type.
 *
 * [**Documentation**](https://js2me.github.io/mobx-formly/guide/getting-started.html)
 */
export function createForm<T extends FieldValues = FieldValues>(options?: FormOptions<T>): Form<T>;
// Implementation signature is intentionally loose: callers only see the typed overloads above.
export function createForm(...args: any[]): any {
  return new BaseForm(args[0] ?? {});
}
