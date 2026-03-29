# Contributor documentation

Thank you for your interest in contributing to Tango. We appreciate the assistance, and want to ensure that you have an easy time working within this project.

If you are evaluating or adopting Tango for an application, start with the [Guide](/guide/) instead. The contributor pages assume monorepo context, package ownership, release workflow, and CI expectations.

## Contributor structure

Contributor docs now follow the same split as the user-facing docs:

- contributor topics for design intent and architecture boundaries
- contributor how-to guides for procedural maintainer workflows

## Read these pages first

1. [Contributor setup](/contributors/setup)
2. [Contributor topics](/contributors/topics/)
3. [Contributor how-to guides](/contributors/how-to/)
4. [Releasing packages](/contributors/releasing)
5. [Contributing guidelines](/contributing)

## Development North Star

Tango is developed with the following principles in mind. You should utilize these to guide your decision making when dealing with ambiguity or multiple potential solutions.

Principles:

1. Public contracts should be explicit.
2. Packages should be structured based on domain, not functionality.
3. Changes to behavior should travel with tests and documentation.
    - We enforce a 100% test coverage threshold to help with this. Individual exceptions to coverage are allowed, but will be vetted in PR.
4. Practicality should be preferred over dogmatism, but try to work within the established patterns for consistency.
5. Developer delight is king. We want changes to Tango to be focused on making a developer grin when they discover them.
