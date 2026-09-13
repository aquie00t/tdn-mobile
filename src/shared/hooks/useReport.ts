import { useCallback, useRef, useState } from "react";

import { getErrorMessage, isOurFailure } from "../utils/error-handler";
import { reportApi, reportBody } from "../data/report.api";
import type { ReportReason, ReportTargetKind } from "../data/report.types";
import { reportError } from "../utils/report-error";

/**
 * Files a report and says whether it landed.
 *
 * `error` holds only an answer the reader has to act on, shown in the dialog
 * beside the button: the content is gone (404), it is their own (400), or they
 * have sent five in a minute (429). A failure of ours — the network, a 500 —
 * leaves it empty and the dialog as it was, with the reason and the text still
 * in it to send again; the cause goes to `reportError`.
 *
 * The guard against a second request is a ref, as in `useBlockAction`: two
 * taps inside one frame both read the state from before either was handled,
 * and the second would spend one of five requests a minute.
 */
export function useReport() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inFlightRef = useRef(false);

    const submit = useCallback(
        async (
            targetKind: ReportTargetKind,
            targetId: string,
            reason: ReportReason,
            details: string,
        ): Promise<boolean> => {
            if (inFlightRef.current) return false;

            inFlightRef.current = true;
            setIsSubmitting(true);
            setError(null);

            try {
                await reportApi.create(
                    reportBody(targetKind, targetId, reason, details),
                );
                return true;
            } catch (err) {
                reportError("report", err);

                const message = getErrorMessage(err);
                if (!isOurFailure(message)) setError(message);
                return false;
            } finally {
                inFlightRef.current = false;
                setIsSubmitting(false);
            }
        },
        [],
    );

    const reset = useCallback(() => setError(null), []);

    return { submit, isSubmitting, error, reset };
}
