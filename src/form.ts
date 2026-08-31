import { action, computed, makeObservable, observable, observe, runInAction } from 'mobx';
import { createRef, type Ref } from 'yummies/mobx';
import type {
  FieldError, FieldErrors, FieldPath, FieldPathValue, FieldState, FieldStateTree, FieldValues, FormOptions, FormSchema, SchemaIssue,
  SchemaOutput, SchemaResult, ValibotRunResult,
  RegisterOptions, RegisterReturn, ResetOptions, SetErrorConfig, SetValueConfig, SubmitHandlers,
} from './types.js';
import { clone, deleteAtPath, extractValue, getAtPath, isEqual, setAtPath } from './utils.js';

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
  /**
   * Validation errors nested by field path.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#errors)
   */
  private readonly errorsByPath = observable.map<string, FieldError>();
  private readonly errorPathCounts = observable.map<string, number>();
  private readonly errorChildren = new Map<string, Set<string>>();
  private readonly errorProxyCache = new Map<string, object>();
  private readonly fieldStatesByPath = observable.map<string, FieldState>();
  private readonly fieldStatePathCounts = observable.map<string, number>();
  private readonly fieldStateChildren = new Map<string, Set<string>>();
  private readonly fieldStateProxyCache = new Map<string, object>();

  /** Validation errors nested by field path. */
  get errors(): FieldErrors<T> {
    return this.createPathProxy<FieldError>(
      '', this.errorsByPath, this.errorPathCounts, this.errorChildren, this.errorProxyCache,
    ) as FieldErrors<T>;
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
   * Observable state for each registered field.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#fieldstate)
   */
  /** Observable state for each registered field, nested by field path. */
  get fieldState(): FieldStateTree<T> {
    return this.createPathProxy<FieldState>(
      '', this.fieldStatesByPath, this.fieldStatePathCounts, this.fieldStateChildren, this.fieldStateProxyCache,
    ) as FieldStateTree<T>;
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
  private valueObservers?: Array<() => void>;
  private observerTimer?: ReturnType<typeof setTimeout>;
  private readonly changedPaths = new Set<string>();
  private isMutating = false;
  private observerTreeChanged = false;
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
  get isValid(): boolean { return this.isValidOverride.get() ?? this.errorsByPath.size === 0; }

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
        if (this.options.mode === 'onBlur' || this.options.mode === 'all' || (this.hasError(path) && this.options.reValidateMode === 'onBlur')) await this.trigger(path);
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
    deleteAtPath(this.values, path);
    this.applyError(path, undefined);
    delete this.dirtyFields[path];
    delete this.touchedFields[path];
    delete this.validatingFields[path];
    this.deleteFieldState(path);
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
    this.ensureValueObservers();
    this.changedPaths.clear();
    this.isMutating = true;

    try {
      mutator();
    } finally {
      this.isMutating = false;
    }

    this.scheduleObserverCleanup();
    const paths = [...this.changedPaths];
    for (const path of paths) this.applyValueChange(path, { ...config, shouldValidate: false });
    if (paths.length && (config.shouldValidate ?? true)) {
      void this.trigger(paths as FieldPath<T>[]);
    }
    if (this.observerTreeChanged) {
      this.disposeValueObservers();
      this.observerTreeChanged = false;
      this.ensureValueObservers();
    }
  }

  private applyValueChange(path: string, config: SetValueConfig): void {
    if (config.shouldDirty ?? true) this.updateDirty(path);
    if (config.shouldTouch) this.markTouched(path);
    if (config.shouldValidate) void this.trigger(path as FieldPath<T>);
  }

  private ensureValueObservers(): void {
    if (!this.valueObservers || this.observerTreeChanged) {
      this.disposeValueObservers();
      this.valueObservers = [];
      this.observeValueTree(this.values, '', this.valueObservers);
      this.observerTreeChanged = false;
    }
    this.scheduleObserverCleanup();
  }

  private scheduleObserverCleanup(): void {
    if (this.observerTimer) clearTimeout(this.observerTimer);
    this.observerTimer = setTimeout(() => this.disposeValueObservers(), 10 * 60 * 1000);
    const timer = this.observerTimer as unknown as { unref?: () => void };
    timer.unref?.();
  }

  private disposeValueObservers(): void {
    for (const dispose of this.valueObservers ?? []) dispose();
    this.valueObservers = undefined;
    this.observerTimer = undefined;
  }

  private observeValueTree(value: unknown, basePath: string, disposers: Array<() => void>): void {
    if (!value || typeof value !== 'object') return;

    if (Array.isArray(value)) {
      disposers.push(observe(value, (change) => {
        if (change.type === 'splice') this.observerTreeChanged = true;
        if (this.isMutating && basePath) this.changedPaths.add(basePath);
      }));
    } else {
      disposers.push(observe(value as Record<string, unknown>, (change) => {
        if (change.type === 'update' && (typeof change.newValue === 'object' || typeof change.oldValue === 'object')) {
          this.observerTreeChanged = true;
        }
        if (!this.isMutating) return;
        const path = basePath ? `${basePath}.${String(change.name)}` : String(change.name);
        if (path) this.changedPaths.add(path);
      }));
    }

    for (const [key, child] of Object.entries(value)) {
      this.observeValueTree(child, basePath ? `${basePath}.${key}` : key, disposers);
    }
  }

  /**
   * Sets an error for a field and can focus it.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#seterrorname-error)
   */
  setError(name: FieldPath<T>, error: FieldError, config: SetErrorConfig = {}): void {
    const path = name as FieldPath<T> & string;
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
      this.isValidOverride.set(undefined);
      this.clearPathStore(this.errorsByPath, this.errorPathCounts, this.errorChildren);
      for (const [, state] of this.fieldStates()) this.applyFieldState(state, undefined);
      return;
    }
    for (const path of Array.isArray(name) ? name : [name]) this.applyError(path as FieldPath<T> & string, undefined);
  }

  /**
   * Validates one field, several fields, or the complete form.
   *
   * [**Documentation**](https://js2me.github.io/mobx-formly/api/form.html#triggername)
   */
  async trigger(name?: FieldPath<T> | FieldPath<T>[]): Promise<boolean> {
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
    try {
      const schemaErrors = await this.validateSchema();
      const validationPaths = paths ?? [...new Set([...this.fieldOptions.keys(), ...this.errorsByPath.keys(), ...this.errorPaths(schemaErrors)])];
      runInAction(() => {
        for (const path of validationPaths) {
          const schemaError = this.getError(schemaErrors, path);
          if (schemaError && this.isValidationCurrent(path, run, fieldVersions)) {
            this.applyError(path, schemaError);
          }
        }
      });
      for (const path of validationPaths) {
        const ruleError = await this.validateRules(path);
        runInAction(() => {
          if (this.isValidationCurrent(path, run, fieldVersions)) {
            if (ruleError) this.applyError(path, ruleError);
            else if (this.getError(schemaErrors, path)) this.applyError(path, this.getError(schemaErrors, path));
            else this.applyError(path, undefined);
          }
        });
      }
      return (paths ?? [...this.errorsByPath.keys()]).every((path) => !this.hasError(path));
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
        const valid = await this.trigger();
        if (valid) {
          await onValid(this.snapshot, this);
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
    this.disposeValueObservers();
    this.resetVersion += 1;
    this.validationVersion += 1;
    if (!options.keepIsValidating) {
      for (const path of Object.keys(this.validatingFields)) {
        delete this.validatingFields[path];
        const state = this.fieldStatesByPath.get(path);
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
      this.clearPathStore(this.errorsByPath, this.errorPathCounts, this.errorChildren);
      for (const [, state] of this.fieldStates()) this.applyFieldState(state, undefined);
    }
    this.isValidOverride.set(options.keepIsValid ? wasValid : undefined);
    if (!options.keepIsSubmitted) this.isSubmitted = false;
    if (!options.keepIsSubmitSuccessful) this.isSubmitSuccessful = false;
    if (!options.keepSubmitCount) this.submitCount = 0;
    for (const [path, state] of this.fieldStates()) {
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
  private shouldValidateOnChange(path: string): boolean { return this.options.mode === 'onChange' || this.options.mode === 'all' || (this.hasError(path) && this.options.reValidateMode === 'onChange'); }
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
  private async validateSchema(): Promise<FieldErrors<T>> {
    if (!this.options.schema) return {};
    const schema = this.options.schema;
    if ('safeParseAsync' in schema) {
      const result = await schema.safeParseAsync(this.snapshot) as SchemaResult<T>;
      if (result.success) return {};
      return this.normalizeSchemaErrors(result.error);
    }
    const result = await schema['~run']({ value: this.snapshot, typed: false }, {}) as ValibotRunResult<T>;
    if (!result.issues?.length) return {};
    return this.normalizeSchemaErrors({ issues: result.issues });
  }
  private normalizeSchemaErrors(error: { issues: SchemaIssue[] }): FieldErrors<T> {
    return error.issues.reduce<FieldErrors<T>>((errors, issue) => {
      const path = (issue.path ?? []).map((part) => String(typeof part === 'object' ? part.key : part)).join('.') || 'root';
      if (!this.getError(errors, path)) setAtPath(errors as Record<string, unknown>, path, { type: issue.code ?? issue.type ?? 'validation', message: issue.message });
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
        result = await rules.validate(value, this.snapshot);
      } catch {
        return { type: 'validate', message: 'Validation failed' };
      }
      if (result !== true) return { type: 'validate', message: typeof result === 'string' ? result : undefined };
    }
    return undefined;
  }
  private ensureFieldState(path: string): FieldState {
    const existing = this.fieldStatesByPath.get(path);
    if (existing) return existing;
    const state = { invalid: false, isDirty: false, isTouched: false, isValidating: false };
    this.setPathStore(this.fieldStatesByPath, this.fieldStatePathCounts, this.fieldStateChildren, path, state);
    return state;
  }
  private applyFieldState(state: FieldState, error: FieldError | undefined): void {
    state.error = error;
    state.invalid = !!error;
  }
  private applyError(path: string, error: FieldError | undefined): void {
    this.isValidOverride.set(undefined);
    if (error) this.setPathStore(this.errorsByPath, this.errorPathCounts, this.errorChildren, path, error);
    else this.deletePathStore(this.errorsByPath, this.errorPathCounts, this.errorChildren, path);
    this.applyFieldState(this.ensureFieldState(path), error);
  }

  private getError(errors: FieldErrors<T>, path: string): FieldError | undefined {
    const value = getAtPath(errors, path);
    return value && typeof value === 'object' && 'type' in value ? value as FieldError : undefined;
  }

  private hasError(path: string): boolean { return this.errorsByPath.has(path); }

  private errorPaths(errors: FieldErrors<T>, base = ''): string[] {
    const paths: string[] = [];
    for (const [key, value] of Object.entries(errors)) {
      if (value === undefined) continue;
      const path = base ? `${base}.${key}` : key;
      if (value && typeof value === 'object' && 'type' in value) paths.push(path);
      if (value && typeof value === 'object') paths.push(...this.errorPaths(value as FieldErrors<T>, path));
    }
    return paths;
  }

  private deleteFieldState(path: string): void {
    this.deletePathStore(this.fieldStatesByPath, this.fieldStatePathCounts, this.fieldStateChildren, path);
  }

  private fieldStates(): Array<[string, FieldState]> {
    return [...this.fieldStatesByPath.entries()];
  }

  private setPathStore<V>(store: Map<string, V>, counts: Map<string, number>, children: Map<string, Set<string>>, path: string, value: V): void {
    if (!store.has(path)) this.addPathToIndex(counts, children, path);
    store.set(path, value);
  }

  private deletePathStore<V>(store: Map<string, V>, counts: Map<string, number>, children: Map<string, Set<string>>, path: string): void {
    if (!store.delete(path)) return;
    const parts = path.split('.');
    for (let index = parts.length; index > 0; index -= 1) {
      const current = parts.slice(0, index).join('.');
      const count = (counts.get(current) ?? 1) - 1;
      if (count > 0) {
        counts.set(current, count);
        continue;
      }
      counts.delete(current);
      const parent = parts.slice(0, index - 1).join('.');
      const siblings = children.get(parent);
      siblings?.delete(parts[index - 1]);
      if (siblings?.size === 0) children.delete(parent);
    }
  }

  private clearPathStore<V>(store: Map<string, V>, counts: Map<string, number>, children: Map<string, Set<string>>): void {
    store.clear();
    counts.clear();
    children.clear();
  }

  private addPathToIndex(counts: Map<string, number>, children: Map<string, Set<string>>, path: string): void {
    const parts = path.split('.');
    for (let index = 1; index <= parts.length; index += 1) {
      const current = parts.slice(0, index).join('.');
      counts.set(current, (counts.get(current) ?? 0) + 1);
      const parent = parts.slice(0, index - 1).join('.');
      let siblings = children.get(parent);
      if (!siblings) children.set(parent, siblings = new Set());
      siblings.add(parts[index - 1]);
    }
  }

  private createPathProxy<V extends object>(
    path: string, store: Map<string, V>, counts: Map<string, number>, children: Map<string, Set<string>>, cache: Map<string, object>,
  ): object {
    const cached = cache.get(path);
    if (cached) return cached;
    const proxy = new Proxy({}, {
      get: (_, property) => {
        if (typeof property !== 'string') return undefined;
        const current = store.get(path);
        if (current && property in current) return current[property as keyof V];
        const childPath = path ? `${path}.${property}` : property;
        const value = store.get(childPath);
        if (value && !children.has(childPath)) return value;
        return counts.has(childPath) ? this.createPathProxy(childPath, store, counts, children, cache) : undefined;
      },
      ownKeys: () => [...Object.keys(store.get(path) ?? {}), ...(children.get(path) ?? [])],
      getOwnPropertyDescriptor: (_, property) => {
        if (typeof property !== 'string') return undefined;
        const value = store.get(path);
        if (value && property in value) return { configurable: true, enumerable: true, value: value[property as keyof V] };
        return children.get(path)?.has(property) ? { configurable: true, enumerable: true } : undefined;
      },
      set: () => false,
      deleteProperty: () => false,
    });
    cache.set(path, proxy);
    return proxy;
  }
}
