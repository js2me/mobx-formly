import type { Ref } from 'yummies/mobx';

export type FieldValues = Record<string, unknown>;
export interface SchemaIssue {
  code?: string;
  type?: string;
  path?: Array<PropertyKey | { key: PropertyKey }>;
  message: string;
}

export type SchemaResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: SchemaIssue[] } };

/** Safe-parse-compatible schema contract. */
export interface SafeParseFormSchema<T> {
  safeParseAsync(value: unknown): Promise<SchemaResult<T>>;
}

/** Valibot-compatible schema contract. */
export interface ValibotFormSchema<T> {
  readonly '~types'?: { readonly output: T };
  '~run': (...args: any[]) => any;
}

export interface ValibotRunResult<T> {
  success?: boolean;
  value?: T;
  issues?: SchemaIssue[];
}

/** Schema contract accepted by Form. Both Zod and Valibot schemas fit this interface. */
export type FormSchema<T> = SafeParseFormSchema<T> | ValibotFormSchema<T>;

export type SchemaOutput<S> = S extends SafeParseFormSchema<infer T>
  ? T
  : S extends { readonly '~types'?: { readonly output: infer T } }
    ? T
    : never;
/** Dot-separated path into the form value tree, for example `user.email`. */
export type FieldPath<T = FieldValues> = 'root' | {
  [K in Extract<keyof T, string>]: T[K] extends readonly unknown[]
    ? T[K] extends readonly (infer I)[]
      ? I extends object
        ? K | `${K}.${number}` | `${K}.${number}.${FieldPath<I>}`
        : K | `${K}.${number}`
      : K
    : T[K] extends object
      ? K | `${K}.${FieldPath<T[K]>}`
      : K
}[Extract<keyof T, string>];

export type FieldPathValue<T, P extends string> =
  P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
      ? FieldPathValue<T[K], Rest>
      : T extends readonly (infer I)[]
        ? FieldPathValue<I, Rest>
      : never
    : P extends keyof T ? T[P]
      : T extends readonly (infer I)[]
        ? P extends `${number}` ? I : never
        : never;

export interface FieldError {
  type: string;
  message?: string;
}

export type FieldErrors<T extends object = FieldValues> = {
  [K in keyof T]?: T[K] extends readonly (infer I)[]
    ? FieldError & Array<I extends object ? FieldErrors<I> : FieldError | undefined>
    : T[K] extends object
      ? FieldError & FieldErrors<T[K]>
      : FieldError;
} & { root?: FieldError };

export interface FieldState {
  invalid: boolean;
  isDirty: boolean;
  isTouched: boolean;
  isValidating: boolean;
  error?: FieldError;
}

export type FieldStateTree<T extends object = FieldValues> = {
  [K in keyof T]?: T[K] extends readonly (infer I)[]
    ? FieldState & Array<I extends object ? FieldStateTree<I> : FieldState | undefined>
    : T[K] extends object
      ? FieldState & FieldStateTree<T[K]>
      : FieldState;
} & { root?: FieldState };

export interface FormState<T extends FieldValues = FieldValues> {
  errors: FieldErrors<T>;
  dirtyFields: Partial<Record<FieldPath<T>, true>>;
  touchedFields: Partial<Record<FieldPath<T>, true>>;
  validatingFields: Partial<Record<FieldPath<T>, true>>;
  isDirty: boolean;
  isValid: boolean;
  isValidating: boolean;
  isSubmitting: boolean;
  isSubmitted: boolean;
  isSubmitSuccessful: boolean;
  submitCount: number;
  disabled: boolean;
}

export interface RegisterOptions<T extends FieldValues = FieldValues> {
  required?: string | boolean;
  minLength?: { value: number; message?: string };
  maxLength?: { value: number; message?: string };
  min?: { value: number; message?: string };
  max?: { value: number; message?: string };
  pattern?: { value: RegExp; message?: string };
  validate?: (value: unknown, values: T) => boolean | string | Promise<boolean | string>;
  valueAsNumber?: boolean;
  valueAsDate?: boolean;
  setValueAs?: (value: unknown) => unknown;
}

export interface RegisterReturn {
  name: string;
  ref: Ref<HTMLElement | null>;
  onChange: (eventOrValue: unknown) => Promise<void>;
  onBlur: () => Promise<void>;
}

export interface SetValueConfig {
  shouldValidate?: boolean;
  shouldDirty?: boolean;
  shouldTouch?: boolean;
}

export interface SetErrorConfig {
  shouldFocus?: boolean;
}

export interface ResetOptions {
  keepDefaultValues?: boolean;
  keepValues?: boolean;
  keepDirty?: boolean;
  keepDirtyValues?: boolean;
  keepTouched?: boolean;
  keepErrors?: boolean;
  keepIsValid?: boolean;
  keepIsValidating?: boolean;
  keepIsSubmitted?: boolean;
  keepIsSubmitSuccessful?: boolean;
  keepSubmitCount?: boolean;
}

export interface FormOptions<T extends FieldValues> {
  defaultValues?: Partial<T>;
  values?: Partial<T>;
  schema?: FormSchema<T>;
  mode?: 'onSubmit' | 'onChange' | 'onBlur' | 'all';
  reValidateMode?: 'onChange' | 'onBlur';
  disabled?: boolean;
}

export interface SubmitHandlers<T extends FieldValues> {
  onValid: (values: T, form: unknown) => void | Promise<void>;
  onInvalid?: (errors: FieldErrors<T>, form: unknown) => void | Promise<void>;
}
