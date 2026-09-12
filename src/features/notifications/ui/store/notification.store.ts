import { create } from "zustand";

import type { Notification } from "../../data/notification.types";

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
    setNotifications: (list: Notification[], append?: boolean) => void;
    setUnreadCount: (count: number) => void;
    addNotification: (notification: Notification) => void;
    incrementUnread: () => void;
    markAllRead: () => void;
}

/**
 * The list and the badge are separate facts, and this store keeps them that
 * way on purpose.
 *
 * The count used to be derived from the list on every fresh first page, which
 * capped the badge at the page size — thirty-five unread notifications
 * rendered as twenty. Paging could not fix it either: recounting across an
 * appended page wiped every realtime `incrementUnread`, because the socket's
 * payload is too thin to become a `Notification` and so cannot be counted
 * back.
 *
 * `GET /notifications/unread-count` answers the question directly, so the
 * derivation is gone entirely. **The list never defines the count.** Restoring
 * that link in either branch of `setNotifications` brings back one bug or the
 * other, depending on the branch.
 *
 * Not persisted: a badge that survived a restart would be reporting a number
 * from a session that has since been read.
 */
export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    unreadCount: 0,

    setNotifications: (list, append = false) =>
        set((state) => ({
            notifications: append ? [...state.notifications, ...list] : list,
        })),

    /** Authoritative: what the server last said the count was. */
    setUnreadCount: (count) => set({ unreadCount: count }),

    addNotification: (notification) =>
        set((state) => ({
            notifications: [notification, ...state.notifications],
            unreadCount: notification.isRead
                ? state.unreadCount
                : state.unreadCount + 1,
        })),

    incrementUnread: () =>
        set((state) => ({ unreadCount: state.unreadCount + 1 })),

    markAllRead: () =>
        set((state) => ({
            notifications: state.notifications.map((notification) => ({
                ...notification,
                isRead: true,
            })),
            unreadCount: 0,
        })),
}));
