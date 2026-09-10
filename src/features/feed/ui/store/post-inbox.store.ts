import { create } from "zustand";

import type { Post } from "../../data/feed.types";

interface PostInboxState {
    /** Posts written on this device since the feed was last read. */
    created: Post[];
    add: (post: Post) => void;
    /** Dropped once the server's own listing has been read again. */
    clear: () => void;
}

/**
 * Posts the reader has just written, waiting to be shown.
 *
 * The composer is a screen of its own, so it cannot hand the new post to the
 * feed's hook the way the web's inline box hands it to `addPost` — by the time
 * it has an answer, the two are different components with no relationship. It
 * leaves the post here instead and the feed picks it up.
 *
 * Emptied when the feed re-reads its first page: the server is holding the
 * same post by then, and keeping a second copy is how a post appears twice.
 * `appendNewOnly` covers the window in between, where both have it.
 *
 * Not persisted. A post that survived a restart would be one the reader is
 * shown at the top of a feed that has long since caught up.
 */
export const usePostInboxStore = create<PostInboxState>((set) => ({
    created: [],

    add: (post) => set((state) => ({ created: [post, ...state.created] })),

    clear: () => set({ created: [] }),
}));
