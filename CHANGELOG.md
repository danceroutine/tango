# Changelog

This file is generated from stable release changesets during Tango stable releases. Do not edit manually.

## 1.4.0 - 2026-04-09

- Add a supported ORM transaction API centered on `transaction.atomic(async (tx) => ...)`, nested savepoints, and `tx.onCommit(...)`.

Extend schema write-hook args with a narrow transaction callback contract so hooks can register post-commit work without depending on ORM internals.

Add testing fixtures and client contract updates needed to exercise the new runtime-backed transaction workflow. Affected packages: `@danceroutine/tango-schema`, `@danceroutine/tango-orm`, `@danceroutine/tango-testing`.

## 1.3.0 - 2026-04-08

- Add typed relation hydration for Tango querysets.

Querysets can now hydrate direct single-valued relations with `selectRelated(...)` and reverse collection relations with `prefetchRelated(...)`. Relation hydration is typed from field-authored relation metadata, with `t.modelRef<TModel>(...)` providing a typed string-reference path for projects that want runtime model-key decoupling without losing TypeScript result typing.

This also moves relation-aware query planning through the SQL validation layer, adds compiler-owned prefetch SQL generation, and updates ORM result typing so selected model fields and hydrated relation properties compose correctly. Affected packages: `@danceroutine/tango-core`, `@danceroutine/tango-schema`, `@danceroutine/tango-orm`, `@danceroutine/tango-resources`, `@danceroutine/tango-codegen`, `@danceroutine/tango-migrations`, `@danceroutine/tango-testing`, `@danceroutine/tango-cli`.

## 1.2.0 - 2026-04-08

- Add decorator-owned relation resolution and field metadata APIs.

Schema now supports object-form relation decorator configs, decorator-level relation naming, resolved relation graph finalization, and the fluent `t.field(...).build()` scalar metadata builder. ORM model metadata now consumes the resolved relation graph for relation metadata and aliases. Testing adds `withGlobalTestApi` for module-loading test helpers. Migrations now load model modules through a registry-aware loader, and codegen templates emit the new fluent scalar metadata form. Affected packages: `@danceroutine/tango-schema`, `@danceroutine/tango-orm`, `@danceroutine/tango-codegen`, `@danceroutine/tango-migrations`, `@danceroutine/tango-testing`.

## 1.1.3 - 2026-04-07

- Fixed type narrowing on select() to align with database projection Affected packages: `@danceroutine/tango-orm`, `@danceroutine/tango-testing`.

## 1.1.2 - 2026-04-04

- Update package documentation to reflect docsite url changes Affected packages: `@danceroutine/tango-schema`, `@danceroutine/tango-orm`, `@danceroutine/tango-resources`, `@danceroutine/tango-openapi`, `@danceroutine/tango-migrations`, `@danceroutine/tango-adapters-next`, `@danceroutine/tango-adapters-nuxt`, `@danceroutine/tango-adapters-express`.

## 1.1.1 - 2026-04-02

- Updated package readmes to point to the new contributor documentation Affected packages: `@danceroutine/tango-core`, `@danceroutine/tango-schema`, `@danceroutine/tango-config`, `@danceroutine/tango-openapi`, `@danceroutine/tango-migrations`, `@danceroutine/tango-testing`, `@danceroutine/tango-adapters-core`, `@danceroutine/tango-adapters-next`, `@danceroutine/tango-adapters-express`.

## 1.1.0 - 2026-04-01

- Add first-class Nuxt support with a dedicated adapter package, Nuxt project scaffolding, an official Nuxt blog example, and Nuxt docs coverage. Affected packages: `@danceroutine/tango-core`, `@danceroutine/tango-codegen`, `@danceroutine/tango-cli`, `@danceroutine/tango-adapters-nuxt`.

## 1.0.2 - 2026-03-31

- Infer typed filter coercion from Tango model metadata so resource query params can be parsed into boolean, numeric, and timestamp values centrally. Affected packages: `@danceroutine/tango-resources`.
- Derive resource OpenAPI lookup fields from Tango model metadata instead of manager internals during schema description. Affected packages: `@danceroutine/tango-resources`.

## 1.0.1 - 2026-03-31

- Hoist shared HTTP method and action scope value types into adapters core so framework adapters stop re-declaring them. Affected packages: `@danceroutine/tango-adapters-core`, `@danceroutine/tango-adapters-next`.

## 1.0.0 - 2026-03-30

- Promote Tango's public packages to their first stable 1.0.0 release. Affected packages: `@danceroutine/tango-core`, `@danceroutine/tango-schema`, `@danceroutine/tango-config`, `@danceroutine/tango-orm`, `@danceroutine/tango-resources`, `@danceroutine/tango-codegen`, `@danceroutine/tango-openapi`, `@danceroutine/tango-migrations`, `@danceroutine/tango-testing`, `@danceroutine/tango-cli`, `@danceroutine/tango-adapters-core`, `@danceroutine/tango-adapters-next`, `@danceroutine/tango-adapters-express`.
