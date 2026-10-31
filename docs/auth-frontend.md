# Authentication frontend

The app follows `docs/frontend-rules.md`; the supplied `app/doc/frontend-rules.md`
path does not exist. This is the existing Vite app, so routes live under
`apps/web/src/pages`. The rules require `src/api` for Axios calls, which takes
precedence over the request's fallback `core` folder. Components call hooks;
API functions contain only HTTP calls and return DTOs from `@odoo/shared`.

## Run and verify

```sh
bun run redis:up
bun run dev
```

Open [login](http://localhost:3000/login), [signup](http://localhost:3000/signup),
[password recovery](http://localhost:3000/forgot-password), or
[dashboard](http://localhost:3000/dashboard). The configured admin is seeded;
credentials stay in `apps/core/.env`, which is ignored by Git.

```sh
bun run typecheck
bun run lint
bun run build
bun run test
```

With core and Vite running, from `apps/web` run `bun run test:e2e`. Playwright
uses the locally installed Chrome. Four UI flows plus the concurrent refresh
case cover validation, mobile cover hiding, signup, wrong OTP, countdown,
verification, reset-token recovery, and protected routes. The admin case uses
real PostgreSQL and Docker Redis to verify login, refresh cookies, reload
restoration and logout. Email actions in automated tests are mocked.

## Packages and shadcn

The official login-02 block was installed and adapted into `AuthLayout` and the
form folders, retaining its two-column cover layout. The current base-nova
registry did not supply the legacy Form wrapper, so the official new-york-v4
Form registry item was installed to satisfy the rules' Form requirement.
Existing primitives were inspected and reused. Label and Separator source files
retain their original contents after discarding CLI-only directive changes.

Commands used:

```sh
bun add axios react-hook-form @hookform/resolvers zod react-toastify react-router-dom
bunx shadcn@latest add login-02 form --yes --overwrite
bunx shadcn@latest add https://ui.shadcn.com/r/styles/new-york-v4/form.json --yes --overwrite
bun add react-error-boundary
bun add -d @playwright/test
```

Added runtime dependencies:

- `axios ^1.21.0`
- `react-hook-form ^7.91.0`
- `@hookform/resolvers ^6.0.2`
- `zod ^4.6.7`
- `react-toastify ^11.2.0`
- `react-router-dom ^7.18.5`
- `radix-ui ^1.8.1`
- `react-error-boundary ^6.1.6`

Development dependency: `@playwright/test ^1.64.1`.
React Router handles Vite routes; react-error-boundary supplies render recovery
without application class components. radix-ui is a dependency of the official
shadcn Form wrapper. Playwright is test-only.

| shadcn component | Features used |
| --- | --- |
| Form, FormField, FormItem, FormLabel, FormControl, FormMessage | RHF context, controlled fields, linked labels and field errors |
| Input | Typed email/password inputs, autocomplete, aria-invalid and disabled state |
| InputOTP, InputOTPGroup, InputOTPSlot | Six controlled numeric slots, paste, one-time-code autocomplete |
| Button | Submit, outline and link variants, sizes, disabled/busy states |
| Spinner | Pending API actions and initial loading |
| Skeleton | Initial session loading |
| Alert | Connection errors, render failures and restricted access |
| Badge, Card, Empty | Role, account overview and meaningful empty workspace |
| Tooltip | Existing root provider retained |

## Session and API behavior

Access tokens and reset grants stay in memory. Refresh tokens stay in a persistent
httpOnly cookie managed by core. No token is stored in localStorage. One Axios
instance attaches the access token; an isolated transport rotates refresh cookies.
Initial restoration and concurrent protected-request 401s share one refresh
promise. Each request retries once. Failed refresh clears auth; network failures
show an actionable retry state. Logout waits for in-flight refresh before
revoking the current session.

ToastContainer is mounted once in App. Manual API actions show success/error
toasts. Initial session restoration and automatic refresh stay quiet. API field
details are mapped to RHF setError; validation uses FormMessage. Submit buttons
and inputs are disabled during calls, with spinners and a synchronous double-submit
guard. Recovery steps use a discriminated union; unmounting clears the reset grant.

`NEXT_PUBLIC_API_URL` is configured in `apps/web/.env` and exposed through Vite's
public env prefix. Empty uses the existing `/api` proxy to core on port 3001.
For a separate deployment, set it to the API origin, e.g. `https://api.example.com`,
and configure core's CORS allowlist to match the frontend origin. Only the web
folder's public environment settings are bundled; core credentials are never
imported into application code.

## Validation and hooks

Shared backend DTOs are imported from `@odoo/shared`: RegisterDto,
RegisterResultDto, LoginDto, VerifyOtpDto, VerifyResetOtpResultDto,
ForgotPasswordDto, ResetPasswordDto, AuthResult, UserDto, ApiResponse and Role.
Each form folder owns its Zod schema and inferred form type. Password rules match
core: at least eight characters, one letter, one number and at most 72 UTF-8 bytes.
Signup persists username and uses it as the initial display name.

| Hook | State and behavior |
| --- | --- |
| useAuth | Typed context access and hasRole |
| useApiAction | Loading, error, toast, field errors, double-submit lock |
| useLogin / useSignup | API action and navigation; unverified login opens OTP verification |
| useOtp / useCountdown | Verification, resend, server retry delay and wall-clock countdown |
| usePasswordRecovery | Email → OTP → reset grant state |
| useForgotPassword / useResetPassword | Recovery actions and completion navigation |
| useVerificationEmail | Validates signup route state |
| useLogout | Pending signout and navigation |

## RBAC

| Route or section | Access |
| --- | --- |
| /login, /signup, /verify-otp, /forgot-password | Signed-out visitors; authenticated visitors redirect to dashboard |
| /dashboard and account overview | USER, MANAGER, ADMIN |
| Team workspace card | MANAGER, ADMIN |
| Unknown route | Not-found state |

Backend session and role checks remain authoritative. The UI waits for initial
session restoration before redirecting.

## Migration and configuration changes

The generated and applied migration is
`apps/core/migrations/app/20261031T0007_auth_foundation/`. It creates User, Session,
and the existing Post model, including unique username/email/token constraints.
`prisma db verify` confirms the live schema and marker match the contract.
Prisma's installed driver rejected the pooled Neon URL's startup settings. The
verified direct endpoint is now used; credentials were preserved. See
[Neon connection guidance](https://neon.com/docs/connect/connection-errors#unsupported-startup-parameter).
The short OTP HMAC secret was replaced locally with a cryptographically random
key. The configured admin password was preserved and validation aligned with
the app's eight-character minimum.

New backend route: POST `/api/v1/auth/verify-reset-otp`, body `{email, otp}`,
result `{resetToken, expiresInSeconds}`. POST `/api/v1/auth/reset-password` accepts
that single-use grant plus email, password and confirmPassword. The combined OTP
reset request is still supported. Redis grants expire after five minutes.

## Files created

- [apps/web/.env.example](S:/learn-tree/odoo/apps/web/.env.example)
- [apps/web/e2e/auth.spec.ts](S:/learn-tree/odoo/apps/web/e2e/auth.spec.ts)
- [apps/web/playwright.config.ts](S:/learn-tree/odoo/apps/web/playwright.config.ts)
- [apps/web/src/api/auth/index.ts](S:/learn-tree/odoo/apps/web/src/api/auth/index.ts)
- [apps/web/src/api/client.ts](S:/learn-tree/odoo/apps/web/src/api/client.ts)
- [apps/web/src/api/session.ts](S:/learn-tree/odoo/apps/web/src/api/session.ts)
- [apps/web/src/components/forms/forgot-password/index.tsx](S:/learn-tree/odoo/apps/web/src/components/forms/forgot-password/index.tsx)
- [apps/web/src/components/forms/forgot-password/schema.ts](S:/learn-tree/odoo/apps/web/src/components/forms/forgot-password/schema.ts)
- [apps/web/src/components/forms/login/index.tsx](S:/learn-tree/odoo/apps/web/src/components/forms/login/index.tsx)
- [apps/web/src/components/forms/login/schema.ts](S:/learn-tree/odoo/apps/web/src/components/forms/login/schema.ts)
- [apps/web/src/components/forms/otp/index.tsx](S:/learn-tree/odoo/apps/web/src/components/forms/otp/index.tsx)
- [apps/web/src/components/forms/otp/schema.ts](S:/learn-tree/odoo/apps/web/src/components/forms/otp/schema.ts)
- [apps/web/src/components/forms/reset-password/index.tsx](S:/learn-tree/odoo/apps/web/src/components/forms/reset-password/index.tsx)
- [apps/web/src/components/forms/reset-password/schema.ts](S:/learn-tree/odoo/apps/web/src/components/forms/reset-password/schema.ts)
- [apps/web/src/components/forms/signup/index.tsx](S:/learn-tree/odoo/apps/web/src/components/forms/signup/index.tsx)
- [apps/web/src/components/forms/signup/schema.ts](S:/learn-tree/odoo/apps/web/src/components/forms/signup/schema.ts)
- [apps/web/src/components/global/dashboard-welcome/index.tsx](S:/learn-tree/odoo/apps/web/src/components/global/dashboard-welcome/index.tsx)
- [apps/web/src/components/global/error-fallback/index.tsx](S:/learn-tree/odoo/apps/web/src/components/global/error-fallback/index.tsx)
- [apps/web/src/components/global/form-heading/index.tsx](S:/learn-tree/odoo/apps/web/src/components/global/form-heading/index.tsx)
- [apps/web/src/components/global/page-loading/index.tsx](S:/learn-tree/odoo/apps/web/src/components/global/page-loading/index.tsx)
- [apps/web/src/components/global/password-recovery/index.tsx](S:/learn-tree/odoo/apps/web/src/components/global/password-recovery/index.tsx)
- [apps/web/src/components/global/protected-route/index.tsx](S:/learn-tree/odoo/apps/web/src/components/global/protected-route/index.tsx)
- [apps/web/src/components/global/role-guard/index.tsx](S:/learn-tree/odoo/apps/web/src/components/global/role-guard/index.tsx)
- [apps/web/src/components/global/session-error/index.tsx](S:/learn-tree/odoo/apps/web/src/components/global/session-error/index.tsx)
- [apps/web/src/components/global/submit-button/index.tsx](S:/learn-tree/odoo/apps/web/src/components/global/submit-button/index.tsx)
- [apps/web/src/components/global/text-form-field/index.tsx](S:/learn-tree/odoo/apps/web/src/components/global/text-form-field/index.tsx)
- [apps/web/src/components/layout/auth/index.tsx](S:/learn-tree/odoo/apps/web/src/components/layout/auth/index.tsx)
- [apps/web/src/components/layout/dashboard/index.tsx](S:/learn-tree/odoo/apps/web/src/components/layout/dashboard/index.tsx)
- [apps/web/src/components/ui/form.tsx](S:/learn-tree/odoo/apps/web/src/components/ui/form.tsx)
- [apps/web/src/constants/config.ts](S:/learn-tree/odoo/apps/web/src/constants/config.ts)
- [apps/web/src/constants/messages.ts](S:/learn-tree/odoo/apps/web/src/constants/messages.ts)
- [apps/web/src/constants/navigation.ts](S:/learn-tree/odoo/apps/web/src/constants/navigation.ts)
- [apps/web/src/constants/roles.ts](S:/learn-tree/odoo/apps/web/src/constants/roles.ts)
- [apps/web/src/constants/routes.ts](S:/learn-tree/odoo/apps/web/src/constants/routes.ts)
- [apps/web/src/context/auth-context-value.ts](S:/learn-tree/odoo/apps/web/src/context/auth-context-value.ts)
- [apps/web/src/context/auth-context.tsx](S:/learn-tree/odoo/apps/web/src/context/auth-context.tsx)
- [apps/web/src/hooks/auth/use-api-action.ts](S:/learn-tree/odoo/apps/web/src/hooks/auth/use-api-action.ts)
- [apps/web/src/hooks/auth/use-auth.ts](S:/learn-tree/odoo/apps/web/src/hooks/auth/use-auth.ts)
- [apps/web/src/hooks/auth/use-countdown.ts](S:/learn-tree/odoo/apps/web/src/hooks/auth/use-countdown.ts)
- [apps/web/src/hooks/auth/use-forgot-password.ts](S:/learn-tree/odoo/apps/web/src/hooks/auth/use-forgot-password.ts)
- [apps/web/src/hooks/auth/use-login.ts](S:/learn-tree/odoo/apps/web/src/hooks/auth/use-login.ts)
- [apps/web/src/hooks/auth/use-logout.ts](S:/learn-tree/odoo/apps/web/src/hooks/auth/use-logout.ts)
- [apps/web/src/hooks/auth/use-otp.ts](S:/learn-tree/odoo/apps/web/src/hooks/auth/use-otp.ts)
- [apps/web/src/hooks/auth/use-password-recovery.ts](S:/learn-tree/odoo/apps/web/src/hooks/auth/use-password-recovery.ts)
- [apps/web/src/hooks/auth/use-reset-password.ts](S:/learn-tree/odoo/apps/web/src/hooks/auth/use-reset-password.ts)
- [apps/web/src/hooks/auth/use-signup.ts](S:/learn-tree/odoo/apps/web/src/hooks/auth/use-signup.ts)
- [apps/web/src/hooks/auth/use-verification-email.ts](S:/learn-tree/odoo/apps/web/src/hooks/auth/use-verification-email.ts)
- [apps/web/src/lib/auth-validation.ts](S:/learn-tree/odoo/apps/web/src/lib/auth-validation.ts)
- [apps/web/src/lib/errors.ts](S:/learn-tree/odoo/apps/web/src/lib/errors.ts)
- [apps/web/src/pages/auth/forgot-password.tsx](S:/learn-tree/odoo/apps/web/src/pages/auth/forgot-password.tsx)
- [apps/web/src/pages/auth/login.tsx](S:/learn-tree/odoo/apps/web/src/pages/auth/login.tsx)
- [apps/web/src/pages/auth/signup.tsx](S:/learn-tree/odoo/apps/web/src/pages/auth/signup.tsx)
- [apps/web/src/pages/auth/verify-otp.tsx](S:/learn-tree/odoo/apps/web/src/pages/auth/verify-otp.tsx)
- [apps/web/src/pages/dashboard.tsx](S:/learn-tree/odoo/apps/web/src/pages/dashboard.tsx)
- [apps/web/src/pages/not-found.tsx](S:/learn-tree/odoo/apps/web/src/pages/not-found.tsx)
- [apps/web/src/types/auth.ts](S:/learn-tree/odoo/apps/web/src/types/auth.ts)
- [apps/web/src/vite-env.d.ts](S:/learn-tree/odoo/apps/web/src/vite-env.d.ts)

Generated migration files and snapshots are under
`S:/learn-tree/odoo/apps/core/migrations/`.

Modified wiring: `apps/web/src/App.tsx`, `main.tsx`, `vite.config.ts`, package.json,
root/core/web ESLint configs, root `.gitignore`, shared auth DTOs/barrel, core
auth schema/service/repository/router, Redis grant consumption, contract files,
core package scripts and authentication documentation. Core and web local `.env`
files remain ignored. The source code for every file is available at the links above.
