---
name: OpenAPI response schema names
description: Avoid duplicate exports when Orval generates operation response types and Zod schemas.
---

When adding a response schema for an OpenAPI operation, give the component schema a distinct name from the operation-generated response name. For example, `listGenaiProjectSubmissions` generates a `ListGenaiProjectSubmissionsResponse` export, so the referenced component schema should not also be named `ListGenaiProjectSubmissionsResponse`.

**Why:** Orval can emit the operation response schema in `generated/api.ts` and a matching model interface in `generated/types`, causing duplicate exports from the package barrel and breaking library typechecks.

**How to apply:** After changing OpenAPI, run codegen and the library typecheck. If TypeScript reports duplicate exports, rename the component schema while keeping the API response shape and operation ID unchanged.
