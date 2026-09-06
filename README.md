# TDN Mobile

The Developer Network's native client, built with Expo and React Native. It
talks to the same API as [`tdn-client`](https://github.com/the-developer-network/tdn-client)
— there is no mobile-specific endpoint set; the difference is which channel a
session is delivered on.

**Technologies:**

- **Expo:** SDK 57
- **React Native:** 0.87
- **TypeScript:** strict
- **Expo Router:** file-based routing
- **Zustand:** 5 (state management)
- **NativeWind:** 4 (Tailwind utilities, sharing `tdn-client`'s design tokens)
- **pnpm:** package manager

**Project status:** Private, pre-release.

## Quick Start

```bash
pnpm install
pnpm start          # Expo dev server
pnpm android        # build and run on a connected device or emulator
```

A local API on `http://localhost:8080/api/v1` is expected during development —
see [`tdn-api`](https://github.com/the-developer-network/tdn-api).

## Architecture

Feature-first, with a thin port layer at the platform boundary. Business rules
live on the server; this app owns presentation, session handling and the
offline/lifecycle concerns a browser never has.

```
src/app/          Expo Router routes — thin, one screen per file
src/core/         api client, session, realtime socket
src/core/platform ports + adapters for secure storage, push, files, app state
src/features/     <name>/{api,components,hooks,store} — self-contained modules
src/shared/       ui primitives, theme tokens, i18n, utils
```

Dependencies point one way only: `route → screen → hook → api | platform`. A
module under `api/` never imports a component, and no feature imports another
feature's `components/` — anything shared moves up into `src/shared/ui`.

## Contributing

Conventional Commits (`feat(feed): …`). Pull request bodies carry three
sections: **Summary**, **Root Cause**, **Tests**.

## License

See [LICENSE](./LICENSE).
