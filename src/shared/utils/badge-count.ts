/** Above this the exact number stops being worth the width it costs. */
const BADGE_MAX = 9;

/**
 * The number drawn on a tab, or `null` when there is nothing to draw.
 *
 * `null` rather than `"0"` so the caller renders nothing at all: a badge
 * showing zero is a badge that says there is something to look at.
 *
 * The cap is the web's. A tab bar gives each item a fifth of the screen — 72px
 * on a 360px phone — and the badge sits over the icon's corner, so a third
 * digit would reach the label beside it. "9+" is also all the number a person
 * acts on: the difference between ten and forty unread is not a difference in
 * what they do next.
 *
 * @param count - How many are unread
 * @returns The label, or `null` when the badge should not be drawn
 */
export function formatBadgeCount(count: number): string | null {
    if (!Number.isFinite(count) || count <= 0) return null;

    const whole = Math.floor(count);

    if (whole <= 0) return null;

    return whole > BADGE_MAX ? `${BADGE_MAX}+` : String(whole);
}
