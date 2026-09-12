import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

import type { PushPermission, PushPort } from "../push.port";

/**
 * The one Android channel.
 *
 * Android 8+ delivers nothing that does not belong to a channel, and a channel
 * created after the first notification arrives does not retroactively apply —
 * the notification is dropped. So this is written at every launch rather than
 * once: `setNotificationChannelAsync` is an upsert, and the cost of calling it
 * again is a no-op while the cost of having skipped it is silence.
 *
 * `HIGH` is what produces the heads-up banner people mean when they say "like
 * WhatsApp". Anything below it lands in the shade without a sound.
 *
 * One channel rather than one per notification type, deliberately: Android
 * exposes channels in the OS settings as individual switches, and nine of them
 * for likes, follows and mentions is a settings screen nobody asked for. The
 * server decides what is worth sending.
 */
const ANDROID_CHANNEL_ID = "default";

/**
 * What to do with a notification that arrives while somebody is looking at the
 * app.
 *
 * Nothing, and that is the decision. The realtime socket is the foreground
 * transport — it is already raising the tab badge from the same event — so an
 * OS banner over the app would be the second announcement of one thing. Push
 * exists for the case the socket cannot serve, which is the app being closed,
 * and this handler is only consulted in the case it can.
 *
 * Set at module scope because expo-notifications consults it the moment a
 * notification lands, which can be before any component has mounted.
 */
Notifications.setNotificationHandler({
    handleNotification: () =>
        Promise.resolve({
            shouldShowBanner: false,
            shouldShowList: false,
            shouldPlaySound: false,
            shouldSetBadge: true,
        }),
});

/**
 * The Expo project the token is minted against.
 *
 * `eas init` stamps it into the config as `extra.eas.projectId`. Until it has
 * been run the field does not exist, and `getExpoPushTokenAsync` cannot mint
 * anything without it — the token is scoped to a project, and Expo's service
 * has to know which one to deliver to.
 */
function projectId(): string | undefined {
    const extra = Constants.expoConfig?.extra as
        { eas?: { projectId?: string } } | undefined;

    return extra?.eas?.projectId;
}

async function ensureAndroidChannel(): Promise<void> {
    if (Platform.OS !== "android") return;

    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: "TDN",
        importance: Notifications.AndroidImportance.HIGH,
        // Left at the platform defaults otherwise: a vibration pattern and a
        // light colour are things a phone already has an opinion about, and
        // overriding them is how an app ends up buzzing differently from
        // everything else on the device.
    });
}

/**
 * The last response acted on, so one tap is not acted on twice.
 *
 * Module scope rather than per subscription: a remount produces a new
 * subscription, and the thing being guarded against is precisely a response
 * outliving the subscription that handled it.
 */
let lastHandledId: string | null = null;

export const expoPush: PushPort = {
    getPermission: async (): Promise<PushPermission> => {
        const status = await Notifications.getPermissionsAsync();

        if (status.granted) return "granted";

        // `canAskAgain` is the distinction that matters. Android 13+ shows the
        // dialog once; after a refusal it returns immediately without showing
        // anything, so `undetermined` is the only state in which asking is
        // still an action rather than a no-op.
        return status.canAskAgain ? "undetermined" : "denied";
    },

    requestPermission: async (): Promise<boolean> => {
        // Before the dialog, not after: on Android the channel is what the
        // permission is exercised through, and a phone that grants permission
        // and then receives something with no channel shows nothing.
        await ensureAndroidChannel();

        const status = await Notifications.requestPermissionsAsync();
        return status.granted;
    },

    getToken: async (): Promise<string | null> => {
        await ensureAndroidChannel();

        const id = projectId();

        if (!id) {
            // A build-configuration fact rather than a runtime failure, and it
            // is the state of this repo today: there is no EAS project yet.
            // Warned rather than thrown, because push being unavailable is not
            // a reason for the app not to start.
            // eslint-disable-next-line no-console
            console.warn(
                "Push token skipped — no extra.eas.projectId in the app config.",
            );
            return null;
        }

        try {
            const token = await Notifications.getExpoPushTokenAsync({
                projectId: id,
            });
            return token.data;
        } catch {
            /*
             * Expo mints the token on its servers, so this is a network call
             * and fails the way network calls do — offline, timed out, or
             * unavailable in Expo Go, which stopped delivering remote push on
             * Android in SDK 53.
             *
             * `null` rather than a throw: the caller registers a device at
             * every launch, so the next one is the retry, and the one thing
             * that must not happen is a failed token read taking a launch with
             * it.
             */
            return null;
        }
    },

    onTapped: (listener) => {
        /*
         * One tap can arrive twice.
         *
         * A cold start delivers the response through the listener *and* leaves
         * it as the last response for the read below, and there is no ordering
         * between them. Both then navigate, and the reader gets the same post
         * pushed onto the stack twice with a back button that goes nowhere
         * useful. The notification's own identifier is the same in both
         * deliveries, which is what makes them recognisable as one event.
         */
        const handle = (response: Notifications.NotificationResponse) => {
            const id = response.notification.request.identifier;

            if (id && id === lastHandledId) return;

            lastHandledId = id;

            /*
             * Cleared as part of handling it, not only on the cold-start path.
             *
             * The OS keeps the last response until somebody clears it, and
             * this subscription is rebuilt whenever the root layout remounts —
             * a sign-out and back in. Left in place, a tap handled an hour ago
             * would be replayed then, sending somebody to a post they have
             * already read for no reason they can see.
             */
            void Notifications.clearLastNotificationResponseAsync();

            listener(response.notification.request.content.data ?? {});
        };

        const subscription =
            Notifications.addNotificationResponseReceivedListener(handle);

        /*
         * The cold-start case, which the listener does not reliably cover.
         *
         * Tapping a notification for a closed app *starts* the app, and the
         * response exists before any JavaScript does. expo-notifications holds
         * the last one for exactly this.
         */
        let cancelled = false;

        void Notifications.getLastNotificationResponseAsync().then(
            (response) => {
                if (cancelled || !response) return;

                handle(response);
            },
        );

        return () => {
            cancelled = true;
            subscription.remove();
        };
    },
};
