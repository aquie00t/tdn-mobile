import { Pressable, View } from "react-native";
import { memo } from "react";
import { useRouter } from "expo-router";

import { Avatar } from "@shared/ui/Avatar";
import type {
    Notification,
    NotificationType,
} from "../../data/notification.types";
import { notificationTarget } from "../../domain/notification-target";
import { ProfileIcon } from "@shared/ui/icons/lucide";
import { Text } from "@shared/ui/Text";
import type { TranslationKey } from "@shared/i18n/translations";
import { useI18n } from "@shared/hooks/useI18n";

/**
 * One key per type.
 *
 * A `Record<NotificationType, …>` on purpose: a value missing from the union
 * is also missing from here without TypeScript noticing, which is exactly how
 * the web shipped a card that translated `undefined` and took the whole list
 * down with it. The lookup below still falls back, because the API owns the
 * enum and a newer server may send a type this build has never seen.
 */
const MESSAGE_KEYS: Record<NotificationType, TranslationKey> = {
    FOLLOW: "notif.follow",
    NEW_POST: "notif.newPost",
    LIKE: "notif.like",
    COMMENT: "notif.comment",
    COMMENT_LIKE: "notif.commentLike",
    COMMENT_REPLY: "notif.commentReply",
    QUOTE: "notif.quote",
    MENTION: "notif.mention",
    MEDIA_REJECTED: "notif.mediaRejected",
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatWhen(iso: string, locale: string): string {
    let formatter = formatters.get(locale);

    if (!formatter) {
        formatter = new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "short",
        });
        formatters.set(locale, formatter);
    }

    return formatter.format(new Date(iso));
}

function NotificationCardView({
    notification,
}: {
    notification: Notification;
}) {
    const { t, locale } = useI18n();
    const router = useRouter();

    const messageKey = MESSAGE_KEYS[notification.type] ?? "notif.generic";
    const target = notificationTarget(notification);

    /**
     * A platform notice carries the *recipient's* own name and face, because
     * there is no account to attribute it to. Showing them would tell the
     * reader they did this to themselves.
     */
    const isPlatformNotice = notification.type === "MEDIA_REJECTED";

    /*
     * The destinations live in the Home tab's stack, so opening one from here
     * moves to that tab and pushes there.
     *
     * Mounting copies of them under this tab is the other arrangement, and it
     * is not available: two files that both resolve to `/post/[id]` are a
     * route conflict — the same collision that took `/profile` out when two
     * groups each held an `index`. A screen can live at one URL, and a shared
     * link has to open the same thing the app does.
     */
    const open = () => {
        switch (target.kind) {
            case "post":
                router.push({
                    pathname: "/post/[id]",
                    params: { id: target.id },
                });
                return;
            case "comment":
                router.push({
                    pathname: "/comments/[id]",
                    params: { id: target.id },
                });
                return;
            case "profile":
                router.push({
                    pathname: "/profile/[username]",
                    params: { username: target.username },
                });
                return;
            default:
                // A rejection with nothing left to open. Pressing it does
                // nothing rather than guessing somewhere to go.
                return;
        }
    };

    return (
        <Pressable
            accessibilityRole="button"
            disabled={target.kind === "none"}
            onPress={open}
            className={
                notification.isRead
                    ? "flex-row items-center gap-3 border-b border-ink/5 px-4 py-3"
                    : "flex-row items-center gap-3 border-b border-ink/5 bg-ink/[0.04] px-4 py-3"
            }
        >
            {isPlatformNotice || notification.avatarUrl.length === 0 ? (
                <View className="h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-surface-1">
                    <ProfileIcon size={20} className="text-ink/40" />
                </View>
            ) : (
                <Avatar uri={notification.avatarUrl} size={40} />
            )}

            <View className="flex-1 gap-0.5">
                <Text size="small">
                    {t(messageKey, { username: notification.username })}
                </Text>
                <Text size="caption" tone="subtle">
                    {formatWhen(notification.createdAt, locale)}
                </Text>
            </View>

            {/* The row's own unread mark, since the tint alone is faint. */}
            {!notification.isRead && (
                <View className="h-2 w-2 rounded-full bg-accent" />
            )}
        </Pressable>
    );
}

/** Rows are recycled by the list; a notification does not change in place. */
export const NotificationCard = memo(NotificationCardView);
