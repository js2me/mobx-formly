import { Form } from './form.js';
import type { FieldValues, FormOptions, FormSchema, SchemaOutput } from './types.js';

export type InferredFormValues<S> = Extract<SchemaOutput<S>, FieldValues>;

export const createForm = <S extends FormSchema<any>>(
  options: FormOptions<InferredFormValues<S>> & { schema: S },
): Form<InferredFormValues<S>> => new Form<InferredFormValues<S>>(options);
