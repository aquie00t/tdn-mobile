import { deviceApi } from "./device.api";
import type { DevicePlatform } from "./device.api";
import { platform } from "@core/platform";

/**
 * What this phone is, as the API wants it told.
 *
 * Passed in rather than read here, because reading it means `react-native` and
 * `expo-constants` — two native modules that would then sit in the module
 * graph of every test that touches registration. The caller is a hook, and a
 * hook is already on a device.
 */
export interface DeviceDescriptor {
    platform: DevicePlatform;
    appVersion?: string;
    locale?: string;
}

/**
 * The token this launch registered, so sign-out can name it.
 *
 * Module state rather than a store: nothing renders from it, and it must not
 * survive a restart — a token is asked for again at every launch anyway, and a
 * persisted one would be a stale string to delete rows by.
 */
let registeredToken: string | null = null;

/**
 * Tells the API this phone can receive notifications.
 *
 * Called at every launch and again the moment permission is granted, and
 * silent throughout: a registration nobody asked for is not something to
 * report, and the next launch is the retry.
 *
 * **Nothing is registered while permission is not granted.** A token can still
 * be minted without it on Android — the notification simply arrives and is
 * never shown — so registering anyway would produce a row that can never buzz,
 * and every notification for that account would spend a send on it.
 *
 * @param descriptor - What this phone is
 */
export async function syncDevice(descriptor: DeviceDescriptor): Promise<void> {
    if ((await platform.push.getPermission()) !== "granted") return;

    const token = await platform.push.getToken();

    if (!token) return;

    /*
     * Remembered before the request, not after.
     *
     * If the registration failed, this token may still be registered from an
     * earlier launch — the phone keeps its token across restarts. Retiring a
     * row that is not there is answered calmly (`{ registered: false }`);
     * leaving a row behind on a phone that signed out is the failure the whole
     * `DELETE` exists to prevent.
     */
    registeredToken = token;

    try {
        await deviceApi.register({ token, ...descriptor });
    } catch {
        // The launch is not held up by a notification channel.
    }
}

/**
 * Retires this phone's token.
 *
 * **Called before the session is discarded**, while the access token that
 * authenticates it still exists. A signed-out phone that is still registered
 * keeps receiving the previous account's notifications, which is the one
 * failure here that a user would describe as a privacy problem rather than a
 * bug.
 *
 * Falls back to asking the platform when this launch never registered
 * anything: the token is the same string across restarts, so a row written
 * yesterday is still retired by it. The fallback is skipped when permission is
 * not granted, because then there is no row to retire and asking Expo for a
 * token would be a network round trip in the middle of signing out.
 */
export async function retireDevice(): Promise<void> {
    const token =
        registeredToken ??
        ((await platform.push.getPermission()) === "granted"
            ? await platform.push.getToken()
            : null);

    registeredToken = null;

    if (!token) return;

    try {
        await deviceApi.unregister(token);
    } catch {
        // Nothing to do about it, and the session is going either way. The
        // API's retention sweep drops the row after 90 days unseen.
    }
}
