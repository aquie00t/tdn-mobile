/**
 * What the API says about the build that asked.
 *
 * The comparison is the server's, deliberately, and the controller says why:
 * a client that compares the numbers itself is a client that can get the
 * comparison wrong, in a build that by definition cannot be replaced. So
 * `updateRequired` is read rather than derived, and the two numbers beside it
 * are context — they are not what the gate acts on.
 */
export interface ClientMeta {
    /** Oldest build the API will talk to. Zero means no floor is set. */
    minSupportedBuild: number;
    /** Newest build published, for an "update available" nudge this app does
     * not draw yet. */
    latestBuild: number;
    /**
     * Whether the build that asked must update before it can be used. Always
     * false when no build was supplied, and always false while no floor is
     * set — which is the state of the API today.
     */
    updateRequired: boolean;
    /** Where to send somebody to update. Empty when not configured. */
    storeUrl: string;
}
