# mobx-formly

[![NPM version](https://img.shields.io/npm/v/mobx-formly.svg)](https://npmjs.org/package/mobx-formly)
[![Build status](https://github.com/js2me/mobx-formly/actions/workflows/main.yml/badge.svg)](https://github.com/js2me/mobx-formly/actions/workflows/main.yml)
[![Documentation](https://img.shields.io/badge/docs-online-blue)](https://js2me.github.io/mobx-formly/)

Observable, framework-agnostic forms for MobX 6. No React dependency and no hooks required. Supports Zod and Valibot schemas, async validation, nested paths, and granular field state.

## Documentation

[Read the documentation →](https://js2me.github.io/mobx-formly/)

## Installation

Install mobx-formly together with MobX. Zod and Valibot are optional peer dependencies
for schema-based validation.

## How it works

Create a form controller with initial values and, optionally, a Zod or Valibot schema.
Register fields with your UI layer, observe their values and state, then submit through
the controller. The controller exposes field-level errors and status as well as aggregate
form state.

## Features

- Stable, granular `fieldState[name]` branches.
- Zod validation, including async refinements.
- Valibot schema support alongside Zod.
- Field rules such as `required`, `minLength`, `pattern`, and async `validate`.
- Nested object and array paths such as `profile.email` and `items.0.name`.
- Direct observable mutations through `mutate()` with dirty-path detection.
- Framework agnostic: usable with React, Vue, Solid, or plain TypeScript.

## License

[MIT](https://github.com/js2me/mobx-formly/blob/main/LICENSE)
