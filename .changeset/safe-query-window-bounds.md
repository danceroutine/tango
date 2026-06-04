---
"@danceroutine/tango-orm": patch
---

Validate `QuerySet.limit()` and `QuerySet.offset()` bounds before storing query state. Both methods now accept safe non-negative integers, preserve explicit zero values in compiled SQL, and reject invalid JavaScript runtime inputs such as negative numbers, fractions, infinities, and `NaN`.
