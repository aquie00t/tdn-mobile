import { beforeEach, describe, expect, it } from "vitest";

import type { Notification } from "../../data/notification.types";
import { useNotificationStore } from "./notification.store";

const row = (isRead = false): Notification => ({
    recipientId: "me",
    issuerId: "u1",
    username: "ada",
    type: "LIKE",
    avatarUrl: "",
    referenceId: "p1",
    createdAt: "2026-09-10T00:00:00.000Z",
    isRead,
});

beforeEach(() => {
    useNotificationStore.setState({ notifications: [], unreadCount: 0 });
});

describe("the badge is never derived from the list", () => {
    it("does not move when a first page arrives", () => {
        // The bug this store was rewritten to stop: counting the unread rows
        // of a page caps the badge at the page size, so thirty-five unread
        // notifications rendered as twenty.
        useNotificationStore.getState().setUnreadCount(35);
        useNotificationStore.getState().setNotifications([row(), row()]);

        expect(useNotificationStore.getState().unreadCount).toBe(35);
    });

    it("does not move when a page is appended", () => {
        // The other half: recounting across an appended page wiped every
        // realtime increment, because the socket's payload cannot become a row.
        useNotificationStore.getState().setUnreadCount(3);
        useNotificationStore.getState().setNotifications([row()], true);

        expect(useNotificationStore.getState().unreadCount).toBe(3);
    });

    it("appends rather than replacing when told to", () => {
        useNotificationStore.getState().setNotifications([row()]);
        useNotificationStore.getState().setNotifications([row()], true);

        expect(useNotificationStore.getState().notifications).toHaveLength(2);
    });
});

describe("incrementUnread", () => {
    it("moves the count without touching the list", () => {
        useNotificationStore.getState().incrementUnread();

        expect(useNotificationStore.getState().unreadCount).toBe(1);
        expect(useNotificationStore.getState().notifications).toEqual([]);
    });
});

describe("addNotification", () => {
    it("puts an unread one on top and counts it", () => {
        useNotificationStore.getState().addNotification(row());

        expect(useNotificationStore.getState().unreadCount).toBe(1);
        expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });

    it("does not count one that arrives already read", () => {
        useNotificationStore.getState().addNotification(row(true));

        expect(useNotificationStore.getState().unreadCount).toBe(0);
    });
});

describe("markAllRead", () => {
    it("clears the badge and marks every row", () => {
        useNotificationStore.getState().setNotifications([row(), row()]);
        useNotificationStore.getState().setUnreadCount(2);

        useNotificationStore.getState().markAllRead();

        expect(useNotificationStore.getState().unreadCount).toBe(0);
        expect(
            useNotificationStore
                .getState()
                .notifications.every((n) => n.isRead),
        ).toBe(true);
    });
});
