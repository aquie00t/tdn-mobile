# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

The Expo/React Native client for The Developer Network. **Android only for
now**; iOS lands later and the seam that keeps that a configuration change is
`src/core/platform/`.

Two sibling repos are the references and are usually checked out beside this
one at `../tdn-client` and `../tdn-api`:

- **`tdn-client`** — the React 19 web SPA. The reference for *behaviour*.
  Roughly a third of it ports across unchanged, and where a rule is not
  written down here, it is written down there. Drift between the two is silent,
  so read the web version of anything before reimplementing it.
- **`tdn-api`** — Fastify + Prisma. Its `docs/` carry the client-facing
  contracts (`idempotency.md`, `direct-messaging.md`, `mentions.md`,
  `blocking.md`, `push-notifications.md`, `reporting.md`).

There is no mobile-specific endpoint set. The difference between the two
clients is which **channel** a session is delivered on.

`docs/roadmap.md` is the PR plan: one feature per pull request, ordered so each
merges into a working app. `docs/architecture.md` explains the layering and why
it is not the backend's Clean Architecture.

## Commands

```bash
pnpm start                # Expo dev server
pnpm android              # build and run on a device or emulator
pnpm prebuild             # regenerate the native project (android/ is gitignored)

pnpm typecheck            # tsc --noEmit
pnpm lint                 # oxlint
pnpm lint:fix             # oxlint --fix
pnpm format               # prettier --write over src
pnpm format:check

pnpm test                 # vitest run
pnpm test:watch
pnpm test:coverage
```

Single test file or case:

```bash
pnpm test src/core/api/client.test.ts
pnpm test -t "renews once for several requests that fail together"
```

`npx expo export --platform android` is the cheapest end-to-end check that the
app still bundles — it exercises Metro, NativeWind and the router without a
device, and it catches things `tsc` cannot.

`pnpm` only. Node from `.nvmrc` (26). Husky + lint-staged run `oxlint --fix`
and `prettier --write` over `src/**/*.{ts,tsx}` at commit time.

## Toolchain, and four things that surprise people

**TypeScript 7 with oxlint, not ESLint.** `typescript-eslint` refuses to load
against TS 7 — it throws at import time, so even syntax-only rules are
unavailable. `oxlint` has its own parser, no dependency on the `typescript`
package, and carries the rules that matter here: `react-hooks/exhaustive-deps`
and the import boundaries below. `npx expo install --check` will report
`typescript@7.0.2 - expected version: ~6.0.3` forever; that is expected. Metro
strips types with Babel and never invokes `tsc`, so the version only affects
typechecking and the editor.

**`nodeLinker: hoisted` lives in `pnpm-workspace.yaml`, not `.npmrc`.** pnpm 11
reads its own settings from the workspace file and silently ignores a
`node-linker` line in `.npmrc`. Without the hoisted layout, React Native's
module resolution — which walks `node_modules` — cannot find
`react-native-css-interop/jsx-runtime`, which NativeWind's Babel preset emits
into every file, and native autolinking finds nothing at all.

**`vitest.config.mts`, not `.ts`.** There is no `"type": "module"` in
`package.json` — the Metro and Babel configs are CommonJS and have to stay that
way — so a `.ts` config using ESM syntax loads as CommonJS and fails.

**NativeWind 4 pins Tailwind 3**, unlike `tdn-client`, which is on Tailwind 4.
The class names and the token roles are the same; only the config format
differs, so a screen can still be written from the web component beside it.

## Architecture

Feature-first, with the three layers Android's app architecture guide names —
**UI**, **Domain**, **Data** — in React idioms rather than Kotlin classes. The
backend's Clean Architecture is deliberately *not* reproduced: the server owns
the business rules, so a domain entity here would be a second model of the same
thing, and a DI container would cost bundle size and Fast Refresh to replace
what a module import already does. `docs/architecture.md` has the full argument.

```
src/app/                  Expo Router routes — thin, one screen per file
src/core/api/             the one network client
src/core/session/         tokens; the session store lands with sign-in
src/core/platform/        ports + adapters — the seam
src/features/<name>/
  data/                   <name>.api.ts, <name>.types.ts
  domain/                 pure rules, only when there are any
  ui/screens|components|hooks|store
src/shared/               ui primitives, theme, i18n, utils
```

**The Domain layer is optional and usually absent**, exactly as Google's guide
says. Create `domain/` only when a rule is pure, non-trivial and shared by more
than one state holder.

### The dependency rule is enforced, not agreed

Imports point one way: `route → screen → hook → data | domain → core | shared`.
Four boundaries are checked by `oxlint` rather than by review:

- `data/` may not import `ui/` — not its own feature's, not `@shared/ui`
- `domain/` may not import `ui/`, `data/` or `core/`
- **no feature may import another feature** — anything shared moves to `shared/`
- `core/` and `shared/` may not import `features/`

The rules are in `.oxlintrc.json`. **oxlint's `overrides` *replace* a rule's
configuration rather than merging it**, so each glob carries its full pattern
set and the most specific override is listed last. Written the other way, the
general override silently cancels the specific one and the rule never fires.

**Anything outside the current feature is imported through an alias** —
`@shared/…`, `@core/…` — and relative paths stay within it. This is what makes
the boundary checkable: a depth-based pattern like `../../../../*/ui/**` cannot
tell `src/features/other/ui` from `src/shared/ui`, because how many `../` reach
`src/features` depends on how deeply the importing file is nested. Metro
resolves the aliases (`experiments.tsconfigPaths` defaults to true) and so does
the Vitest config.

### The platform seam

`src/core/platform/` is the one place ports earn their keep — things that
differ by platform, are unavailable in a test, or would otherwise be reached
for directly from every screen: `SecureStoragePort`, `StoragePort`,
`AppStatePort`, `NetworkPort`, `PushPort`. `index.ts` binds them to adapters in
one object; a test substitutes that object, and the iOS work is adapters beside
the existing ones.

A port with no adapter yet is deliberate, not an oversight — `PushPort` waits
because Android 13+ needs a runtime permission, and *when* it is asked for
decides whether most people enable push or most refuse, so that call belongs to
a screen rather than to boot.

## The API client (`src/core/api/client.ts`)

Everything network goes through `api.get/post/patch/delete`. Ported from
`tdn-client/src/core/api/client.ts`; read that file's comments too.

- `apiClient` **unwraps `ApiResponse<T>.data`**. Every mock must wrap its
  payload in `{ data: … }`.
- `api.getPage` is the one exception: it returns the whole `{ data, meta }`
  document, because cursor-paginated listings keep their cursor in
  `meta.nextCursor`. `nextCursor` is opaque — echo it back verbatim, never
  parse or construct one. Use it **only** where the endpoint is
  cursor-paginated; anything paged by `page`/`limit` stays on `api.get`.
- `{ isPublic: true }` — readable with or without a session. A 401 replays the
  request anonymously and refreshes in the background.
- `{ isAnonymous: true }` — for endpoints called to *obtain* a session. No
  token is sent and a 401 is the endpoint's own answer, so it is thrown to the
  caller with no replay and no refresh. **Never flag a credential endpoint
  `isPublic`**: the replay doubles it against the 3-per-15-minutes limit on
  `/auth/login`, and the background refresh then reports the session expired —
  over a mistyped password.
- `{ contentType: false }` for `FormData`.
- 15 s `AbortController` → `NetworkError`. 204 → `{}`. A body that will not
  parse is thrown as a synthesised RFC 7807 document carrying the real status,
  never a bare `SyntaxError`.

### Native session handling

**There is no cookie.** The refresh token arrives in the response body under
`client: "native"` on login and is sent back in the body as `{ refreshToken }`.
The API answers a request on the channel it arrived on.

**Every refresh rotates**, returning a new refresh token as well as a new
access token, and both must be stored. The web client kept only the access
token because the server rewrote its cookie; dropping the rotated token here
works until the old one is retired and then signs the account out, with the
previous token looking to the server exactly like a replay.

**Refreshing is one attempt, deliberately.** Inside the server's 30 s rotation
grace window a refresh whose response was lost is already served normally. Past
it, a second attempt with a retired token is what reuse detection watches for,
and that revokes every session on every device.

**`expiresAt` and `refreshTokenExpiresAt` are unix seconds**, not milliseconds.

The access token is mirrored in memory by `src/core/session/tokens.ts` and read
from there on every request. `loadTokens()` must resolve before the first
authenticated request; until then `getAccessToken()` answers `null` and the
request goes out unauthenticated.

### Idempotency

`{ idempotencyKey }` sets the `Idempotency-Key` header. **The caller owns the
key**, not the client: it exists so a *person's* retry — tapping "post" again
after a timeout — is answered from the first attempt, and a key minted inside
`apiClient` would be fresh on every attempt and so no better than none. A hook
generates one when the action begins and holds it for as long as that action is
retried.

Eight routes accept one (`tdn-api/docs/idempotency.md` lists seven; `POST
/billing/play/purchases` opts in too and is missing from the doc). The plugin
engages only for an authenticated request, and a key over 200 characters is a
400.

## Sessions

**There is no guest browsing, and that is a deliberate difference from the web
client.** The web lets a reader through the whole feed and only asks for a
session when they try to change something; the app is behind a sign-in wall.
`useAuthGate` in `src/app/_layout.tsx` redirects in both directions — out of
the app without a session, and out of `(auth)` with one.

`isPublic` on the API client still matters even so: it governs what happens to
a *stale* token on a readable endpoint, which is not the same question as
whether a guest may read.

Tokens live in `src/core/session/tokens.ts` (keystore); who is signed in lives
in `src/core/session/session.store.ts` (ordinary storage). The store has no
`signOut`, on purpose — signing out means telling the server, and `core/` may
not import a feature's data layer. `useAuthActions` owns the sequence.

The root layout holds the splash until three things have been read: both
persisted stores **and** `loadTokens()`. Until that resolves `getAccessToken()`
answers `null`, so anything fetched in that window goes out unauthenticated.

## Styling

NativeWind 4 utilities. **Never write a raw neutral colour utility** —
`text-white`, `bg-black`, `bg-zinc-900` name a pixel rather than a role, so
they cannot follow a theme; one of them anywhere is a spot that stays dark on a
light screen.

The roles are `tdn-client`'s, by the same names: `ground` (the page), `ink`
(the foreground), `ink-hover`, `surface-1..3` (a ramp of raised panels), plus
`scrim` and `on-fill`. Values are RGB triples in
`src/shared/theme/global.css` so the alpha slot works — `border-ink/10` is a
faint light line on black and a faint dark one on white, for free.

The accents diverge from the web deliberately: `danger`, `success` and `accent`
are roles here, where the web keeps Tailwind's `red-400` names and redefines
their shades under its light theme. That is a Tailwind 4 mechanism, and
`index.css` says plainly that semantic names would have been better and that
renaming nine hundred call sites was the only reason they are not.

Two rules about `global.css` that fail silently if broken. The `:root` and
`.dark:root` blocks must stay inside `@layer base`, after `@tailwind base` —
hoisted above the directive NativeWind's plugin emits, `.dark:root` parses as
an ordinary `.dark` class and the entire dark palette disappears with no
warning. And a role never referenced by a `className` anywhere is stripped from
the bundle, which only shows up when something tries to read it from JS.

Strings go through `src/shared/ui/Text.tsx`, always. React Native's `Text`
inherits neither typography nor colour from the `View` around it, so a bare
`<Text>` renders in the platform default — black, and invisible on the dark
ground.

`scrim` and `on-fill` deliberately do **not** swap between themes: a wash over
somebody's photo and the white on a red delete button contrast against
something the theme did not change.

The theme is set at module scope in `src/app/_layout.tsx`, before the first
render — the native counterpart of the inline script in the web client's
`index.html`. Doing it in an effect is one frame too late and the screen paints
twice. It defaults to **dark**, not the system setting, because the app shipped
dark and following the OS would repaint it white for everyone whose phone is
set light.

Not yet ported: the accent ramp (`red-*`, `blue-*`, `pink-*`) that
`tdn-client` redefines under its light theme, because the shades that glow on
black fail contrast on white.

## Testing

Vitest + MSW, `environment: "node"`. **There is no component testing, and that
is a decision rather than a gap.** Rendering React Native under Vitest needs
the RN preset's Babel transform for its Flow-typed, untranspiled sources —
real infrastructure — and the primitives in `src/shared/ui/` are wrappers over
class strings with no branching worth asserting.

Revisit when a component carries logic rather than styling: a `ListState`
choosing between loading, error and empty, or a composer mirroring a character
cap. Until then, components are verified by running the app.

**MSW runs with `onUnhandledRequest: "error"`.** An unhandled request is a bug,
not a fallback to the real network. `tests/msw-server.ts` registers no default
handlers; every spec declares what it expects with `server.use()`.

Native modules cannot load off-device, so anything reaching one needs a mock —
`expo-secure-store` is stood up as a `Map` in `src/core/api/client.test.ts`,
hoisted above the imports because `tokens.ts` reaches it as it loads. Keep
native imports out of the transport's module graph where it is cheap to:
`IDEMPOTENCY_HEADER` lives in `client.ts` rather than beside
`newIdempotencyKey`, which imports `expo-crypto`, so no test that touches the
client has to mock crypto.

## Conventions

| Kind | Pattern | Example |
| --- | --- | --- |
| Component file | PascalCase | `PostCard.tsx` |
| Screen file | PascalCase + `Screen` | `FeedScreen.tsx` |
| Hook file | `use` prefix | `useComments.ts` |
| API module | `.api.ts` | `feed.api.ts` |
| Type file | `.types.ts` | `comment.types.ts` |
| Zustand store | `.store.ts` | `message.store.ts` |
| Platform port | `.port.ts` | `push.port.ts` |
| Event handler | `handleXxx` | `handleLike` |
| Props interface | `XxxProps` | `PostCardProps` |

- TypeScript strict, `noUnusedLocals`/`noUnusedParameters`,
  `erasableSyntaxOnly`, `verbatimModuleSyntax` (use `import type`). No `any` —
  narrow from `unknown`.
- `interface` for object shapes; union literals instead of `enum`.
- Prettier: 4 spaces, double quotes, semicolons, trailing commas, 80 columns.
- Zustand 5 only — no Context API, Redux, React Query or SWR. Local ephemeral
  state uses `useState`. The ~50 hooks in `tdn-client` are being ported as-is
  for behaviour parity; do not replace one with a query library in passing.
- Always render explicit **loading**, **error** (with retry) and **empty**
  states — never silently render nothing.
- Mutations are **optimistic**: snapshot, apply, roll back in `catch`. Blocking
  is the one exception, and `docs/roadmap.md` says why.
- No barrel `index.ts` files, except `core/platform/index.ts`, which is the
  composition root.

### Commits and pull requests

Conventional Commits (`feat(feed): …`). Branch from `main` as `feature/`,
`fix/`, `chore/` or `docs/`.

Pull request bodies carry three sections in this order: **Summary**, **Root
Cause**, **Tests**, and end with the single line `AI Asistan Opus 5`.

**Do not add a session link, `Co-Authored-By: Claude`, or a "Generated with
Claude Code" footer** to commits or pull requests. This is deliberate and
overrides the default attribution.
