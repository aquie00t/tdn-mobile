import type { Comment } from "../../data/comment.types";
import { createOverlayStore } from "@shared/store/create-overlay-store";

/**
 * What the reader has changed about a comment since it was last read.
 *
 * A thread is a `FlatList` too, so a card keeping its own `isLiked` would lose
 * it the moment the row left the window — the same reason the feed has one of
 * these. Replies add a second reader of the same comment: one expanded under a
 * card is a row in its own right elsewhere.
 */
export const useCommentOverlayStore = createOverlayStore<Comment>();
