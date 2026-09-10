/**
 * The colour roles are `tdn-client`'s, by the same names, so a screen can be
 * written from the web component beside it. `ground`/`ink`/`surface-1..3` swap
 * wholesale between themes; `scrim` and `on-fill` deliberately do not — a wash
 * over somebody's photo and the white on a red delete button contrast against
 * something the theme did not change.
 *
 * Values are space-separated RGB triples rather than hex so the `<alpha-value>`
 * slot works: `border-ink/10` is a faint light line on black and a faint dark
 * one on white, for free.
 *
 * Never write a raw colour utility (`bg-black`, `text-white`, `bg-zinc-900`,
 * `text-red-400`). They name a pixel rather than a role, so they cannot follow
 * a theme — one of them anywhere is a spot that stays dark on a light screen.
 *
 * That covers the accents too, which is where this diverges from the web.
 * There, `red-400` and friends keep Tailwind's names and have their 300–500
 * shades redefined under the light theme; `index.css` says plainly that
 * semantic names would have been better and that renaming them across nine
 * hundred call sites was the only reason they are not. Nothing here needs
 * migrating, so `danger`, `success` and `accent` are roles from the start,
 * carrying the web's values on both sides.
 *
 * `like` is the one role named for a feature rather than a meaning, and it is
 * the exception that proves the rest: the web tints a liked heart `pink-500`
 * and that pink means exactly one thing in the product. The alternatives were
 * worse — `danger` is the only red here and it reads as "this will destroy
 * something", which is not what a heart is saying.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{ts,tsx}"],
    /**
     * Not "media". The app shipped dark, exactly as the web client did, so
     * following the OS would repaint it white for every account whose phone is
     * set light — which none of them asked for. The theme store owns the
     * choice and sets the colour scheme itself.
     */
    darkMode: "class",
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                ground: "rgb(var(--color-ground) / <alpha-value>)",
                ink: "rgb(var(--color-ink) / <alpha-value>)",
                "ink-hover": "rgb(var(--color-ink-hover) / <alpha-value>)",
                "surface-1": "rgb(var(--color-surface-1) / <alpha-value>)",
                "surface-2": "rgb(var(--color-surface-2) / <alpha-value>)",
                "surface-3": "rgb(var(--color-surface-3) / <alpha-value>)",
                danger: "rgb(var(--color-danger) / <alpha-value>)",
                success: "rgb(var(--color-success) / <alpha-value>)",
                accent: "rgb(var(--color-accent) / <alpha-value>)",
                like: "rgb(var(--color-like) / <alpha-value>)",
                scrim: "rgb(var(--color-scrim) / <alpha-value>)",
                "on-fill": "rgb(var(--color-on-fill) / <alpha-value>)",
            },
        },
    },
    plugins: [],
};
