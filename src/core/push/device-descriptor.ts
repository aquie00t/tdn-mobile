import { APP_BUILD } from "@shared/constants/app-build";
import type { DeviceDescriptor } from "./device-registration";
import { Platform } from "react-native";

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
        // A string here, a number in the update gate's query: the two
        // endpoints take it differently, and `APP_BUILD` is the one number
        // both are formatting.
        appVersion: APP_BUILD === undefined ? undefined : String(APP_BUILD),
        locale,
    };
}
