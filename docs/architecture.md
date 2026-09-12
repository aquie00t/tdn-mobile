# Architecture

Feature-first, with the three layers Android's app architecture guide names —
**UI**, **Domain**, **Data** — expressed in React idioms rather than Kotlin
classes. The layering is the same; what is dropped is the ceremony that only
pays off in a language without hooks.

## Why not the backend's Clean Architecture

`tdn-api` builds entities, ports, use-case classes and an awilix container
because it owns the business rules and has to keep them away from Prisma and
Fastify. None of that motivation survives the trip to a client:

- **The server owns the rules.** Feed ranking, moderation verdicts, block
  visibility, mention resolution — all of it is decided in `tdn-api`. A domain
  entity here would be a second model of the same thing, kept in step by hand
  through a mapper that earns nothing.
- **React is already layered.** A component is the view; a hook is the state
  holder. Wrapping a hook in a `LoginUseCase` class adds a file, not a boundary.
- **A DI container costs and returns nothing.** It breaks tree-shaking, grows
  the bundle and fights Fast Refresh. A module import is the injection.

What *is* worth keeping is the dependency rule and the ports — and those are
kept, below.

## The layers

```
src/
  app/                       Expo Router — route definitions, thin
  core/
    api/                     the one network client
    platform/                ports + adapters (the seam)
  features/<name>/
    data/                    <name>.api.ts, <name>.types.ts
    domain/                  pure rules, only when there are any
    ui/
      screens/               one component per route
      components/
      hooks/                 state holders
      store/                 zustand
  shared/
    ui/  theme/  i18n/  utils/
```

| Android guide | tdn-mobile | tdn-api counterpart |
| --- | --- | --- |
| UI elements (Composable) | `ui/screens`, `ui/components` | — |
| State holder (ViewModel) | `ui/hooks/use*.ts`, `ui/store` | — |
| Use case (Domain, optional) | `domain/*.ts` | `core/use-cases/` |
| Repository | `data/*.api.ts` | `infrastructure/persistence/` |
| Data source | `core/api/client.ts`, `core/platform/` | Prisma, Redis, S3 |
| Hilt / Dagger | `core/platform/index.ts` | awilix container |

**The Domain layer is optional and usually absent**, exactly as Google's guide
says. Create `domain/` only when a rule is pure, non-trivial and shared by more
than one state holder — the handle grammar in `mentions.ts` is the shape that
qualifies. A `domain/` folder holding one function that is called once belongs
in the hook that calls it.

## The dependency rule

Imports point one way only:

```
route → screen → hook → data | domain → core | shared
```

Four boundaries are enforced by `oxlint` rather than by review, because a rule
nobody can violate is worth more than one everybody agrees with:

- `data/` may not import `ui/` — not its own feature's, not `@shared/ui`.
- `domain/` may not import `ui/`, `data/` or `core/`. It is pure or it is not
  domain.
- **No feature may import another feature.** Anything two features need moves
  up into `shared/`. There is no "just this once" — that import is how a
  feature-first codebase becomes a ball of mud in month three.
- `core/` and `shared/` may not import `features/` at all.

Run `pnpm lint` to check. The rules live in `.oxlintrc.json`; note that oxlint's
`overrides` **replace** a rule's configuration rather than merging it, so each
glob carries its full pattern set and the most specific override is listed last.

## The platform seam

`core/platform/` is the one place ports genuinely pay for themselves. Each port
is an interface over something that differs by platform, is unavailable in a
test, or is the kind of thing every screen would otherwise reach for directly:

| Port | Why it exists |
| --- | --- |
| `SecureStoragePort` | The web kept its refresh token in an httpOnly cookie. A native client is handed the token in the response body and owns it outright, so the keystore is what replaces that protection. |
| `StoragePort` | Ordinary preferences. Deliberately not the keystore, which is slow and finite. |
| `AppStatePort` | Both platforms close the socket when the app is backgrounded. Foreground/background is a first-class concern with no web equivalent. |
| `NetworkPort` | Offline is normal here, not exceptional. The socket's backoff pauses on it. |
| `PushPort` | The second transport, for a phone nobody is looking at. |

`core/platform/index.ts` binds ports to adapters in one object. A test
substitutes that object; the iOS work is adapters beside the existing ones
rather than edits scattered through features.

## Three concerns the web client never had

- **Lifecycle.** Backgrounding closes the socket and staleness accumulates.
  What each feature re-reads on return is a per-feature decision, made once.
- **Offline.** A lost *response* is routine, and the client cannot tell it from
  a lost request. `Idempotency-Key` on the seven writes that support it is what
  makes the retry safe (`docs/idempotency.md` in the API repo).
- **Deep links.** A push tap routes from whichever ids came with it — the
  payload carries no `referenceId` and no handle, so the ids decide and the
  type turns out not to be read at all — and OAuth returns on the `tdn://`
  scheme. Both are route design, not something bolted on later.
