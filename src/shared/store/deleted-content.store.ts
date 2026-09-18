import { create } from "zustand";

type IdSet = Record<string, true>;

interface DeletedContentState {
    /** Posts deleted from this device, by id. */
    posts: IdSet;
    /** Comments deleted from this device, by id. */
    comments: IdSet;
    markPost: (id: string) => void;
    unmarkPost: (id: string) => void;
    markComment: (id: string) => void;
    unmarkComment: (id: string) => void;
}

const without = (set: IdSet, id: string): IdSet => {
    const next = { ...set };
    delete next[id];
    return next;
};

/**
 * What the reader has deleted, so every list drops it at once.
 *
 * A deleted post is on more screens than the one it was deleted from — the
 * feed, the author's profile, the saved list, a tag view, its own detail
 * screen — and each of those holds its own copy of the rows. Removing it from
 * each list in turn would mean every list exposing a way to be reached, and
 * every delete knowing all of them. Instead the cards read this: a card whose
 * content is in here draws nothing, wherever it is.
 *
 * It is also what makes the delete optimistic without bookkeeping. Marking is
 * the whole of the optimistic step, and unmarking is the whole of the
 * rollback: the rows were never taken out of anybody's state, so they come
 * back exactly where they were.
 *
 * Not persisted. After a restart every list is read fresh, and a deleted post
 * is not in any of them.
 */
export const useDeletedContentStore = create<DeletedContentState>((set) => ({
    posts: {},
    comments: {},
    markPost: (id) => set((s) => ({ posts: { ...s.posts, [id]: true } })),
    unmarkPost: (id) => set((s) => ({ posts: without(s.posts, id) })),
    markComment: (id) =>
        set((s) => ({ comments: { ...s.comments, [id]: true } })),
    unmarkComment: (id) => set((s) => ({ comments: without(s.comments, id) })),
}));

/**
 * Whether a post is gone: deleted itself, or quoting one that was.
 *
 * The second half is the server's rule, not a choice made here. `quotedPost`
 * is `onDelete: Cascade`, so deleting a post deletes every quote of it —
 * other people's included — and leaves no tombstone. A quote still on screen
 * would open to a 404.
 *
 * @param post - The post as a card holds it
 * @param deleted - The ids deleted from this device
 */
export function isPostGone(
    post: { id: string; quotedPost?: { id: string } | null },
    deleted: IdSet,
): boolean {
    if (deleted[post.id]) return true;
    return Boolean(post.quotedPost && deleted[post.quotedPost.id]);
}
