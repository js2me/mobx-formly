# Getting started

## Installation

MobX is a required peer dependency. Zod and Valibot are optional peer dependencies;
install either one when you need schema validation.

## Create a form

Create a form with initial values, validation mode, and an optional schema. The
createForm helper can infer the form value type from the supplied schema, including
valid field paths and value types. Without a schema, provide the form value type
explicitly when constructing a Form.

## Register fields

Registering a field provides its name, a ref, and change and blur handlers. The handlers
work with UI events and update the corresponding value and field state.

Values may also be updated directly. An update can mark a field dirty or touched and can
request immediate validation.

## Submit

Submitting validates the form before calling the valid or invalid handler. The valid
handler receives a plain snapshot of the current values, while the invalid handler
receives field errors. The invalid handler is optional.

## Reset and direct mutations

Reset restores the current default values. Passing new values replaces the form values
and, by default, makes them the new defaults. Reset options can preserve selected state,
including dirty fields, touched fields, errors, submission status, and submit count.

For several related value changes, mutate groups them into one form update and can run
validation for the changed fields afterward.

## MobX consumers

Read observable form properties from an autorun, a MobX reaction, or a UI adapter.
