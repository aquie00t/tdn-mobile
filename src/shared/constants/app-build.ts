import Constants from "expo-constants";

/**
 * The build number this binary was stamped with, or `undefined` off a build
 * that carries none.
 *
 * Read through `expo-constants` rather than `process.env`, so it is the number
 * the app was built with and cannot drift from `versionCode` — `app.config.ts`
 * writes both from one constant.
 *
 * In one place because two callers read it and they must agree: the update
 * gate, which asks the API whether *this* build is still supported, and
 * `POST /devices`, which reports it as `appVersion`. Two copies of the same
 * cast through `extra` is how those two come to answer differently.
 *
 * `undefined` is a real case rather than a defensive one, and the update gate
 * depends on the distinction: the API cannot tell a client it is too old if
 * the client never said which build it is, so the parameter has to be left
 * out rather than sent as a nought.
 */
export const APP_BUILD: number | undefined = (
    Constants.expoConfig?.extra as { build?: number } | undefined
)?.build;
