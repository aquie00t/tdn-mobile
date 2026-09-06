export class NetworkError extends Error {
    constructor(message = "Network request failed") {
        super(message);
        this.name = "NetworkError";
    }
}

export interface ApiResponse<T, M = unknown> {
    data: T;
    meta?: M;
}

/**
 * The `meta` of a cursor-paginated listing.
 *
 * `nextCursor` is opaque: echo it back verbatim and never parse, build or
 * interpret one. It is `null` at the end of a listing, and a cursor the server
 * cannot decode is not an error — it answers with the first page.
 *
 * There is deliberately no total and no page number. A conversation list
 * reorders whenever a message arrives, so both would be stale by the next
 * request.
 */
export interface CursorMeta {
    timestamp: string;
    nextCursor: string | null;
}

/** RFC 7807. Every error the API renders arrives in this shape. */
export interface ApiErrorResponse {
    type: string;
    title: string;
    status: number;
    detail: string;
    instance: string;
    validation?: ValidationErrorDetail[];
}

export interface ValidationErrorDetail {
    instancePath: string;
    schemaPath: string;
    keyword: string;
    params: Record<string, unknown>;
    message: string;
}

/**
 * The session as the API hands it to a native client.
 *
 * `refreshToken` and `refreshTokenExpiresAt` are optional in the schema because
 * a browser is answered through its cookie and never sees them. This client
 * always asks on the body channel, so it always gets them — but they stay
 * optional here, because that is what the server promises.
 *
 * Both timestamps are unix **seconds**, not milliseconds. Passing one to
 * `new Date()` unconverted lands in 1970.
 */
export interface SessionResponse {
    accessToken: string;
    expiresAt: number;
    refreshToken?: string;
    refreshTokenExpiresAt?: number;
    user: {
        id: string;
        username: string;
        isEmailVerified?: boolean;
    };
}
