import { create } from "zustand";

interface ArticleRevisionState {
    /** How many times each article has been saved from this device, by id. */
    revisions: Record<string, number>;
    bump: (articleId: string) => void;
}

/**
 * Tells a reading screen that the article it holds was written to.
 *
 * The editor saves as it closes — on the way back, not before — so a reading
 * screen that re-read on focus would ask for the article while the last save
 * was still in the air, get the text from before it, and never ask again. A
 * counter bumped when each save *lands* gives the screen something to follow
 * instead of a moment to guess at.
 *
 * A counter rather than the article itself: the reading screen owns its copy
 * and re-reads it from the server, which is also what fills in the fields a
 * save does not return in the shape the reader draws.
 */
export const useArticleRevisionStore = create<ArticleRevisionState>((set) => ({
    revisions: {},
    bump: (articleId) =>
        set((state) => ({
            revisions: {
                ...state.revisions,
                [articleId]: (state.revisions[articleId] ?? 0) + 1,
            },
        })),
}));
