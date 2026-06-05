---
"@danceroutine/tango-codegen": patch
---

`tango new` and `tango init` now resolve target directories with platform-native path handling, so scaffolding works correctly on Windows when users pass relative paths or drive-letter paths.
