# Tango Nuxt Blog

`examples/nuxt-blog` shows Tango running inside a Nuxt 4 application through Nitro server handlers.

The same Tango primitives still drive the app:

- model metadata
- `Model.objects`
- migrations
- serializers
- viewsets and generic API views
- OpenAPI generation

## Run the example

```bash
pnpm --filter @danceroutine/tango-example-nuxt-blog bootstrap
pnpm --filter @danceroutine/tango-example-nuxt-blog dev
```

Then open:

- `http://localhost:3002/`
- `http://localhost:3002/api/posts?limit=20&offset=0`
- `http://localhost:3002/api/openapi`

## Project layout

- `nuxt.config.ts` registers the explicit Tango Nitro server handlers
- `app/pages/` contains the Nuxt SSR pages
- `server/tango/` contains Tango adapter-backed Nitro handlers
- `lib/models.ts` defines the model and explicitly registers `Model.objects` for the Nuxt/Nitro runtime
- `serializers/` defines the API-facing contract
- `viewsets/` and `views/` define resource behavior
- `scripts/bootstrap.ts` seeds the SQLite demo database
