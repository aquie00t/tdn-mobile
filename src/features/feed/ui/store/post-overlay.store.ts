import { createOverlayStore } from "@shared/store/create-overlay-store";
import type { Post } from "../../data/feed.types";

/**
 * What the reader has changed about a post since it was last read.
 *
 * The feed's row and the detail screen hold their own copy of the same post,
 * and a like made on either has to show on the other. `create-overlay-store`
 * carries the reasoning; this is the post-shaped instance of it.
 */
export const usePostOverlayStore = createOverlayStore<Post>();

export { withOverlay } from "@shared/store/create-overlay-store";
