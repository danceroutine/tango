---
'@danceroutine/tango-resources': patch
---

Fix resource list pagination so offset-paginated `count` reflects the full filtered queryset instead of the current page slice.
