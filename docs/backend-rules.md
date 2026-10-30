# BACKEND ENGINEERING RULES (MANDATORY FOR EVERY TASK)

Stack: Node.js, TypeScript, Express, Prisma (PostgreSQL/MySQL), Redis.
Follow every rule below in all generated code. If a request conflicts with a rule, point out the conflict and follow the rule unless I explicitly override it.

## 1. Architecture and folder structure

Use modular, feature-based Clean Architecture. Dependencies point inward only:
route -> controller -> service -> repository -> Prisma. No layer skips another.

```
src/
├── app.ts                      # Express app setup (middlewares, routes, error handler)
├── server.ts                   # Server bootstrap, graceful shutdown
├── config/                     # env validation (zod), constants, redis/prisma clients
│   ├── env.ts
│   ├── prisma.ts
│   └── redis.ts
├── core/                       # Framework-level code shared by all modules
│   ├── decorators/             # @Controller, @Get, @Post, @Authorize, @Validate, @Cache
│   ├── errors/                 # AppError, NotFoundError, ValidationError, etc.
│   ├── middlewares/            # auth, rbac, error-handler, rate-limit, request-id
│   ├── utils/                  # asyncHandler, pagination, response helpers, logger
│   └── types/                  # shared types, enums (Role, Permission)
├── modules/
│   └── <feature>/              # e.g. users, products, orders
│       ├── <feature>.controller.ts   # HTTP only: parse request, call service, send response
│       ├── <feature>.routes.ts       # route registration
│       ├── <feature>.service.ts      # business logic, caching, transactions
│       ├── <feature>.repository.ts   # ALL Prisma queries live here
│       ├── <feature>.schema.ts       # zod schemas (body, query, params)
│       ├── <feature>.dto.ts          # request/response types
│       └── <feature>.test.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
└── routes/index.ts             # mounts all module routers under /api/v1
```

Rules:
- Controller: no business logic, no Prisma calls.
- Service: no `req`/`res`, no Express types.
- Repository: only layer allowed to import Prisma client.
- One module = one folder. Modules never import another module's repository; they call its service.
- Use dependency injection via constructor (or a simple container) so services are testable.

## 2. API design

- Base path: `/api/v1/<resource>` (plural nouns, kebab-case, no verbs).
- Standard REST: GET list, GET `/:id`, POST, PUT (full replace), PATCH (partial), DELETE.
- **Validate every input with Zod**: `body`, `query`, `params`. Never trust `req.*` directly. Validated and typed data only is passed to services.
- **Params**: `/:id` validated as uuid/int. Reject invalid format with 400.
- **List endpoints must support:**
  - Pagination: `page` (default 1), `limit` (default 10, max 100)
  - Search: `search` (case-insensitive, over defined searchable fields only)
  - Sorting: `sortBy` (whitelisted fields only), `order` (`asc`|`desc`)
  - Filters: explicit whitelisted query params (e.g. `status`, `role`, `createdFrom`, `createdTo`)
  - Optional field selection/`include` only from a whitelist
- Pagination helper lives in `core/utils/pagination.ts` and is reused everywhere. Use offset pagination by default, cursor pagination for large or infinite-scroll datasets.
- **Response envelope (always):**
```json
// success
{ "success": true, "message": "Users fetched", "data": [...],
  "meta": { "page": 1, "limit": 10, "total": 95, "totalPages": 10, "hasNext": true, "hasPrev": false } }

// error
{ "success": false, "message": "Validation failed",
  "error": { "code": "VALIDATION_ERROR", "details": [{ "field": "email", "message": "Invalid email" }] } }
```
- Never return password hashes, tokens, or internal fields. Map to response DTOs or use Prisma `select`.
- Use soft delete (`deletedAt`) where data must be recoverable; filter it in repositories by default.

## 3. RBAC with decorators

- Enable `experimentalDecorators` and `emitDecoratorMetadata`; use `reflect-metadata`.
- Provide these decorators in `core/decorators/`:
  - `@Controller('/users')`: base path
  - `@Get('/')`, `@Post('/')`, `@Patch('/:id')`, `@Delete('/:id')`: route + method
  - `@Authorize(Role.ADMIN, Role.MANAGER)`: role-based access
  - `@Permissions(Permission.USER_DELETE)`: permission-based access (optional, finer grain)
  - `@Public()`: skips auth (everything is protected by default)
  - `@Validate({ body, query, params })`: Zod validation
  - `@Cache({ ttl: 60, key: ... })`: optional Redis response caching
- Decorators only attach metadata. A single route-registrar reads the metadata and builds the middleware chain in this order:
  `rateLimit -> authenticate -> authorize/permissions -> validate -> asyncHandler(handler)`.
- Default deny: a route without `@Public()` requires a valid JWT. A route without `@Authorize` requires authentication only.
- Roles and permissions are enums in `core/types`, never magic strings.
- Resource-level checks (e.g. "user can edit only their own record") go in the service, not the decorator.
- Example:
```ts
@Controller('/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/')
  @Authorize(Role.ADMIN, Role.MANAGER)
  @Validate({ query: listUsersQuerySchema })
  async list(req: Request, res: Response) {
    const result = await this.userService.list(req.query as ListUsersQuery);
    return sendSuccess(res, 200, 'Users fetched', result.data, result.meta);
  }
}
```

## 4. Async/await and error handling

- Always `async/await`. No `.then()` chains, no callbacks, no unhandled promises.
- Wrap every route handler in `asyncHandler` (or have the decorator system do it) so errors reach the global error handler. Do NOT write try/catch in every controller.
- Use try/catch only where there is something to do: transform a Prisma/Redis error into an AppError, clean up resources, or handle a non-critical failure (e.g. cache failure falls back to DB).
- Never swallow errors. Never `catch (e) {}` or `catch (e) { console.log(e) }` alone. Rethrow or convert.
- Use custom error classes extending `AppError(message, statusCode, code, details?)`:
  `BadRequestError, ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, TooManyRequestsError, InternalError`.
- One global error-handler middleware: maps `AppError`, `ZodError`, `Prisma.PrismaClientKnownRequestError`, `JsonWebTokenError` to the standard error envelope. Unknown errors become 500 with a generic message (never leak stack traces in production).
- Prisma error mapping: `P2002` -> 409 Conflict, `P2025` -> 404 Not Found, `P2003` -> 400/409 (FK violation), others -> 500.
- Handle `unhandledRejection` and `uncaughtException`: log, then graceful shutdown.
- Use `Promise.all` for independent async calls; never `await` inside loops when calls are independent.
- Use `prisma.$transaction` for any multi-write operation.

## 5. HTTP status codes (strict)

| Case | Code |
|---|---|
| GET/PUT/PATCH success | 200 |
| POST created a resource | 201 (+ `Location` header when applicable) |
| DELETE success / no body returned | 204 (or 200 with body if the envelope is needed) |
| Malformed request, validation failure | 400 |
| Missing/invalid/expired token | 401 |
| Authenticated but lacks role/permission | 403 |
| Resource not found | 404 |
| Method not allowed | 405 |
| Duplicate / state conflict (unique violation) | 409 |
| Semantic validation failure (optional) | 422 |
| Rate limit exceeded | 429 (+ `Retry-After`) |
| Unexpected server error | 500 |
| Dependency down (DB/Redis/upstream) | 503 |

Never return 200 with an error body. Never use 500 for client mistakes. Use 401 vs 403 correctly.

## 6. Prisma rules

- Single shared PrismaClient instance (`config/prisma.ts`).
- Use `select` to return only the needed fields; avoid unbounded `include`.
- Avoid N+1: use `include`/`select` relations or batched `findMany({ where: { id: { in } } })`.
- Every `findMany` has `take`/`skip` (no unbounded queries).
- Run `count` and `findMany` together in `$transaction([...])` or `Promise.all` for pagination.
- Search: `contains` + `mode: 'insensitive'` with `OR` over whitelisted fields. Add DB indexes for filtered, sorted, and searched columns (`@@index`).
- Use migrations (`prisma migrate`), never `db push` in production. Use enums, `@unique`, `@@index`, `createdAt`, `updatedAt` on all models.
- Money uses `Decimal`, never `Float`.

## 7. Redis rules

- Use Redis for: caching, rate limiting, token blacklist/refresh tokens, sessions, and short-lived locks.
- Key naming: `app:<module>:<entity>:<id|hash>` (e.g. `app:users:list:{hash(query)}`).
- Every key has a TTL. No permanent cache keys.
- Cache-aside pattern in the **service** layer: check cache -> miss -> repository -> set cache.
- Invalidate on write (create/update/delete) using key patterns or tag sets. Use `SCAN`, never `KEYS`, in production.
- Redis failure must NOT crash the request: log it and fall back to the DB (except for rate limiting/auth where policy dictates).
- Serialize with JSON; keep cached payloads small.

## 8. Security

- `helmet`, `cors` (explicit origin whitelist), `express-rate-limit` (Redis store), body size limits, `hpp`.
- Passwords hashed with bcrypt/argon2. JWT access token (short-lived) + refresh token (rotated, stored/blacklisted in Redis).
- All secrets from env, validated at startup with Zod (fail fast). No secrets in code or logs.
- Prevent mass assignment: never pass `req.body` directly to Prisma. Use validated DTOs.
- Sanitize and validate all input. Never build raw SQL from user input (use `$queryRaw` with tagged templates only).

## 9. Code quality standards

- TypeScript `strict: true`. No `any` (use `unknown` + narrowing). Explicit return types on service/repository methods.
- Naming: files `kebab-case`, classes `PascalCase`, variables/functions `camelCase`, constants `UPPER_SNAKE_CASE`, enums `PascalCase`.
- Functions do one thing, small, no deep nesting (early returns).
- No hardcoded values: use constants/enums/env.
- No `console.log`: use a structured logger (pino/winston) with request-id correlation. Log levels used correctly. Never log sensitive data.
- DRY: reuse pagination, response, error, and validation utilities.
- Comment the "why", not the "what". JSDoc on public service methods.
- ESLint + Prettier compliant.
- Graceful shutdown: close HTTP server, Prisma, and Redis on SIGTERM/SIGINT.
- Health endpoints: `GET /health` (liveness) and `GET /ready` (DB + Redis check).
- API docs with Swagger/OpenAPI, generated from Zod schemas where possible.
- Write unit tests for services (mock repositories) and integration tests for routes (supertest).

## 10. Output requirements for every task

When I ask for a feature, deliver:
1. The full file list with paths following the structure above.
2. Complete code for each file (no placeholders, no "...rest of code").
3. The Zod schemas, Prisma model changes, and migration note if the schema changed.
4. The RBAC roles/permissions applied per endpoint (as a small table).
5. Any new env variables.
6. Example request/response for each endpoint.
Do not add libraries or patterns outside this stack without stating why. Do not skip validation, error handling, pagination, or RBAC to keep the answer short.
