import { useEffect, useState } from "react";

/**
 * A value that lags behind, so the work behind it runs once somebody stops
 * typing rather than on every keystroke.
 *
 * The value is debounced rather than the *request*, which is the difference
 * from the web's search hooks: they each own a timer, so one input driving two
 * searches would hold two timers for the same keystrokes and fire them
 * separately. Debounced here, both reads see the same settled query at the
 * same moment, and a screen can tell "still typing" from "still loading" by
 * comparing the two values.
 *
 * @param value - What is changing quickly
 * @param delayMs - How long it has to stay still
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [settled, setSettled] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setSettled(value), delayMs);

        // Cleared on every change, which is what makes this a debounce rather
        // than a queue: only the last value in a burst survives its own timer.
        return () => clearTimeout(timer);
    }, [value, delayMs]);

    return settled;
}
