import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import { createRef, type Ref } from 'yummies/mobx';
import type {
  FieldError, FieldErrors, FieldPath, FieldPathValue, FieldState, FieldStateTree, FieldValues, FormOptions, FormSchema, SchemaIssue,
  SchemaOutput, SchemaResult, ValibotRunResult,
  RegisterOptions, RegisterReturn, ResetOptions, SetValueConfig, SubmitHandlers,
} from './types.js';
import { clone, deleteAtPath, extractValue, getAtPath, isEqual, setAtPath } from './utils.js';

export class Form<T extends FieldValues = FieldValues> {
  values: T;
  errors: Record<string, FieldError | undefined> = {};
  dirtyFields: Record<string, true | undefined> = {};
  touchedFields: Record<string, true | undefined> = {};
  validatingFields: Record<string, true | undefined> = {};
  fieldState: Record<string, FieldState | undefined> = {};
  isSubmitting = false;
  isSubmitted = false;
  isSubmitSuccessful = false;
  submitCount = 0;
  readonly refs = new Map<string, Ref<HTMLElement | null>>();

  private readonly defaultValues: T;
  private readonly options: Required<Pick<FormOptions<T>, 'mode' | 'reValidateMode' | 'disabled'>> & FormOptions<T>;
  private readonly fieldOptions = new Map<string, RegisterOptions<T>>();
  private readonly listeners = new Set<(values: T, info: { name?: string }) => void>();
  private validationVersion = 0;

  constructor(options?: FormOptions<T>);
  constructor(options: FormOptions<T> = {}) {
    this.options = {
      ...options,
      mode: options.mode ?? 'onSubmit',
      reValidateMode: options.reValidateMode ?? 'onChange',
      disabled: options.disabled ?? false,
    };
    this.defaultValues = clone((options.defaultValues ?? {}) as T);
    this.values = clone((options.values ?? options.defaultValues ?? {}) as T);
    makeObservable(this, {
      values: observable.deep,
      errors: observable.shallow,
      dirtyFields: observable.shallow,
      touchedFields: observable.shallow,
      validatingFields: observable.shallow,
      isSubmitting: observable,
      isSubmitted: observable,
      isSubmitSuccessful: observable,
      submitCount: observable,
      disabled: computed,
      fieldState: observable.deep,
      isDirty: computed,
      isValid: computed,
      register: action,
      unregister: action,
      setValue: action,
      setError: action,
      clearErrors: action,
      trigger: action,
      handleSubmit: action,
      reset: action,
      resetField: action,
      setFocus: action,
      subscribe: action,
    });
  }

  get disabled(): boolean { return this.options.disabled; }
  get isDirty(): boolean { return Object.keys(this.dirtyFields).length > 0; }
  get isValid(): boolean { return Object.keys(this.errors).length === 0; }

  register(name: FieldPath<T>, options: RegisterOptions<T> = {}): RegisterReturn {
    const path = name as FieldPath<T> & string;
    this.fieldOptions.set(path, options);
    let ref = this.refs.get(path);
    if (!ref) {
      ref = createRef<HTMLElement | null>();
      this.refs.set(path, ref);
    }
    this.ensureFieldState(path);
    return {
      name: path,
      ref,
      onChange: async (eventOrValue) => {
        if (this.disabled) return;
        const value = this.transformValue(extractValue(eventOrValue), options);
        const shouldValidate = this.shouldValidateOnChange(path);
        this.setValue(path, value as FieldPathValue<T, typeof path>, { shouldDirty: true, shouldValidate: false });
        if (shouldValidate) await this.trigger(path);
      },
      onBlur: async () => {
        if (this.disabled) return;
        this.markTouched(path);
        if (this.options.mode === 'onBlur' || this.options.mode === 'all' || (path in this.errors && this.options.reValidateMode === 'onBlur')) await this.trigger(path);
      },
    };
  }

  unregister(name: FieldPath<T>): void {
    const path = name as FieldPath<T> & string;
    deleteAtPath(this.values, path);
    delete this.errors[path];
    delete this.dirtyFields[path];
    delete this.touchedFields[path];
    delete this.validatingFields[path];
    delete this.fieldState[path];
    this.fieldOptions.delete(path);
    this.refs.delete(path);
    this.notify(path);
  }

  setValue<P extends FieldPath<T>>(name: P, value: FieldPathValue<T, P>, config: SetValueConfig = {}): void {
    const path = name as FieldPath<T> & string;
    setAtPath(this.values, path, value);
    if (config.shouldDirty ?? true) this.updateDirty(path);
    if (config.shouldTouch) this.markTouched(path);
    this.notify(path);
    if (config.shouldValidate) void this.trigger(path);
  }

  setError(name: FieldPath<T>, error: FieldError): void {
    this.applyError(name as FieldPath<T> & string, error);
  }

  clearErrors(name?: FieldPath<T> | FieldPath<T>[]): void {
    if (!name) {
      this.errors = {};
      for (const state of Object.values(this.fieldState)) if (state) this.applyFieldState(state, undefined);
      return;
    }
    for (const path of Array.isArray(name) ? name : [name]) this.applyError(path as FieldPath<T> & string, undefined);
  }

  async trigger(name?: FieldPath<T> | FieldPath<T>[]): Promise<boolean> {
    const paths = name ? (Array.isArray(name) ? name : [name]).map(String) : undefined;
    const run = ++this.validationVersion;
    for (const path of paths ?? this.fieldOptions.keys()) {
      this.validatingFields[path] = true;
      this.ensureFieldState(path).isValidating = true;
    }
    try {
      const schemaErrors = await this.validateSchema();
      const validationPaths = paths ?? [...new Set([...this.fieldOptions.keys(), ...Object.keys(this.errors), ...Object.keys(schemaErrors)])];
      runInAction(() => {
        for (const path of validationPaths) {
          if (this.validationVersion === run && schemaErrors[path]) {
            this.applyError(path, schemaErrors[path]);
          }
        }
      });
      for (const path of validationPaths) {
        const ruleError = await this.validateRules(path);
        runInAction(() => {
          if (this.validationVersion === run) {
            if (ruleError) this.applyError(path, ruleError);
            else if (schemaErrors[path]) this.applyError(path, schemaErrors[path]);
            else this.applyError(path, undefined);
          }
        });
      }
      return (paths ?? Object.keys(this.errors)).every((path) => !this.errors[path]);
    } finally {
      runInAction(() => {
        if (this.validationVersion === run) {
          for (const path of paths ?? this.fieldOptions.keys()) {
            delete this.validatingFields[path];
            this.ensureFieldState(path).isValidating = false;
          }
        }
      });
    }
  }

  handleSubmit({ onValid, onInvalid }: SubmitHandlers<T>): () => Promise<void> {
    return async () => {
      this.isSubmitting = true;
      this.isSubmitted = true;
      this.submitCount += 1;
      try {
        const valid = await this.trigger();
        if (valid) {
          await onValid(this.snapshot(), this);
          runInAction(() => { this.isSubmitSuccessful = true; });
        } else {
          await onInvalid?.(this.errors, this);
          runInAction(() => { this.isSubmitSuccessful = false; });
        }
      } finally {
        runInAction(() => { this.isSubmitting = false; });
      }
    };
  }

  reset(values?: Partial<T>, options: ResetOptions = {}): void {
    this.validationVersion += 1;
    for (const path of Object.keys(this.validatingFields)) {
      delete this.validatingFields[path];
      const state = this.fieldState[path];
      if (state) state.isValidating = false;
    }
    const next = clone((values ?? this.defaultValues) as T);
    this.values = next;
    if (!options.keepDefaultValues && values) Object.assign(this.defaultValues, clone(values));
    if (!options.keepDirty) this.dirtyFields = {};
    if (!options.keepTouched) this.touchedFields = {};
    if (!options.keepErrors) {
      this.errors = {};
      for (const state of Object.values(this.fieldState)) if (state) this.applyFieldState(state, undefined);
    }
    if (!options.keepIsSubmitted) { this.isSubmitted = false; this.isSubmitSuccessful = false; }
    if (!options.keepSubmitCount) this.submitCount = 0;
    for (const [path, state] of Object.entries(this.fieldState)) if (state) {
      state.isDirty = !!this.dirtyFields[path];
      state.isTouched = !!this.touchedFields[path];
    }
    this.notify();
  }

  resetField(name: FieldPath<T>): void {
    const path = name as string;
    setAtPath(this.values, path, clone(getAtPath(this.defaultValues, path)));
    delete this.errors[path]; delete this.dirtyFields[path]; delete this.touchedFields[path];
    this.applyFieldState(this.ensureFieldState(path), undefined);
    this.notify(path);
  }

  setFocus(name: FieldPath<T>): void { this.refs.get(name as string)?.current?.focus(); }

  subscribe(listener: (values: T, info: { name?: string }) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private snapshot(): T { return clone(this.values); }
  private notify(name?: string): void { for (const listener of this.listeners) listener(this.snapshot(), { name }); }
  private markTouched(path: string): void {
    this.touchedFields[path] = true;
    this.ensureFieldState(path).isTouched = true;
  }
  private updateDirty(path: string): void {
    if (isEqual(getAtPath(this.values, path), getAtPath(this.defaultValues, path))) delete this.dirtyFields[path];
    else this.dirtyFields[path] = true;
    this.ensureFieldState(path).isDirty = !!this.dirtyFields[path];
  }
  private shouldValidateOnChange(path: string): boolean { return this.options.mode === 'onChange' || this.options.mode === 'all' || (path in this.errors && this.options.reValidateMode === 'onChange'); }
  private transformValue(value: unknown, options: RegisterOptions<T>): unknown {
    if (options.setValueAs) return options.setValueAs(value);
    if (options.valueAsNumber) return value === '' ? Number.NaN : Number(value);
    if (options.valueAsDate) return new Date(String(value));
    return value;
  }
  private async validateSchema(): Promise<FieldErrors<T>> {
    if (!this.options.schema) return {};
    const schema = this.options.schema;
    if ('safeParseAsync' in schema) {
      const result = await schema.safeParseAsync(this.snapshot()) as SchemaResult<T>;
      if (result.success) return {};
      return this.normalizeSchemaErrors(result.error);
    }
    const result = await schema['~run']({ value: this.snapshot(), typed: false }, {}) as ValibotRunResult<T>;
    if (!result.issues?.length) return {};
    return this.normalizeSchemaErrors({ issues: result.issues });
  }
  private normalizeSchemaErrors(error: { issues: SchemaIssue[] }): FieldErrors<T> {
    return error.issues.reduce<FieldErrors<T>>((errors, issue) => {
      const path = (issue.path ?? []).map((part) => String(typeof part === 'object' ? part.key : part)).join('.') || 'root';
      if (!errors[path]) errors[path] = { type: issue.code ?? issue.type ?? 'validation', message: issue.message };
      return errors;
    }, {});
  }
  private async validateRules(path: string): Promise<FieldError | undefined> {
    const rules = this.fieldOptions.get(path);
    if (!rules) return undefined;
    const value = getAtPath(this.values, path);
    const fail = (type: string, rule: string | boolean | undefined) => typeof rule === 'string' ? { type, message: rule } : { type };
    if (rules.required && (value === undefined || value === null || value === '')) return fail('required', rules.required);
    if (rules.minLength && String(value ?? '').length < rules.minLength.value) return { type: 'minLength', message: rules.minLength.message };
    if (rules.maxLength && String(value ?? '').length > rules.maxLength.value) return { type: 'maxLength', message: rules.maxLength.message };
    if (rules.min && Number(value) < rules.min.value) return { type: 'min', message: rules.min.message };
    if (rules.max && Number(value) > rules.max.value) return { type: 'max', message: rules.max.message };
    if (rules.pattern && !rules.pattern.value.test(String(value ?? ''))) return { type: 'pattern', message: rules.pattern.message };
    if (rules.validate) {
      let result: boolean | string;
      try {
        result = await rules.validate(value, this.snapshot());
      } catch {
        return { type: 'validate', message: 'Validation failed' };
      }
      if (result !== true) return { type: 'validate', message: typeof result === 'string' ? result : undefined };
    }
    return undefined;
  }
  private ensureFieldState(path: string): FieldState {
    return (this.fieldState[path] ??= { invalid: false, isDirty: false, isTouched: false, isValidating: false });
  }
  private applyFieldState(state: FieldState, error: FieldError | undefined): void {
    state.error = error;
    state.invalid = !!error;
  }
  private applyError(path: string, error: FieldError | undefined): void {
    if (error) this.errors[path] = error;
    else delete this.errors[path];
    this.applyFieldState(this.ensureFieldState(path), error);
  }
}
