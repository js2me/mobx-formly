import { Form } from './form.js';
import type { FieldValues, FormOptions, FormSchema, SchemaOutput } from './types.js';

export type InferredFormValues<S> = Extract<SchemaOutput<S>, FieldValues>;

/**
 * Creates a form with values inferred from its schema.
 *
 * [**Documentation**](https://js2me.github.io/mobx-formly/guide/getting-started.html)
 */
export const createForm = <S extends FormSchema<any>>(
  options: FormOptions<InferredFormValues<S>> & { schema: S },
): Form<InferredFormValues<S>> => new Form<InferredFormValues<S>>(options);
