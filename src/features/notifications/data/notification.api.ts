import { api } from "@core/api/client";
import type { Notification } from "./notification.types";

/** One page of the list. */
export const NOTIFICATION_PAGE_LIMIT = 20;

export const notificationApi = {
    /**
     * Not `isPublic`. A notification list is nobody's but the reader's, so a
     * request without a token has no meaning here — unlike a feed, which is
     * still worth showing on a stale session.
     */
    getNotifications: (
        page = 1,
        limit = NOTIFICATION_PAGE_LIMIT,
    ): Promise<Notification[]> =>
        api.get<Notification[]>(`/notifications?page=${page}&limit=${limit}`),

    /**
     * The badge's only source of truth.
     *
     * It used to be counted off the first page on the web, which capped the
     * badge at the page size: an account with thirty-five unread notifications
     * saw twenty. Paging did not fix it either — recounting across an appended
     * page wiped every realtime increment, because the socket's payload is too
     * thin to become a row that could be counted back.
     *
     * `apiClient` unwraps `ApiResponse.data`, so what lands here is the
     * `{ count }` envelope rather than the whole document.
     *
     * Called at boot and after a mark-all-read that failed ambiguously — never
     * on a timer. The socket delivers the increments.
     */
    getUnreadCount: (): Promise<number> =>
        api
            .get<{ count: number }>("/notifications/unread-count")
            .then((data) => data.count),

    markAllRead: (): Promise<void> =>
        api.patch<void>("/notifications/read-all", {}),
};
