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
  '~run': (...args: any[]) => unknown;
}

/** Schema contract accepted by Form. Both Zod and Valibot schemas fit this interface. */
export type FormSchema<T> = SafeParseFormSchema<T> | ValibotFormSchema<T>;
/** Dot-separated path into the form value tree, for example `user.email`. */
export type FieldPath<T extends FieldValues = FieldValues> = string;

export interface FieldError {
  type: string;
  message?: string;
}

export type FieldErrors<T extends FieldValues = FieldValues> = Partial<Record<FieldPath<T>, FieldError>>;

export interface FieldState {
  invalid: boolean;
  isDirty: boolean;
  isTouched: boolean;
  isValidating: boolean;
  error?: FieldError;
}

export type FieldStateTree<T extends FieldValues = FieldValues> = Partial<Record<FieldPath<T>, FieldState>>;

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

export interface ResetOptions {
  keepDefaultValues?: boolean;
  keepDirty?: boolean;
  keepTouched?: boolean;
  keepErrors?: boolean;
  keepIsSubmitted?: boolean;
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
