import { api } from "@core/api/client";
import {
    REPORT_DETAILS_MAX_LENGTH,
    type CreateReportBody,
    type CreateReportResponse,
    type ReportReason,
    type ReportTargetKind,
} from "./report.types";

/**
 * The body for one report, from what the dialog holds.
 *
 * The free text is trimmed and **left out when nothing is left**: the schema
 * validates `details` as 1–500 characters when present, so `""` is a 400
 * rather than "no comment". It is also cut to the cap here, so the one limit
 * the server enforces cannot be reached from a paste.
 */
export function reportBody(
    targetKind: ReportTargetKind,
    targetId: string,
    reason: ReportReason,
    details: string,
): CreateReportBody {
    const trimmed = details.trim().slice(0, REPORT_DETAILS_MAX_LENGTH);

    return {
        targetKind,
        targetId,
        reason,
        ...(trimmed ? { details: trimmed } : {}),
    };
}

/**
 * Reporting, in `shared/` because two features carry the control: the post
 * card and the comment card.
 *
 * Authenticated, rate limited to five a minute (SENSITIVE). There is no read
 * side and no status endpoint, on purpose: serving the queue would publish
 * what an account has been accused of. An operator reads it from the database
 * and closes it by hand.
 */
export const reportApi = {
    create: (body: CreateReportBody): Promise<CreateReportResponse> =>
        api.post<CreateReportResponse>("/reports", body),
};
