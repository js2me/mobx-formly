---
"mobx-formly": minor
---

Add advanced validation support: `onTouched`, `criteriaMode: 'all'`, custom resolvers with context, delayed errors, native validity reporting, and Standard Schema validation.

Also fixes field state updates for paths that were never registered (for example schema issues mapped to `root`): the first state creation mutated a disconnected object, so `fieldState` changes were dropped until a later update touched the same path.
