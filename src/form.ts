import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import { createRef, type Ref } from 'yummies/mobx';
import type {
  FieldError, FieldErrors, FieldPath, FieldPathValue, FieldState, FieldStateTree, FieldValues, FormOptions,
  RegisterOptions, RegisterReturn, ResetOptions, SetErrorConfig, SetValueConfig, SubmitHandlers,
} from './types.js';
import { clone, deleteAtPath, extractValue, getAtPath, isEqual, setAtPath } from './utils.js';
import { collectErrorPaths, findErrorAtPath } from './utils.js';
import { PathStore } from './path-store.js';
import { MutationTracker } from './mutation-tracker.js';
import { FormValidator } from './validation.js';

export class Form<T extends FieldValues = FieldValues> {
  /**
   * Current form values.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#values)
   */
  values: T;
  /**
   * Cached default values used by reset, resetField, and dirty comparison.
   * Updated by reset unless `keepDefaultValues` is passed.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#defaultvalues)
   */
  defaultValues: T;

  private readonly errorStore = new PathStore<FieldError>();
  private readonly fieldStateStore = new PathStore<FieldState>();

  /** Validation errors nested by field path. */
  get errors(): FieldErrors<T> {
    return this.errorStore.proxy() as FieldErrors<T>;
  }
  /**
   * Field paths whose values differ from their defaults.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#dirtyfields)
   */
  dirtyFields: Record<string, true | undefined> = {};
  /**
   * Field paths that have been touched.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#touchedfields)
   */
  touchedFields: Record<string, true | undefined> = {};
  /**
   * Field paths that are currently being validated.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#validatingfields)
   */
  validatingFields: Record<string, true | undefined> = {};
  /**
   * Observable state for each registered field, nested by field path.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#fieldstate)
   */
  get fieldState(): FieldStateTree<T> {
    return this.fieldStateStore.proxy() as FieldStateTree<T>;
  }
  /**
   * Whether a submission is currently running.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#issubmitting)
   */
  isSubmitting = false;
  /**
   * Whether the form has been submitted at least once.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#issubmitted)
   */
  isSubmitted = false;
  /**
   * Whether the latest submission succeeded.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#issubmitsuccessful)
   */
  isSubmitSuccessful = false;
  /**
   * Number of submission attempts.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#submitcount)
   */
  submitCount = 0;
  /**
   * Refs registered for fields.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#refs)
   */
  readonly refs = new Map<string, Ref<HTMLElement | null>>();

  private readonly options: Required<Pick<FormOptions<T>, 'mode' | 'reValidateMode' | 'disabled'>> & FormOptions<T>;
  private readonly fieldOptions = new Map<string, RegisterOptions<T>>();
  private readonly touchedValidationFields = new Set<string>();
  private readonly tracker: MutationTracker<T>;
  private readonly validator: FormValidator<T>;
  private activeSubmissions = 0;
  private resetVersion = 0;
  private readonly isValidOverride = observable.box<boolean | undefined>(undefined);
  private validationVersion = 0;
  private readonly fieldValidationVersions = new Map<string, number>();

  /** Creates a form with optional initial values, schema, and validation settings.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#constructor-options)
   */
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
    this.tracker = new MutationTracker<T>(() => this.values);
    this.validator = new FormValidator<T>({
      options: this.options,
      fieldOptions: this.fieldOptions,
      refs: this.refs,
      valueAt: (path) => getAtPath(this.values, path),
      snapshot: () => this.snapshot,
      applyError: (path, error) => this.applyError(path, error),
    });
    makeObservable(this, {
      values: observable.deep,
      defaultValues: observable.deep,
      dirtyFields: observable.shallow,
      touchedFields: observable.shallow,
      validatingFields: observable.shallow,
      isSubmitting: observable,
      isSubmitted: observable,
      isSubmitSuccessful: observable,
      submitCount: observable,
      disabled: computed,
      isDirty: computed,
      isTouched: computed,
      isValid: computed,
      snapshot: computed,
      register: action,
      unregister: action,
      setValue: action,
      mutate: action,
      setError: action,
      clearErrors: action,
      trigger: action,
      handleSubmit: action,
      reset: action,
      resetField: action,
      setFocus: action,
    });
  }

  /**
   * Whether registered event handlers ignore changes and blur events.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#disabled)
   */
  get disabled(): boolean { return this.options.disabled; }

  /**
   * Whether any field is dirty.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#isdirty)
   */
  get isDirty(): boolean { return Object.keys(this.dirtyFields).length > 0; }

  /**
   * Whether any field has been touched.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#istouched)
   */
  get isTouched(): boolean { return Object.keys(this.touchedFields).length > 0; }

  /**
   * Whether the form has no errors. Frozen by `reset` with `keepIsValid`
   * until the next error or validation update.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#isvalid)
   */
  get isValid(): boolean { return this.isValidOverride.get() ?? this.errorStore.size === 0; }

  /**
   * Registers a field and returns its ref and event handlers.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#registername-options)
   */
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
        if (this.options.mode === 'onTouched') this.touchedValidationFields.add(path);
        if (this.options.mode === 'onBlur' || this.options.mode === 'onTouched' || this.options.mode === 'all' || (this.hasError(path) && this.options.reValidateMode === 'onBlur')) {
          this.validator.flushDelayed(path);
          await this.trigger(path);
        }
      },
    };
  }

  /**
   * Removes a field, its value, and its associated state.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#unregistername)
   */
  unregister(name: FieldPath<T>): void {
    const path = name as FieldPath<T> & string;
    this.fieldValidationVersions.set(path, (this.fieldValidationVersions.get(path) ?? 0) + 1);
    this.validator.cancelDelayed(path);
    this.touchedValidationFields.delete(path);
    deleteAtPath(this.values, path);
    this.applyError(path, undefined);
    delete this.dirtyFields[path];
    delete this.touchedFields[path];
    delete this.validatingFields[path];
    this.fieldStateStore.delete(path);
    this.fieldOptions.delete(path);
    this.refs.delete(path);
  }

  /**
   * Updates a field value and optionally changes its state or validates it.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#setvaluename-value-config)
   */
  setValue<P extends FieldPath<T>>(name: P, value: FieldPathValue<T, P>, config: SetValueConfig = {}): void {
    const path = name as FieldPath<T> & string;
    setAtPath(this.values, path, value);
    this.applyValueChange(path, config);
  }

  /**
   * Groups direct value changes and processes their changed paths together.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#mutatemutator-config)
   */
  mutate(mutator: () => void, config: SetValueConfig = {}): void {
    const paths = this.tracker.track(mutator);
    for (const path of paths) this.applyValueChange(path, { ...config, shouldValidate: false });
    if (paths.length && (config.shouldValidate ?? true)) {
      void this.trigger(paths as FieldPath<T>[]);
    }
  }

  private applyValueChange(path: string, config: SetValueConfig): void {
    if (config.shouldDirty ?? true) this.updateDirty(path);
    if (config.shouldTouch) this.markTouched(path);
    if (config.shouldValidate) void this.trigger(path as FieldPath<T>);
  }

  /**
   * Sets an error for a field and can focus it.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#seterrorname-error)
   */
  setError(name: FieldPath<T>, error: FieldError, config: SetErrorConfig = {}): void {
    const path = name as FieldPath<T> & string;
    this.validator.cancelDelayed(path);
    this.applyError(path, error);
    if (config.shouldFocus) this.refs.get(path)?.current?.focus();
  }

  /**
   * Clears one, several, or all field errors.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#clearerrorsname)
   */
  clearErrors(name?: FieldPath<T> | FieldPath<T>[]): void {
    if (!name) {
      this.validator.cancelAllDelayed();
      this.isValidOverride.set(undefined);
      this.errorStore.clear();
      for (const [, state] of this.fieldStateStore.entries()) this.applyFieldState(state, undefined);
      return;
    }
    for (const path of Array.isArray(name) ? name : [name]) {
      this.validator.cancelDelayed(path as string);
      this.applyError(path as FieldPath<T> & string, undefined);
    }
  }

  /**
   * Validates one field, several fields, or the complete form.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#triggername)
   */
  async trigger(name?: FieldPath<T> | FieldPath<T>[]): Promise<boolean> {
    return (await this.runValidation(name)).valid;
  }

  private async runValidation(name?: FieldPath<T> | FieldPath<T>[]): Promise<{ valid: boolean; values?: T }> {
    const paths = name ? (Array.isArray(name) ? name : [name]).map(String) : undefined;
    const run = ++this.validationVersion;
    const fieldVersions = new Map<string, number>();
    for (const path of paths ?? this.fieldOptions.keys()) {
      if (this.fieldOptions.has(path)) fieldVersions.set(path, this.fieldValidationVersions.get(path) ?? 0);
    }
    for (const path of paths ?? this.fieldOptions.keys()) {
      this.validatingFields[path] = true;
      this.ensureFieldState(path).isValidating = true;
    }
    let valid = true;
    try {
      const schemaResult = await this.validator.resolveSchemaErrors(paths);
      const schemaErrors = schemaResult.errors;
      const validationPaths = paths ?? [...new Set([...this.fieldOptions.keys(), ...this.errorStore.paths(), ...collectErrorPaths(schemaErrors)])];
      for (const path of validationPaths) {
        const ruleError = await this.validator.validateRules(path);
        runInAction(() => {
          if (this.isValidationCurrent(path, run, fieldVersions)) {
            const schemaError = findErrorAtPath(schemaErrors, path);
            const error = this.validator.mergeErrors(schemaError, ruleError);
            if (error) valid = false;
            this.validator.applyValidationError(path, error);
          }
        });
      }
      return { valid, values: valid ? schemaResult.values : undefined };
    } finally {
      runInAction(() => {
        if (this.validationVersion === run) {
          for (const path of paths ?? this.fieldOptions.keys()) {
            if (!this.isValidationCurrent(path, run, fieldVersions)) continue;
            delete this.validatingFields[path];
            this.ensureFieldState(path).isValidating = false;
          }
        }
      });
    }
  }

  /**
   * Creates an asynchronous submit handler with validation and result callbacks.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#handlesubmithandlers)
   */
  handleSubmit({ onValid, onInvalid }: SubmitHandlers<T>): () => Promise<void> {
    return async () => {
      this.activeSubmissions += 1;
      this.isSubmitting = true;
      this.isSubmitted = true;
      this.submitCount += 1;
      const submissionResetVersion = this.resetVersion;
      try {
        const { valid, values } = await this.runValidation();
        if (valid) {
          await onValid(values ?? this.snapshot, this);
          runInAction(() => {
            if (this.resetVersion === submissionResetVersion) this.isSubmitSuccessful = true;
          });
        } else {
          await onInvalid?.(this.errors, this);
          runInAction(() => {
            if (this.resetVersion === submissionResetVersion) this.isSubmitSuccessful = false;
          });
        }
      } finally {
        runInAction(() => {
          this.activeSubmissions -= 1;
          this.isSubmitting = this.activeSubmissions > 0;
        });
      }
    };
  }

  /**
   * Resets values and selected form state.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#resetvalues-options)
   */
  reset(values?: Partial<T>, options: ResetOptions = {}): void {
    this.validator.cancelAllDelayed();
    this.touchedValidationFields.clear();
    this.tracker.dispose();
    this.resetVersion += 1;
    this.validationVersion += 1;
    if (!options.keepIsValidating) {
      for (const path of Object.keys(this.validatingFields)) {
        delete this.validatingFields[path];
        const state = this.fieldStateStore.get(path);
        if (state) state.isValidating = false;
      }
    }
    if (!options.keepValues) {
      const next = clone((values ?? this.defaultValues) as T);
      if (options.keepDirtyValues) {
        for (const path of Object.keys(this.dirtyFields)) {
          const value = getAtPath(this.values, path);
          if (value !== undefined) setAtPath(next, path, clone(value));
        }
      }
      this.values = next;
    }
    if (!options.keepDefaultValues && values) Object.assign(this.defaultValues, clone(values));
    if (!options.keepDirty && !options.keepDirtyValues) this.dirtyFields = {};
    if (!options.keepTouched) this.touchedFields = {};
    const wasValid = this.isValid;
    if (!options.keepErrors) {
      this.errorStore.clear();
      for (const [, state] of this.fieldStateStore.entries()) this.applyFieldState(state, undefined);
    }
    this.isValidOverride.set(options.keepIsValid ? wasValid : undefined);
    if (!options.keepIsSubmitted) this.isSubmitted = false;
    if (!options.keepIsSubmitSuccessful) this.isSubmitSuccessful = false;
    if (!options.keepSubmitCount) this.submitCount = 0;
    for (const [path, state] of this.fieldStateStore.entries()) {
      state.isDirty = !!this.dirtyFields[path];
      state.isTouched = !!this.touchedFields[path];
    }
  }

  /**
   * Resets one field to its current default value and clears its state.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#resetfieldname)
   */
  resetField(name: FieldPath<T>): void {
    const path = name as string;
    this.validator.cancelDelayed(path);
    this.touchedValidationFields.delete(path);
    this.fieldValidationVersions.set(path, (this.fieldValidationVersions.get(path) ?? 0) + 1);
    setAtPath(this.values, path, clone(getAtPath(this.defaultValues, path)));
    this.applyError(path, undefined); delete this.dirtyFields[path]; delete this.touchedFields[path];
    delete this.validatingFields[path];
    const state = this.ensureFieldState(path);
    this.applyFieldState(state, undefined);
    state.isDirty = false;
    state.isTouched = false;
    state.isValidating = false;
  }

  /**
   * Focuses a registered field when its ref points to a focusable element.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#setfocusname)
   */
  setFocus(name: FieldPath<T>): void { this.refs.get(name as string)?.current?.focus(); }

  /**
   * Returns a plain copy of the current values.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#snapshot)
   */
  get snapshot(): T { return clone(this.values); }
  private markTouched(path: string): void {
    this.touchedFields[path] = true;
    this.ensureFieldState(path).isTouched = true;
  }
  private updateDirty(path: string): void {
    if (isEqual(getAtPath(this.values, path), getAtPath(this.defaultValues, path))) delete this.dirtyFields[path];
    else this.dirtyFields[path] = true;
    this.ensureFieldState(path).isDirty = !!this.dirtyFields[path];
  }
  private shouldValidateOnChange(path: string): boolean {
    return this.options.mode === 'onChange'
      || this.options.mode === 'all'
      || (this.options.mode === 'onTouched' && this.touchedValidationFields.has(path))
      || (this.hasError(path) && this.options.reValidateMode === 'onChange');
  }
  private isValidationCurrent(path: string, run: number, fieldVersions: Map<string, number>): boolean {
    if (this.validationVersion !== run) return false;
    const version = fieldVersions.get(path);
    return version === undefined
      || (this.fieldOptions.has(path) && (this.fieldValidationVersions.get(path) ?? 0) === version);
  }
  private transformValue(value: unknown, options: RegisterOptions<T>): unknown {
    if (options.setValueAs) return options.setValueAs(value);
    if (options.valueAsNumber) return value === '' ? Number.NaN : Number(value);
    if (options.valueAsDate) return new Date(String(value));
    return value;
  }
  private ensureFieldState(path: string): FieldState {
    return this.fieldStateStore.ensure(path, () => ({ invalid: false, isDirty: false, isTouched: false, isValidating: false, error: undefined }));
  }
  private applyFieldState(state: FieldState, error: FieldError | undefined): void {
    state.error = error;
    state.invalid = !!error;
  }
  private applyError(path: string, error: FieldError | undefined): void {
    this.isValidOverride.set(undefined);
    if (error) this.errorStore.set(path, error);
    else this.errorStore.delete(path);
    const state = this.ensureFieldState(path);
    state.error = error;
    state.invalid = !!error;
  }

  private hasError(path: string): boolean { return this.errorStore.has(path); }
}
