# PR plan

One feature per pull request, ordered so that every one of them merges into a
working app. Nothing here is a "part 1 of 3" that leaves `main` broken.

## How a PR is sized

Small enough to review in one sitting — roughly 200–500 lines of new code. A PR
that grows past that is two features that have not been separated yet.

Each one states what it deliberately leaves out. That line is the most useful
part of the description: it is what stops the next PR from being reviewed as a
gap in this one.

Bodies carry **Summary**, **Root Cause** and **Tests**, in that order.

## What is being ported, and what is not

`tdn-client` is the reference for behaviour, and roughly a third of it moves
across unchanged:

| Moves as-is | Needs adapting | Rewritten |
| --- | --- | --- |
| 12 `*.types.ts` — the whole API contract | `core/api/client.ts` — async token reads, body-channel refresh | Every component and screen |
| 10 `*.api.ts` — endpoint surface | `useRealtimeSocket` — AppState, NetInfo | `PageShell` breakpoints → tab navigator |
| ~50 hooks — the business logic | Upload paths — `File` → RN asset | `react-markdown` → an RN renderer |
| `translations.ts` — 1144 keys, tr/en | `language.store` — `expo-localization` | `caret-position.ts` — no DOM to measure |
| `mentions.ts`, `media-errors.ts`, `error-handler.ts` | `share.ts`, `image-src.ts`, `toast.store` | `worker/` — nothing to port |

**Four things bite, and they are worth knowing before the first PR:**

1. **Token reads become asynchronous.** The web client reads
   `localStorage.getItem("access_token")` synchronously on every request.
   `SecureStore` is promise-based, so `apiClient` has to `await` before it can
   build its headers. This is a shape change, not a line change.
2. **There is no cookie.** `credentials: "include"` does nothing here. The
   refresh token arrives in the response body (`client: "native"`) and is sent
   back in the body, and the app owns it outright.
3. **`crypto.randomUUID` does not exist** in the RN runtime. `toast.store` and
   the idempotency keys both need `expo-crypto`.
4. **The caret cannot be measured.** The mention suggestion list is positioned
   on the web by mirroring a textarea's typography into a hidden element. There
   is no equivalent; RN needs its own answer, which is why mentions are their
   own PR rather than a rider on the composer.

---

## Phase 0 — Foundations

Three PRs that are not features and cannot be avoided. Kept as tight as they go.

### PR 1 — Network client

`core/api/client.ts`, `core/api/api-types.ts`, `shared/utils/error-handler.ts`,
`shared/utils/media-errors.ts`.

Ported whole: the 15 s `AbortController` budget and `NetworkError` wrapping,
`isPublic` / `isAnonymous`, the single in-flight refresh with its queue,
`getPage` for cursor listings, and `readBody`'s synthesised problem document
for a body that will not parse.

Native additions: tokens through `SecureStoragePort`, refresh on the body
channel, and an `Idempotency-Key` per user action on the seven writes that
accept one — posts, both comment endpoints, articles, messages and the two
uploads. A fresh UUID per action, the same key for every retry of it.

**Not in it:** no feature calls this yet.

### PR 2 — Design system and i18n

`translations.ts` copied verbatim, `useI18n`, `translate`, the language store
seeded from `expo-localization` rather than `navigator.language`, the theme
store, and the first UI primitives: `Screen`, `Text`, `Button`, `Avatar`,
`Spinner`, `Toast`, `EmptyState`, `ErrorState`.

`ErrorState` and `EmptyState` exist from the start on purpose. The web client's
rule is that every list renders explicit loading, error-with-retry and empty
states and never silently renders nothing; making them primitives is how that
survives contact with twenty screens.

**Not in it:** no navigation, no screens.

### PR 3 — Session and sign-in

`core/session/`, the auth data layer, and the identifier → login | register →
verify-email flow, plus forgot-password → reset-password.

`login` sends `client: "native"`, so the refresh token comes back in the body
and goes to the keystore. `isAnonymous` on every credential endpoint — a 401
from `/auth/login` is the endpoint's verdict on the password, and replaying it
would halve a 3-per-15-minutes budget and then report the session as expired.

The session-expired handler clears the session and reopens sign-in.

**Not in it:** OAuth, account recovery.

---

## Phase 1 — A usable app

### PR 4 — OAuth sign-in

`expo-auth-session` against `GET /oauth/{github,google}?redirect=tdn://…`, then
`POST /oauth/exchange`. The exchange takes no client flag and must not be given
one: the channel was recorded on the code when the flow started.

**Deployment dependency:** the `tdn://` target has to be added to the API's
`OAUTH_NATIVE_REDIRECT_ALLOWLIST`, which is an exact match with no prefix test.
Until it is, every attempt is a 400.

### PR 5 — App shell and tab navigation

Five tabs mirroring `BottomNav`: Home, Explore, Notifications, Messages,
Profile. Unread badges wired to the stores that already exist. The guard that
turns a mutation by a signed-out reader into the sign-in sheet.

**Not in it:** tab contents beyond placeholders.

### PR 6 — Feed

`useFeed` ported whole — including the request-id guard that stops a slow page
from a tab you have left landing last. `FlatList` with pull-to-refresh and
`onEndReached`, `PostCard` carrying author, text, timestamps and counters.

**Not in it:** media, likes, bookmarks, quotes. The card renders them dead.

### PR 7 — Post media

`SensitiveMedia` and `PendingMedia`, image and video rendering, and
`usePendingMedia` polling the one post — never the feed, which is cached 60 s
server-side — stopping when the flag clears, after five minutes, or while the
app is backgrounded.

`isSensitive` and `mediaPending` are content-level, not per-media.
`QuotedPostCard` must pass the quoted post's own flag, or quoting becomes the
way around the filter.

### PR 8 — Post interactions

`usePostActions`: like and bookmark, optimistic with rollback in `catch` and a
toast on failure. Share through RN's `Share`.

### PR 9 — Post detail and comments

The detail screen, `useComments`, `useCommentReplies`, `CommentCard`, and the
comment composer. A comment hangs off a post or an article and never both —
narrow `postId` / `articleId` rather than asserting.

### PR 10 — Composing a post

`PostBox`, the image picker, and `POST /media` with its moderation handling:
`withModerationRetry` absorbs exactly one 503, and `clearsSelection` defaults
to **keeping** the files, naming only the four verdicts that discard them.

One upload belongs to one piece of content — re-sending `mediaUrls` is
`MediaNotOwnedError`, safe to retry after a 5xx and not after a success.

### PR 11 — Quoting

The quote composer and `QuotedPostCard`. A quote is a post that carries another
post, so lists and actions need no special case; the embedded card is always
exactly one level deep.

### PR 12 — Profile

`useProfile`, the profile screen, the user's posts, and follower/following
lists. Render from `isBlocked` and `isBlockedBy` separately from the start —
they need different screens, and retrofitting that is worse than writing it.

### PR 13 — Following

`useFollowAction`, optimistic with a silent rollback.

### PR 14 — Notifications and the realtime socket

The list, the badge from `GET /notifications/unread-count` — never counted off
a page — and `useRealtimeSocket` carrying `new-notification`.

Native additions: the socket closes on background and redials on foreground
through `AppStatePort`, and its backoff pauses on `NetworkPort` rather than
burning five retries in a tunnel.

**Not in it:** the five message events. They arrive with messaging.

### PR 15 — Push notifications

The `PushPort` adapter, `POST /devices` at **every** launch, `DELETE /devices`
before discarding a session on sign-out, and tap routing from `data.type` plus
whichever ids are present.

Android 13+ needs a runtime permission, and when it is asked for decides
whether most people enable push or most refuse — so it is asked after the first
notification would have been useful, not at first launch.

**Deployment dependency:** `PUSH_ENABLED=true` and, if the Expo project has
push security on, `EXPO_ACCESS_TOKEN`.

### PR 16 — Onboarding

The gate and the two-step flow. It stands down while sign-in is open, passes
rather than redirects when the profile request fails, and settles for good once
finished — a live `< 5` check drags an account back the moment it unfollows
somebody.

### PR 17 — Update gate

`GET /meta/client?build=<versionCode>` at launch, and a blocking screen when
`updateRequired`.

**This has to ship in the first release.** A web bundle is replaced every
morning; an app version lives on phones for months, and a build published
without this can never be told it is too old.

**Deployment dependency:** `MOBILE_MIN_SUPPORTED_BUILD`, `MOBILE_LATEST_BUILD`
and `MOBILE_STORE_URL_ANDROID` are `0`/empty today.

> **First release cuts here.** PRs 1–17 are sign-in, a feed you can read and
> post to, profiles, notifications that reach a closed app, and a way to
> retire the build. Everything below is the second release.

---

## Phase 2 — Completing the surface

### PR 18 — Explore, trends and search

`useTrends`, `useTagSearch`, `useProfileSearch`, tag and category filtering.

### PR 19 — Bookmarks

One endpoint returning posts, comments and articles together.

### PR 20 — Settings

Account info, username, email and password changes, account deletion behind a
password, theme and language.

### PR 21 — Blocking

The one mutation that is **not** optimistic: a block that failed leaves a
screen indistinguishable from one where it worked, so `useBlockAction` awaits
the server. A block replaces the tabs and the timeline rather than letting an
empty list imply the account never wrote anything, and the page re-reads rather
than patches, because a block also tears down both follows.

The blocked list in Settings is the only route back to a block.

### PR 22 — Reporting

Posts and comments only, one endpoint, no read side. The answer is always
`{ received: true }`, so there is no "already reported" state to keep and
nothing local to remember. Report and delete are mutually exclusive on a card.

`useReport` returns its error rather than toasting it — the dialog holding the
reason and the text is still on screen.

### PR 23 — Mentions

Rendering first: a handle links only when it matches an entry in `mentions`,
case-insensitively. The grammar in `shared/utils/mentions.ts` mirrors the API's
and drift is silent, so its tests come across with it.

Then autocomplete, which needs a positioning strategy of its own — see the note
at the top. A bottom sheet or an anchored list above the keyboard is likely to
beat trying to reproduce the caret measurement.

### PR 24 — Messages: the inbox

Cursor-paginated conversations, the requests tab, accept and decline. Render
from `isRequest` and `canSend`, never from `status`. The unread badge counts
`ACCEPTED` only.

### PR 25 — Messages: the thread

The thread screen, the composer with its 4000-character cap mirrored, read
watermarks under the newest outgoing message only, and tombstones that keep
their place.

### PR 26 — Messages: media and realtime

`POST /messages/media` on its own channel, and the five chat events joining the
socket from PR 14. `mediaRejected` renders "media removed" here — a deliberate
exception to the rule for posts, because a message carries the fact in a field
rather than reconstructing it from session memory.

### PR 27 — Articles: reading

The list and the reading screen, which needs an RN markdown renderer and a
remark-equivalent for linking mentions inside the tree rather than over
rendered output.

### PR 28 — Article editor

Deliberately last. Markdown authoring, cover upload, autosave and
draft/publish. The most expensive screen on a phone and the least used; it
earns its place only once everything else is there.

---

## Deployment dependencies, collected

Four things live in the API's environment and block a PR each:

| Needed by | Variable |
| --- | --- |
| PR 4 | `OAUTH_NATIVE_REDIRECT_ALLOWLIST` — exact `tdn://` target |
| PR 15 | `PUSH_ENABLED`, `EXPO_ACCESS_TOKEN` |
| PR 17 | `MOBILE_MIN_SUPPORTED_BUILD`, `MOBILE_LATEST_BUILD`, `MOBILE_STORE_URL_ANDROID` |
| Release | A Play Console entry, before `GooglePlayBillingService` can replace the stub |
