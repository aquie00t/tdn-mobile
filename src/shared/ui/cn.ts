import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ClassValue } from "clsx";

/**
 * Joins class names and drops the losers of any conflict.
 *
 * Needed because "later in the string wins" is not how this resolves. Class
 * names become stylesheet rules, and two rules setting the same property at
 * the same specificity are settled by their order in the generated CSS — which
 * has nothing to do with the order they were written in the `className`. So
 * `cn("text-ink", "text-danger")` without the merge is a coin toss that lands
 * the same way every time and the wrong way half the time.
 *
 * `twMerge` resolves it by removing `text-ink` outright, which is what the
 * caller meant.
 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}
