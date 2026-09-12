import { useCallback, useEffect, useState } from "react";

import { deviceDescriptor } from "@core/push/device-descriptor";
import { platform } from "@core/platform";
import type { PushPermission } from "@core/platform/push.port";
import { syncDevice } from "@core/push/device-registration";
import { useLanguageStore } from "@shared/store/language.store";
import { usePushPromptStore } from "../store/push-prompt.store";

export interface PushPermissionPrompt {
    /** Whether there is anything to show. */
    isVisible: boolean;
    /** Whether the OS dialog is up. */
    isAsking: boolean;
    /** Shows the dialog, and registers the phone if it is granted. */
    enable: () => Promise<void>;
    /** "Not now", remembered across launches. */
    dismiss: () => void;
}

/**
 * Decides whether to ask for the notification permission, and asks.
 *
 * **The timing is the feature.** Android 13+ shows this dialog once per
 * install: a refusal takes `canAskAgain` away and no later attempt shows
 * anything at all, so the moment it is spent decides whether most people end
 * up with notifications or most do not. Asked at first launch — before a
 * single notification exists — it is a dialog about nothing, and the safe
 * answer to a dialog about nothing is no.
 *
 * So it is asked from the notifications screen, with notifications on it. The
 * question then has an obvious referent: these, on your lock screen, when the
 * app is closed. The caller is responsible for the last part of the condition
 * — the list being non-empty — because only it knows what it is rendering.
 *
 * The permission is read once when the screen mounts rather than on every
 * focus. It cannot change without going through this hook or the OS settings,
 * and re-reading it would be a native call on every tab switch to learn
 * something that is almost never different.
 */
export function usePushPermissionPrompt(): PushPermissionPrompt {
    const dismissed = usePushPromptStore((s) => s.dismissed);
    const dismiss = usePushPromptStore((s) => s.dismiss);
    const locale = useLanguageStore((s) => s.locale);

    const [permission, setPermission] = useState<PushPermission | null>(null);
    const [isAsking, setIsAsking] = useState(false);

    useEffect(() => {
        let cancelled = false;

        platform.push
            .getPermission()
            .then((status) => {
                if (!cancelled) setPermission(status);
            })
            .catch(() => {
                // Unreadable permission means no card. Whatever went wrong
                // here, guessing "undetermined" would put a button on screen
                // that opens nothing.
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const enable = useCallback(async () => {
        setIsAsking(true);

        try {
            const granted = await platform.push.requestPermission();

            setPermission(granted ? "granted" : "denied");

            /*
             * Registered here as well as at launch, because otherwise the
             * first notification would arrive after the next restart: the
             * launch hook already ran and found no permission, and nothing
             * else would ask again until the app is reopened.
             */
            if (granted) await syncDevice(deviceDescriptor(locale));
        } catch {
            // A dialog that would not open. The card goes away either way —
            // offering it again would ask the same question of the same
            // broken call.
            setPermission("denied");
        } finally {
            setIsAsking(false);
        }
    }, [locale]);

    return {
        // `undetermined` is the only state worth a card: `granted` has nothing
        // to ask for, and `denied` cannot be asked — Android answers that
        // request without showing anything, so a button there is a button that
        // does nothing.
        isVisible: permission === "undetermined" && !dismissed,
        isAsking,
        enable,
        dismiss,
    };
}
