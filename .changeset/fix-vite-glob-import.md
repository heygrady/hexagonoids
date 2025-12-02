---
'@heygrady/hexagonoids-app': patch
---

Restore extractModulePath function for proper production builds - the previous refactor broke module loading in production by removing the code that extracts bundled filenames from Vite's glob imports
