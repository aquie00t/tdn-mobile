export interface Profile {
    /**
     * The account id, and the one every write about this profile carries.
     *
     * `GET /profiles/:username` sends this and does **not** send `userId`.
     * The web had those the other way round — `userId` required, `id`
     * optional — and nothing caught it, because a field the server never sends
     * still typechecks as a `string` at every call site. The failure only
     * appears at the far end, as a body whose key `JSON.stringify` quietly
     * dropped. Following someone reads this field, so getting it backwards is
     * a follow button that does nothing.
     */
    id: string;
    /** The older name for `id`. Kept for callers that still read it. */
    userId?: string;
    username: string;
    fullName: string;
    bio: string;
    location: string;
    avatarUrl: string;
    bannerUrl: string;
    socials: Record<string, string>;
    createdAt: string;
    updatedAt: string;
    followersCount: number;
    followingCount?: number;
    postCount: number;
    isMe: boolean;
    isFollowing: boolean;
    /**
     * You blocked this account. The profile is still served — answering 404
     * would leave a blocked reader unable to tell a block from a deleted
     * account, so they assume something is broken and keep trying.
     *
     * Optional because your own profile gets `false`, and because every
     * fixture written before blocking shipped omits both flags.
     */
    isBlocked?: boolean;
    /** This account blocked you. See {@link Profile.isBlocked}. */
    isBlockedBy?: boolean;
}

export interface FollowUser {
    userId: string;
    username: string;
    fullName: string;
    avatarUrl: string;
    bio: string;
    isFollowing: boolean;
    isMe: boolean;
}

/** Which side of the relationship a list is showing. */
export type FollowListType = "followers" | "following";

export interface FollowListParams {
    limit?: number;
    offset?: number;
}
