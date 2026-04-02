# Writing documentation

Tango's documentation is maintained via [VitePress](https://vitepress.dev) markdown files in the same repository as the framework itself.

## Documentation organization

Documentation in Tango is intentionally organized to rhyme with Django's overall documentation structure. This is due to Tango intentionally trying to remain intuitive and familiar to lifelong Django developers.

- **Tutorials** must provide step-by-step guidance for an entirely new developer to create something meaningful and useful, starting from first principles and building to a complete delivery.
    - Tutorials do not need to teach the underlying concepts for Tango capabilities, only teach the developer how to _use_ them.
- **Topics** in turn aim to explain the theory or design behind aspects of Tango's capabilities or system design.
    - The goal of a topic page is to help a developer understand the _why_ behind the decisions in Tango's design.
- **Reference guides** must provide the applied knowledge that complements topic guides. They must explain the _what_ and _how_ of Tango's implementation.
- Finally, **How-To guides** are the more advanced and focused sibling of tutorials. They provide step-by-step guides for accomplishing specific tasks in Tango, while assuming the developer is already familiar with Tango and can move more quickly through the task.

## Writing your first doc changes

Start by following the [setup](/contributors/setup) guide to get your local environment working.

Once you have the local environment working, you can view the local docs by running

```sh
pnpm docs:dev
```

and opening `http://localhost:5173`.

At this point, any changes to the markdown files will automatically be reflected in the browser through hot module reloading in VitePress.

Once you have finished editing the docs, build the docs to ensure your changes will result in a successful build:

```sh
pnpm docs:build
```

Upon successful completion, you can commit your changes following the version control steps in the [Contributing Code](/contributors/contributing-code) article and create a PR for review.

## When document changes require a Tango release

Changes under `docs/` update the Tango documentation site and usually do not require a changeset on their own.

Package `README.md` files have a different publication path. They are shipped with the package on npm, so changes to a published package README need a package release before the npm package page will reflect the new content.

If your documentation change touches a package `README.md`, add a changeset for that package even when the code is unchanged. In most cases, that means a patch changeset so the package is republished and the npm package page picks up the updated README. You can learn more about starting a release on the [Releasing](/contributors/releasing) article.
