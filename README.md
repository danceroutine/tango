<p align="center">
  <img src="docs/public/logo.svg" alt="Tango" width="160" />
</p>

# Tango

[![npm](https://img.shields.io/npm/v/%40danceroutine%2Ftango-cli.svg)](https://www.npmjs.com/package/@danceroutine/tango-cli) [![npm downloads](https://img.shields.io/npm/dw/%40danceroutine%2Ftango-cli.svg)](https://www.npmjs.com/package/@danceroutine/tango-cli) [![CI](https://github.com/danceroutine/tango/actions/workflows/ci.yml/badge.svg)](https://github.com/danceroutine/tango/actions/workflows/ci.yml) [![License](https://img.shields.io/github/license/danceroutine/tango)](https://github.com/danceroutine/tango/blob/main/LICENSE)

Tango is a modern TypeScript web framework that brings the elegance and productivity of Django's design philosophy to the Node.js ecosystem. It encourages rapid development and clean, pragmatic design while leveraging TypeScript's powerful type system for maximum safety and developer experience.

Inspired by [Django](https://github.com/django/django) and Django REST Framework, Tango provides a batteries-included approach to building robust web applications and APIs with TypeScript. Thanks for checking it out.

_Tango is an independent project and is not affiliated with, endorsed by, or sponsored by the Django Software Foundation or the creators of Django REST Framework._

## What Tango Provides

Tango is organized around the same application concerns that shape a Django or Django REST Framework project:

- A rich TypeScript-based ORM, based on the Django ORM, manages persistence and database access, with a migrations system that enables carefree schema evolution
- A structured API toolkit, based on Django REST Framework, provides opt-in auto-magical functionalities for building your Web API in conjunction with your Tango models.
- A CLI to automate away the day-to-day boilerplate. The `tango` CLI is Tango's equivalent to Django's `manage.py`

Tango adds adapters to the mix, to connect the API and ORM layer to your favorite host framework such as Express, Next.js, and Nuxt.

Tango enhances the frameworks you are already used to with application workflows inspired by Django and is designed to work in tandem with your preferred host framework, without forcing you to migrate away from your chosen tech stack. Express, Next.js, or Nuxt continues to own routing and request lifecycle behavior, while Tango provides the application-facing layers for models, persistence, migrations, and API resources.

## Documentation

Tango's documentation is organized to help you solve problems from first principles, and will look familiar to Django developers:

- [Tutorials](https://tangowebframework.dev/tutorials/) provide step-by-step walkthroughs for building something concrete
- [How-to guides](https://tangowebframework.dev/how-to/) give you task-oriented guidance that you can compose to achieve larger goals
- [Topic guides](https://tangowebframework.dev/topics/) provide a jump-off point for the critical concepts and theory important for developing with Tango
- [Reference pages](https://tangowebframework.dev/reference/) provide technical details on the functioning and implementation of public contracts.

If you are evaluating Tango, start here:

1. [Getting started](https://tangowebframework.dev/guide/getting-started)
2. [Installation](https://tangowebframework.dev/guide/installation)
3. [Quickstart](https://tangowebframework.dev/guide/quickstart)

You can also see a tutorial for any of the supported frameworks

1. [Express Blog API tutorial](https://tangowebframework.dev/tutorials/express-blog-api)
2. [Next.js tutorial](https://tangowebframework.dev/tutorials/nextjs-blog)
3. [Nuxt tutorial](https://tangowebframework.dev/tutorials/nuxt-blog)

## Contributing

Issues and pull requests are welcome. If you'd like to contributing to Tango, start with the contributor docs:

1. [Contributor overview](https://tangowebframework.dev/contributors/)
2. [Contributor setup](https://tangowebframework.dev/contributors/setup)
3. [Releasing packages](https://tangowebframework.dev/contributors/releasing)

## License

MIT

## Author

Pedro Del Moral Lopez
