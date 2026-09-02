import type { Ref } from 'yummies/mobx';
import type {
  FieldError, FieldErrors, FieldPath, FieldValues, FormOptions, RegisterOptions, ResolverResult,
  SchemaIssue, SchemaResult, StandardSchemaIssue, ValibotRunResult,
} from './types.js';
import { findErrorAtPath, setAtPath } from './utils.js';

/** Form-side collaborators the validator needs, kept as callbacks so Form internals stay private. */
export interface ValidatorHost<T extends FieldValues> {
  /** Current form options: schema, resolver, criteriaMode, delayError, and native validation settings. */
  readonly options: FormOptions<T>;
  /** Registration options per field path. */
  readonly fieldOptions: Map<string, RegisterOptions<T>>;
  /** Registered field refs used for native validity reporting. */
  readonly refs: Map<string, Ref<HTMLElement | null>>;
  /** Current value stored at the field path. */
  valueAt(path: string): unknown;
  /** Plain copy of the current values for schema and resolver runs. */
  snapshot(): T;
  /** Applies a validated error to the form state. */
  applyError(path: string, error: FieldError | undefined): void;
}

/**
 * Schema, resolver, and rule validation with error delivery for Form.
 *
 * Runs Zod-like, Valibot, and Standard Schema contracts or a custom resolver,
 * checks registration rules with firstError or all criteria modes, relays
 * messages to native DOM validity, and can delay error display.
 */
export class FormValidator<T extends FieldValues> {
  private readonly delayedErrorTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly delayedErrors = new Map<string, FieldError>();

  constructor(private readonly host: ValidatorHost<T>) {}

  /** Validates values with the resolver or schema and returns nested errors and resolver output. */
  async resolveSchemaErrors(paths?: string[]): Promise<{ errors: FieldErrors<T>; values?: T }> {
    const options = this.host.options;
    if (options.resolver) {
      const result = await options.resolver(this.host.snapshot(), options.context, {
        criteriaMode: options.criteriaMode,
        fields: Object.fromEntries(this.host.fieldOptions),
        names: paths as FieldPath<T>[] | undefined,
        shouldUseNativeValidation: options.shouldUseNativeValidation,
      });
      return { errors: result.errors, values: this.resolverResultValues(result) };
    }
    if (!options.schema) return { errors: {} };
    const schema = options.schema;
    if ('safeParseAsync' in schema) {
      const result = await schema.safeParseAsync(this.host.snapshot()) as SchemaResult<T>;
      if (result.success) return { errors: {} };
      return { errors: this.normalizeSchemaErrors(result.error) };
    }
    if ('~standard' in schema) {
      const result = await schema['~standard'].validate(this.host.snapshot());
      if ('value' in result && !result.issues) return { errors: {} };
      return { errors: this.normalizeSchemaErrors({ issues: result.issues ?? [] }) };
    }
    const result = await schema['~run']({ value: this.host.snapshot(), typed: false }, {}) as ValibotRunResult<T>;
    if (!result.issues?.length) return { errors: {} };
    return { errors: this.normalizeSchemaErrors({ issues: result.issues }) };
  }

  /** Checks registration rules for one field and returns the failing error if any. */
  async validateRules(path: string): Promise<FieldError | undefined> {
    const rules = this.host.fieldOptions.get(path);
    if (!rules) return undefined;
    const value = this.host.valueAt(path);
    const firstOnly = this.host.options.criteriaMode !== 'all';
    const failures: Array<{ type: string; message?: string }> = [];
    /** Collects a failure; in firstError mode short-circuits validation like RHF. */
    const add = (type: string, message: string | undefined): FieldError | undefined => {
      const failure = { type, ...(message !== undefined ? { message } : {}) };
      failures.push(failure);
      return firstOnly ? failure : undefined;
    };
    let stop: FieldError | undefined;
    if (rules.required && (value === undefined || value === null || value === '')) {
      stop = add('required', typeof rules.required === 'string' ? rules.required : undefined);
      if (stop) return stop;
    }
    if (rules.minLength && String(value ?? '').length < rules.minLength.value) {
      stop = add('minLength', rules.minLength.message);
      if (stop) return stop;
    }
    if (rules.maxLength && String(value ?? '').length > rules.maxLength.value) {
      stop = add('maxLength', rules.maxLength.message);
      if (stop) return stop;
    }
    if (rules.min && Number(value) < rules.min.value) {
      stop = add('min', rules.min.message);
      if (stop) return stop;
    }
    if (rules.max && Number(value) > rules.max.value) {
      stop = add('max', rules.max.message);
      if (stop) return stop;
    }
    if (rules.pattern && !rules.pattern.value.test(String(value ?? ''))) {
      stop = add('pattern', rules.pattern.message);
      if (stop) return stop;
    }
    if (rules.validate && (!firstOnly || !failures.length)) {
      let result: boolean | string;
      try {
        result = await rules.validate(value, this.host.snapshot());
      } catch {
        result = 'Validation failed';
      }
      if (result !== true) {
        stop = add('validate', typeof result === 'string' ? result : undefined);
        if (stop) return stop;
      }
    }
    if (!failures.length) return undefined;
    return {
      type: failures[0].type,
      message: failures[0].message,
      types: Object.fromEntries(failures.map((failure) => [failure.type, failure.message || true])),
    };
  }

  /** Combines schema and rule errors for a field according to the criteria mode. */
  mergeErrors(schemaError: FieldError | undefined, ruleError: FieldError | undefined): FieldError | undefined {
    if (!schemaError) return ruleError;
    if (!ruleError) return schemaError;
    if (this.host.options.criteriaMode !== 'all') return ruleError;
    return {
      ...schemaError,
      types: { ...(schemaError.types ?? { [schemaError.type]: schemaError.message || true }), ...(ruleError.types ?? { [ruleError.type]: ruleError.message || true }) },
    };
  }

  /** Delivers a validated error, respecting the delay option and native validity reporting. */
  applyValidationError(path: string, error: FieldError | undefined): void {
    const timer = this.delayedErrorTimers.get(path);
    if (timer) clearTimeout(timer);
    this.delayedErrorTimers.delete(path);
    this.applyNativeValidity(path, error);
    if (error && this.host.options.delayError && this.host.options.delayError > 0) {
      this.delayedErrors.set(path, error);
      const next = setTimeout(() => {
        this.delayedErrorTimers.delete(path);
        this.delayedErrors.delete(path);
        this.host.applyError(path, error);
      }, this.host.options.delayError);
      this.delayedErrorTimers.set(path, next);
      return;
    }
    this.delayedErrors.delete(path);
    this.host.applyError(path, error);
  }

  /** Applies a pending delayed error immediately, for example on blur. */
  flushDelayed(path: string): void {
    const timer = this.delayedErrorTimers.get(path);
    if (!timer) return;
    clearTimeout(timer);
    this.delayedErrorTimers.delete(path);
    const error = this.delayedErrors.get(path);
    this.delayedErrors.delete(path);
    if (error) this.host.applyError(path, error);
  }

  /** Drops a pending delayed error without applying it. */
  cancelDelayed(path: string): void {
    const timer = this.delayedErrorTimers.get(path);
    if (timer) clearTimeout(timer);
    this.delayedErrorTimers.delete(path);
    this.delayedErrors.delete(path);
  }

  /** Drops all pending delayed errors without applying them. */
  cancelAllDelayed(): void {
    for (const timer of this.delayedErrorTimers.values()) clearTimeout(timer);
    this.delayedErrorTimers.clear();
    this.delayedErrors.clear();
  }

  private resolverResultValues(result: ResolverResult<T>): T | undefined {
    return Object.keys(result.errors).length === 0 ? result.values as T : undefined;
  }

  private normalizeSchemaErrors(error: { issues: readonly (SchemaIssue | StandardSchemaIssue)[] }): FieldErrors<T> {
    const collectAll = this.host.options.criteriaMode === 'all';
    return error.issues.reduce<FieldErrors<T>>((errors, issue) => {
      const path = (issue.path ?? []).map((part) => String(typeof part === 'object' && 'key' in part ? part.key : part)).join('.') || 'root';
      const typedIssue = issue as SchemaIssue;
      const type = typedIssue.code ?? typedIssue.type ?? 'validation';
      const current = findErrorAtPath(errors, path);
      if (!current) {
        setAtPath(errors as Record<string, unknown>, path, collectAll
          ? { type, message: issue.message, types: { [type]: issue.message || true } }
          : { type, message: issue.message });
      } else if (collectAll) {
        // Errors at this path are created by this method, so in-place mutation is safe.
        const types = current.types ?? (current.types = {});
        types[type] = issue.message || true;
      }
      return errors;
    }, {});
  }

  private applyNativeValidity(path: string, error: FieldError | undefined): void {
    if (!this.host.options.shouldUseNativeValidation) return;
    const ref = this.host.refs.get(path)?.current as (HTMLElement & {
      setCustomValidity?: (message: string) => void;
      reportValidity?: () => boolean;
    }) | null | undefined;
    if (!ref?.setCustomValidity || !ref.reportValidity) return;
    ref.setCustomValidity(error?.message ?? '');
    ref.reportValidity();
  }
}
