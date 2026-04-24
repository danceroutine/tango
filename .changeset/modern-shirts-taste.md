---
'@danceroutine/tango-cli': patch
'@danceroutine/tango-codegen': patch
---

Make scaffolded `make:migrations` scripts forward a normal `--name` argument so migration naming works the same way across Express, Next, and Nuxt apps.
