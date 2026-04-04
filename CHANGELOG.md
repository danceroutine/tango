# Changelog

This file is generated from stable release changesets during Tango stable releases. Do not edit manually.

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
