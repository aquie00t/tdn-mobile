import { api } from "@core/api/client";
import type { BotListParams, BotProfile } from "./bot.types";

/**
 * The endpoint's ceiling, and one page is the whole flow for almost everyone:
 * the thinnest field carries enough bots to pass `MIN_FOLLOWS` several times
 * over. The second page exists for somebody who wants to keep looking, not
 * for the requirement.
 *
 * `limit` is clamped rather than sent: the schema answers an out-of-range
 * value with a 400, and a list that renders an error instead of accounts is
 * worse than a shorter page.
 */
export const BOT_LIST_MAX_LIMIT = 50;
export const BOT_PAGE_SIZE = 50;

/**
 * The endpoint accepts a comma-joined value, a repeated key and a single
 * value, and all three mean the same thing. Comma-joined is the one to send: a
 * bot matches on *any* of the categories, so several fields are one request
 * rather than one request per field — which would fetch the same bots
 * repeatedly and spend the budget doing it.
 */
function botListQuery({
    categories = [],
    limit = BOT_PAGE_SIZE,
    offset = 0,
}: BotListParams): string {
    const query = new URLSearchParams();

    if (categories.length > 0) query.set("categories", categories.join(","));

    query.set(
        "limit",
        String(Math.min(Math.max(limit, 1), BOT_LIST_MAX_LIMIT)),
    );
    query.set("offset", String(offset));

    return query.toString();
}

export const botApi = {
    /**
     * The news bots publishing in the chosen fields, ranked by follower count.
     *
     * **Deliberately not `isPublic`.** Auth is optional on this endpoint, but
     * the token is what fills `isFollowing` — without it every bot comes back
     * `false`, and a returning account is handed its own follows back as fresh
     * suggestions.
     */
    getBots: (params: BotListParams = {}): Promise<BotProfile[]> =>
        api.get<BotProfile[]>(`/profiles/bots?${botListQuery(params)}`),
};
