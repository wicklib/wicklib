---
"@wicklib/core": patch
---

Render synchronously after ResizeObserver-driven canvas resizes so cleared backing stores are
never painted before the deferred repaint during continuous panel resizing.
