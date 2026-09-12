import { api } from "@core/api/client";

/** The API's enum. `IOS` is here because the port is, not because it ships. */
export type DevicePlatform = "ANDROID" | "IOS";

export interface RegisterDeviceInput {
    /** The Expo push token, `ExponentPushToken[…]`. 1–512 characters. */
    token: string;
    platform: DevicePlatform;
    /** The build number this token was registered from. At most 32 characters. */
    appVersion?: string;
    /**
     * The language the lock screen is read in, as a BCP-47 tag. At most 16
     * characters.
     *
     * This is what the copy is written in — the API picks Turkish or English
     * from it per device, so it is the *device's* language and not the
     * profile's feed languages, which answer a different question.
     */
    locale?: string;
}

/**
 * Whether a row now exists for this token. Both routes answer the same shape.
 *
 * Deliberately thin on the server's side: whether the row was written, moved
 * from another account or already matched is not something a client can act
 * on, and "this token belongs to somebody else" is not something it should
 * learn.
 */
export interface DeviceActionResponse {
    registered: boolean;
}

export const deviceApi = {
    /**
     * Registers this phone for push.
     *
     * Called at **every** launch, not only the first. The platform can reissue
     * a token at any time, and re-registering is also the freshness signal the
     * API's retention sweep reads — a registration not seen for 90 days is
     * dropped as abandoned.
     *
     * A token is unique across the whole table rather than per account, so a
     * phone handed to somebody else produces the same token under a new user
     * and the row **moves**. That is the server's business; this sends the same
     * body either way.
     */
    register: (input: RegisterDeviceInput): Promise<DeviceActionResponse> =>
        api.post<DeviceActionResponse>("/devices", input),

    /**
     * Retires one token.
     *
     * A `DELETE` that carries a body, the same shape as `unfollow`: the token
     * is in the payload rather than the path, so it goes through the options
     * and the header has to be written by hand — the client only sets
     * `Content-Type` for a request it serialised itself, and without it the
     * server receives a body it will not parse.
     *
     * Scoped to the owner on the server, so knowing a token is not enough to
     * silence somebody else's phone.
     */
    unregister: (token: string): Promise<DeviceActionResponse> =>
        api.delete<DeviceActionResponse>("/devices", {
            body: JSON.stringify({ token }),
            headers: { "Content-Type": "application/json" },
        }),
};
