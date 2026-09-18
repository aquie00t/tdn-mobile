import { useMemo } from "react";

import {
    isPostGone,
    useDeletedContentStore,
} from "../store/deleted-content.store";

type PostLike = { id: string; quotedPost?: { id: string } | null };

/**
 * A list's posts without the ones deleted from this device, or quoting one
 * that was.
 *
 * The cards draw nothing for a deleted post on their own, and that covers
 * every place a post appears. This is for the lists, because a row that draws
 * nothing is still a row: delete the only post on a profile and the list is
 * not empty, so it never says so. Filtered here, `ListEmptyComponent` sees
 * what the reader sees.
 *
 * The same array comes back while nothing has been deleted, so a list's
 * `data` does not change identity for no reason.
 *
 * @param posts - The rows as the list's hook holds them
 */
export function useWithoutDeletedPosts<T extends PostLike>(posts: T[]): T[] {
    const deleted = useDeletedContentStore((s) => s.posts);

    return useMemo(() => {
        if (Object.keys(deleted).length === 0) return posts;
        return posts.filter((post) => !isPostGone(post, deleted));
    }, [posts, deleted]);
}

/** The same, for comments. */
export function useWithoutDeletedComments<T extends { id: string }>(
    comments: T[],
): T[] {
    const deleted = useDeletedContentStore((s) => s.comments);

    return useMemo(() => {
        if (Object.keys(deleted).length === 0) return comments;
        return comments.filter((comment) => !deleted[comment.id]);
    }, [comments, deleted]);
}
