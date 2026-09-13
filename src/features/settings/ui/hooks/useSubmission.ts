import { useCallback, useState } from "react";

import { getErrorMessage } from "@shared/utils/error-handler";

/**
 * One form's trip to the server: whether it is in flight, what went wrong,
 * and whether it went through.
 *
 * The web writes this shape out once per form, three times over; here it is
 * written once and each hook supplies the request.
 *
 * `submit` resolves to whether it worked, because a caller cannot read `error`
 * straight after awaiting — its closure still holds the render the submit
 * started in.
 *
 * **Not optimistic**, which is the exception `docs/roadmap.md` records. These
 * are submissions the server judges: a username can be taken and a current
 * password wrong, and showing the change before the answer would show a name
 * that was never yours for as long as the request took.
 *
 * @param action - The request. Stable across renders, or `submit` is not.
 */
export function useSubmission<TArgs extends unknown[]>(
    action: (...args: TArgs) => Promise<void>,
) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [succeeded, setSucceeded] = useState(false);

    const submit = useCallback(
        async (...args: TArgs): Promise<boolean> => {
            setIsSubmitting(true);
            setError(null);
            setSucceeded(false);

            try {
                await action(...args);
                setSucceeded(true);
                return true;
            } catch (err) {
                setError(getErrorMessage(err));
                return false;
            } finally {
                setIsSubmitting(false);
            }
        },
        [action],
    );

    /** Clears the last outcome, for when the person starts typing again. */
    const reset = useCallback(() => {
        setError(null);
        setSucceeded(false);
    }, []);

    return { submit, isSubmitting, error, succeeded, reset };
}
