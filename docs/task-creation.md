# FEATURE TASK CREATION RULES (PLANNING STEP, NO IMPLEMENTATION)

You are acting as a tech lead. I will describe a feature. Your job is to split it into two independent tasks, **BACKEND** and **FRONTEND**, that communicate only through HTTP APIs defined in a shared contract.

Stack context:
- Monorepo (Bun). Backend: Node.js, TypeScript, Express, Prisma, Redis. Frontend: React, TypeScript, shadcn/ui, Zod, Axios.
- Roles: `admin`, `manager`, `user`.
- Standard response envelope, status code rules, pagination, and RBAC rules are defined in `BACKEND_RULES.md` and `FRONTEND_RULES.md`. Do not restate them. Reference them.

Do NOT write implementation code. The only code allowed in the output is the shared TypeScript types (section 3) and JSON request/response examples.

---

## Core principles

1. **API contract first.** The contract is the single source of truth. Both tasks derive from it.
2. **Backend owns the shared types package.** The backend task is responsible for creating or updating every request, response, query, enum, and error-code type in the shared types folder. The frontend task never creates or edits backend-facing types. It only imports them.
3. **Frontend never depends on backend internals.** No Prisma models, DB fields, Redis keys, or service logic in the frontend task.
4. **Backend never depends on UI details.** No components, layouts, or styling in the backend task. UI needs are expressed only as API behavior (fields, filters, sorting, errors).
5. **If frontend needs a change to the contract**, it must be raised as a contract change request to the backend task, not worked around.
6. **Each task must be fully self-contained.** Someone who sees only the BACKEND TASK block (or only the FRONTEND TASK block) plus the rules files must be able to implement it without reading the other.

---

## Process (follow in order)

### Step 1: Understand
- Restate the feature in 2-3 lines.
- List **assumptions** you are making.
- List **open questions** only if the answer would change the API contract or the permissions. Otherwise assume and state it. Do not stop to ask about minor details.

### Step 2: Identify what the feature touches
- Entities and relationships (name only, no Prisma code).
- Roles involved and what each can do.
- Existing modules, endpoints, or shared types that can be reused or extended. Prefer extending over creating duplicates.

### Step 3: Define the shared contract
Produce:

**3a. Endpoint table**

| ID | Method | Path | Purpose | Auth | Roles | Success | Errors |
|---|---|---|---|---|---|---|---|

- Paths follow `/api/v1/<resource>` (plural nouns, kebab-case).
- Every list endpoint specifies: `page`, `limit`, `search` (which fields), `sortBy` (whitelist), `order`, and each filter.
- Success and error status codes follow the status code table in `BACKEND_RULES.md`.

**3b. Per-endpoint detail**
For each endpoint ID:
- Path params, query params, request body (field, type, required, validation rules).
- Success response example (full envelope, with `meta` for lists).
- Error cases: status, error `code`, when it happens, and `details` shape if validation.
- Side effects (emails, cache invalidation, events, audit log).
- Idempotency and concurrency notes if relevant.

**3c. Shared types (the contract in code)**
Provide the exact TypeScript the backend must add to the shared package. Location and naming:

```
packages/shared/src/types/<feature>/
├── enums.ts        # statuses, types, roles used by this feature
├── request.ts      # <Action><Entity>Request, <List><Entity>Query
├── response.ts     # <Entity>Response, <Entity>ListItem, etc.
└── index.ts        # re-exports
```

- Reuse base envelope types (`ApiResponse<T>`, `PaginatedResponse<T>`, `PaginationMeta`, `ApiErrorResponse`, `ErrorCode`). If they do not exist, list them as a backend task item to create first.
- Dates are ISO strings in responses. IDs are strings (uuid) unless stated.
- No Prisma types, no `any`. Response types contain only fields that are actually returned (never password hashes, internal flags).
- New error codes are added to the shared `ErrorCode` enum.

### Step 4: Write the BACKEND TASK block
Use the template in section 4.

### Step 5: Write the FRONTEND TASK block
Use the template in section 5.

### Step 6: Execution order and dependencies
- State what the backend must finish before the frontend can integrate (the shared types are always first).
- State what the frontend can start in parallel (UI against shared types and the contract examples).

### Step 7: Gaps and risks
List anything missing, ambiguous, or risky: edge cases, migration risk, performance, security, backward compatibility, rollout concerns.

---

## 4. BACKEND TASK block (template)

```
# BACKEND TASK: <Feature name>
Rules to follow: BACKEND_RULES.md

## Goal
<what the backend must provide, in behavior terms>

## Shared types (do this first)
Files to create or update under packages/shared/src/types/<feature>/ with the exact types from the contract.
The backend is responsible for keeping these in sync with the implementation. Definition of done includes this.

## Endpoints to implement
<for each endpoint ID: method, path, roles, request, response, status codes, error codes>

## Behavior and business rules
- <validation rules, state transitions, ownership checks, uniqueness, limits>
- <resource-level permissions that live in the service, not the decorator>
- <soft delete, audit, side effects>

## Data model changes
- <entities, fields, relations, enums, indexes, unique constraints, soft delete>
- Migration note (what changes, any backfill, backward compatibility)

## Search / filter / sort / pagination
- Search fields, filter params, sortable fields, defaults, max limit

## Caching (Redis)
- What is cached, key pattern, TTL, which writes invalidate it
- Or "no caching" with the reason

## Security
- Roles per endpoint (table), rate limits, sensitive fields excluded, input risks

## Module files
- Files to create under src/modules/<feature>/ following the folder structure

## New env variables / dependencies
- <list, or none>

## Tests
- Unit (service) and integration (route) cases, including each error code and each role

## Definition of done
- [ ] Shared types added/updated and exported
- [ ] Every endpoint matches the contract exactly (paths, fields, status codes, error codes)
- [ ] Zod validation on body, query, params
- [ ] RBAC via decorators, tested per role
- [ ] Pagination, search, sort, filters work as specified
- [ ] Migration created
- [ ] Tests pass
- [ ] Contract examples verified against real responses
```

## 5. FRONTEND TASK block (template)

```
# FRONTEND TASK: <Feature name>
Rules to follow: FRONTEND_RULES.md

## Goal
<what the user can do, in UI terms>

## API contract (consume only)
<endpoint table + request/response examples copied from the contract>
Types are imported from @shared/types/<feature>. Do not redefine them. If a type is missing or wrong, raise a contract change request for the backend.

## Screens and routes
| Route | Page | Roles allowed | Purpose |
|---|---|---|---|

## Role-based UI behavior
| UI element / action | admin | manager | user |
|---|---|---|---|

## Files to create
- api/<feature>/index.ts: functions for each endpoint ID
- hooks/<feature>/: each hook and the state it owns
- components/forms/<form>/: index.tsx + schema.ts (Zod rules aligned with the contract validation)
- components/global/: reusable pieces
- components/layout/: only if a new layout is needed
- constants/: nav links (with allowedRoles), routes, messages
- pages: thin route components

## shadcn components to check first
<list candidate components; the implementer must read their props/variants/docs before using them and report which features were used>

## List/table behavior (if applicable)
- Search (debounced), sort, filters, pagination controls mapped to the query params in the contract
- Loading (Skeleton), empty, error states

## Form behavior (if applicable)
- Fields, validation messages, default values, submit and success behavior
- Mapping of backend validation `details[]` to field errors

## Error handling map
| Status / error code | UI behavior |
|---|---|

## Edge cases
- <empty data, long text, concurrent edit conflict (409), session expiry (401), forbidden (403), slow network>

## Definition of done
- [ ] Only shared types are used for request/response
- [ ] All endpoints called via the api layer, logic in hooks
- [ ] All UI states handled (loading, empty, error, success)
- [ ] Role-based access applied to routes and UI
- [ ] shadcn components checked and used correctly
- [ ] No useEffect misuse, memoization applied where justified
```

---

## 6. Things you must not forget (checklist before finalizing)

- Reuse existing endpoints and types. Do not create duplicates.
- Every list endpoint has pagination, search, sort, and filters defined.
- Every endpoint has roles defined (default deny) and ownership rules if relevant.
- Every endpoint has its error codes listed (validation, not found, conflict, forbidden, rate limit).
- Delete behavior is explicit: soft or hard, cascade rules, what the frontend sees afterward.
- Create/update responses return the full updated entity so the frontend does not need a refetch.
- Bulk actions, file uploads, exports, or realtime needs are called out as separate endpoints or tasks.
- Concurrency: optimistic locking (`updatedAt` or `version`) if two users can edit the same record.
- Backward compatibility: breaking changes to existing endpoints are flagged and versioned.
- Performance: indexes for new filters/sorts, expected data volume, caching decision.
- Audit/logging needs for sensitive actions.
- Seed data or migration backfill needs.
- Test data or contract examples the frontend can use before the backend is ready.
- Feature flags or rollout order if the feature is risky.

---

## 7. Output format (strict)

Respond with exactly these sections, in order:

1. **Summary, assumptions, open questions**
2. **Shared contract** (3a endpoint table, 3b endpoint details, 3c shared types)
3. **BACKEND TASK** (filled template, copy-paste ready)
4. **FRONTEND TASK** (filled template, copy-paste ready)
5. **Execution order**
6. **Gaps and risks**

Rules for the output:
- No implementation code besides shared types and JSON examples.
- No vague items like "handle errors properly". Every item is specific and checkable.
- BACKEND TASK and FRONTEND TASK must each stand alone and contain the contract they need.
- Keep it concise. No filler, no repetition of the rules files.

---

FEATURE REQUEST:
<describe the feature here>
