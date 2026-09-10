import { create } from "zustand";

interface Identified {
    id: string;
}

export interface OverlayStore<T extends Identified> {
    /** Changes to lay over an item, by id. */
    overlays: Record<string, Partial<T>>;
    patch: (id: string, changes: Partial<T>) => void;
    /** Dropped once the server's own copy has been read again. */
    clear: () => void;
}

/**
 * A store of what the reader has changed about something since it was last
 * read, keyed by id.
 *
 * Two problems, one shape. A `FlatList` row is unmounted as it leaves the
 * window and mounted again on the way back, so a card holding its own
 * `isLiked` loses it on the way past and re-seeds from a stale copy — the
 * reader watches their own like undo itself while scrolling. And the same item
 * is often on two screens at once: liking a post on its detail screen has to
 * show in the feed behind it.
 *
 * Storing the *change* rather than the whole item is what keeps this honest. A
 * full copy would go stale in every field nobody touched — an author renamed
 * or a count moved on the server would be frozen by a like made an hour ago. A
 * `Partial` freezes only what the reader themselves changed.
 *
 * A factory rather than one shared store, because the overlays are typed: a
 * post's `Partial` and a comment's are different shapes, and a single
 * `Record<string, unknown>` would let either be written into the other.
 *
 * Not persisted. An overlay outliving a restart would be showing a like whose
 * request may never have been sent.
 *
 * @returns A hook for one item type's overlays
 */
export function createOverlayStore<T extends Identified>() {
    return create<OverlayStore<T>>((set) => ({
        overlays: {},

        patch: (id, changes) =>
            set((state) => ({
                overlays: {
                    ...state.overlays,
                    [id]: { ...state.overlays[id], ...changes },
                },
            })),

        clear: () => set({ overlays: {} }),
    }));
}

/**
 * The item as it should be drawn.
 *
 * @param item - The server's copy
 * @param overlays - The whole overlay map
 * @returns The item with the reader's own changes on top
 */
export function withOverlay<T extends Identified>(
    item: T,
    overlays: Record<string, Partial<T>>,
): T {
    const overlay = overlays[item.id];
    return overlay ? { ...item, ...overlay } : item;
}
