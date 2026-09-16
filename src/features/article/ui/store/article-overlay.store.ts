import type { ArticleSummary } from "../../data/article.types";
import { createOverlayStore } from "@shared/store/create-overlay-store";

/**
 * What the reader has changed about an article since it was last read.
 *
 * The list's card and the reading screen hold their own copy of the same
 * article, and a like made on either has to show on the other: tapping a card,
 * liking from the header and coming back must not leave an unfilled heart and
 * a count one low. `create-overlay-store` carries the reasoning; this is the
 * article-shaped instance of it, beside the feed's post-shaped one.
 *
 * `ArticleSummary` rather than `Article`, because that is the half both halves
 * share — the body belongs to the reading screen alone and nothing overlays it.
 */
export const useArticleOverlayStore = createOverlayStore<ArticleSummary>();

export { withOverlay } from "@shared/store/create-overlay-store";
