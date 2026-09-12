import Constants from "expo-constants";
import { Platform } from "react-native";

import type { DeviceDescriptor } from "./device-registration";

/**
 * The build number this token is registered from.
 *
 * Read through `expo-constants` rather than `process.env`, for the same reason
 * the update gate does: `extra.build` is stamped from the same constant as
 * `versionCode`, so the two cannot drift.
 */
function appVersion(): string | undefined {
    const extra = Constants.expoConfig?.extra as { build?: number } | undefined;

    return extra?.build === undefined ? undefined : String(extra.build);
}

/**
 * What this phone is, for `POST /devices`.
 *
 * Separate from `device-registration.ts` because it is the part with native
 * modules behind it — `react-native` and `expo-constants` — and keeping them
 * out of the registration module is what lets that module be tested without
 * standing either of them up. Two callers read it: the launch hook, and the
 * prompt that registers the moment permission is granted.
 *
 * @param locale - The language the copy should be written in
 */
export function deviceDescriptor(locale: string): DeviceDescriptor {
    return {
        // The only platform that ships today. Written as a branch rather than
        // a constant because this is the whole of the iOS difference here, and
        // it is cheaper than remembering to come back for it.
        platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
        appVersion: appVersion(),
        locale,
    };
}
