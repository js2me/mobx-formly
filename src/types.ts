import type { Ref } from 'yummies/mobx';

export type FieldValues = Record<string, unknown>;
export interface SchemaIssue {
  code?: string;
  type?: string;
  path?: Array<PropertyKey | { key: PropertyKey }>;
  message: string;
}

export interface StandardSchemaIssue {
  message: string;
  path?: readonly (PropertyKey | { readonly key: PropertyKey } | { readonly toString: () => string })[];
}

export type StandardSchemaResult<T> =
  | { value: T; issues?: undefined }
  | { value?: never; issues: readonly StandardSchemaIssue[] };

export interface StandardFormSchema<T> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardSchemaResult<T> | Promise<StandardSchemaResult<T>>;
  };
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
export type FormSchema<T> = SafeParseFormSchema<T> | ValibotFormSchema<T> | StandardFormSchema<T>;

export type SchemaOutput<S> = S extends SafeParseFormSchema<infer T>
  ? T
  : S extends StandardFormSchema<infer T>
    ? T
  : S extends { readonly '~types'?: { readonly output: infer T } }
    ? T
    : never;
/** Dot-separated path into the form value tree, for example `user.email`. */
export type FieldPath<T = FieldValues> = 'root' | {
  [K in Extract<keyof T, string>]: FieldPathForValue<K, T[K]>
}[Extract<keyof T, string>];

type FieldPathForValue<K extends string, V> =
  V extends readonly (infer I)[]
    ? I extends object
      ? K | `${K}.${number}` | `${K}.${number}.${FieldPath<I>}`
      : K | `${K}.${number}`
    : V extends ReadonlyMap<infer MapKey, infer MapValue>
      ? MapKey extends string
        ? MapValue extends object
          ? K | `${K}.${MapKey}` | `${K}.${MapKey}.${FieldPath<MapValue>}`
          : K | `${K}.${MapKey}`
        : K
      : V extends Date | RegExp | ReadonlySet<unknown>
        ? K
        : V extends object
          ? K | `${K}.${FieldPath<V>}`
          : K;

export type FieldPathValue<T, P extends string> =
  P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
      ? FieldPathValue<T[K], Rest>
      : T extends readonly (infer I)[]
        ? FieldPathValue<I, Rest>
        : T extends ReadonlyMap<infer MapKey, infer MapValue>
          ? K extends MapKey ? FieldPathValue<MapValue, Rest> : never
          : never
    : P extends keyof T ? T[P]
      : T extends readonly (infer I)[]
        ? P extends `${number}` ? I : never
        : T extends ReadonlyMap<infer MapKey, infer MapValue>
          ? P extends MapKey ? MapValue : never
          : never;

export interface FieldError {
  type: string;
  message?: string;
  types?: Record<string, string | true | string[]>;
}

/** Result of a single field validator: pass, one message, or several messages. */
export type ValidateResult = boolean | string | string[] | undefined;

/** Checks a field value against the rest of the form values. */
export type FieldValidate<TValue = unknown, TValues extends FieldValues = FieldValues> = (
  value: TValue,
  values: TValues,
) => ValidateResult | Promise<ValidateResult>;

export type ErrorNamespacePath = 'root' | `root.${string}`;
export type GlobalErrors = FieldError & Record<string, FieldError | undefined>;

type FieldErrorTree<V> =
  V extends readonly (infer I)[]
    ? FieldError & Array<I extends object ? FieldErrors<I> : FieldError | undefined>
    : V extends ReadonlyMap<infer MapKey, infer MapValue>
      ? FieldError & (MapKey extends string ? { [K in MapKey]?: FieldErrorTree<MapValue> } : {})
      : V extends Date | RegExp | ReadonlySet<unknown>
        ? FieldError
        : V extends object
          ? FieldError & FieldErrors<V>
          : FieldError;

export type FieldErrors<T extends object = FieldValues> = {
  [K in keyof T]?: FieldErrorTree<T[K]>;
} & { root?: GlobalErrors };

export interface FieldState {
  invalid: boolean;
  isDirty: boolean;
  isTouched: boolean;
  isValidating: boolean;
  error?: FieldError;
}

type FieldStateValueTree<V> =
  V extends readonly (infer I)[]
    ? FieldState & Array<I extends object ? FieldStateTree<I> : FieldState | undefined>
    : V extends ReadonlyMap<infer MapKey, infer MapValue>
      ? FieldState & (MapKey extends string ? { [K in MapKey]?: FieldStateValueTree<MapValue> } : {})
      : V extends Date | RegExp | ReadonlySet<unknown>
        ? FieldState
        : V extends object
          ? FieldState & FieldStateTree<V>
          : FieldState;

export type FieldStateTree<T extends object = FieldValues> = {
  [K in keyof T]?: FieldStateValueTree<T[K]>;
} & { root?: FieldState };

export interface FormState<T extends FieldValues = FieldValues> {
  errors: FieldErrors<T>;
  dirtyFields: Partial<Record<FieldPath<T>, true>>;
  touchedFields: Partial<Record<FieldPath<T>, true>>;
  validatingFields: Partial<Record<FieldPath<T>, true>>;
  isDirty: boolean;
  isTouched: boolean;
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
  validate?: FieldValidate<unknown, T> | Record<string, FieldValidate<unknown, T>>;
  /** Field paths re-validated whenever this field changes. */
  deps?: FieldPath<T> | FieldPath<T>[];
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

export interface TriggerConfig {
  shouldFocus?: boolean;
  shouldTouch?: boolean;
}

export interface ResetFieldOptions<T extends FieldValues, P extends FieldPath<T>> {
  keepDirty?: boolean;
  keepTouched?: boolean;
  keepError?: boolean;
  defaultValue?: FieldPathValue<T, P>;
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
  /** A resolver may submit transformed values, so its output type is not tied to the field values type. */
  resolver?: Resolver<T, any>;
  context?: unknown;
  mode?: 'onSubmit' | 'onChange' | 'onBlur' | 'onTouched' | 'all';
  reValidateMode?: 'onChange' | 'onBlur';
  criteriaMode?: 'firstError' | 'all';
  delayError?: number;
  shouldUseNativeValidation?: boolean;
  shouldFocusError?: boolean;
  disabled?: boolean;
}

export interface ResolverOptions<T extends FieldValues> {
  criteriaMode?: 'firstError' | 'all';
  fields: Record<string, RegisterOptions<T>>;
  names?: FieldPath<T>[];
  shouldUseNativeValidation?: boolean;
}

export type ResolverResult<T extends FieldValues, TTransformedValues = T> =
  | { values: TTransformedValues; errors: Record<string, never> }
  | { values: Record<string, never>; errors: FieldErrors<T> };

export type Resolver<T extends FieldValues = FieldValues, TTransformedValues = T> = (
  values: T,
  context: unknown,
  options: ResolverOptions<T>,
) => ResolverResult<T, TTransformedValues> | Promise<ResolverResult<T, TTransformedValues>>;

export interface SubmitHandlers<T extends FieldValues> {
  onValid: (values: T, form: unknown) => void | Promise<void>;
  onInvalid?: (errors: FieldErrors<T>, form: unknown) => void | Promise<void>;
}
