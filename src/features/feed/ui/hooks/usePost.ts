import { useCallback, useState } from "react";

import { feedApi } from "../../data/feed.api";
import { getErrorMessage } from "@shared/utils/error-handler";
import type { Post } from "../../data/feed.types";
import { usePostOverlayStore, withOverlay } from "../store/post-overlay.store";

interface PostState {
    post: Post | null;
    isLoading: boolean;
    error: string | null;
}

/**
 * One post, read on its own.
 *
 * Fetched rather than handed over from the list, so the detail screen works
 * from a shared link as well as from a tap. The extra request is the price of
 * a URL that opens.
 *
 * The reader's own changes are laid over the answer, so arriving here does not
 * undo a like made a second earlier in the feed.
 *
 * The screen calls `fetchPost`, as it calls `fetchPosts` on `useFeed` and
 * `fetchComments` on `useComments`. Keeping the trigger with the screen is
 * what lets one screen decide to read a post and another decide not to.
 *
 * The initial state is already "loading" and `fetchPost` writes only once the
 * request has finished, so nothing raises a flag before the first render has
 * even been shown. `retry` does raise it, because it runs from a press.
 */
export function usePost(postId: string) {
    const [state, setState] = useState<PostState>({
        post: null,
        isLoading: true,
        error: null,
    });
    const overlays = usePostOverlayStore((s) => s.overlays);

    const fetchPost = useCallback(async () => {
        try {
            const post = await feedApi.getPostById(postId);
            setState({ post, isLoading: false, error: null });
        } catch (err) {
            setState({
                post: null,
                isLoading: false,
                error: getErrorMessage(err),
            });
        }
    }, [postId]);

    const retry = useCallback(() => {
        setState({ post: null, isLoading: true, error: null });
        void fetchPost();
    }, [fetchPost]);

    return {
        post: state.post ? withOverlay(state.post, overlays) : null,
        isLoading: state.isLoading,
        error: state.error,
        fetchPost,
        retry,
    };
}
