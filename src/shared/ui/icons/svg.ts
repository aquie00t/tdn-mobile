import Svg from "react-native-svg";
import { cssInterop } from "nativewind";

/**
 * `Svg`, taught to take a `className`.
 *
 * Imported for the side effect as much as for the export: `cssInterop`
 * registers the mapping once, on first import, and every icon in this folder
 * comes through here so none of them can forget to.
 *
 * `color` is moved out of the resolved style and onto the prop of the same
 * name, which is what `react-native-svg` resolves `fill="currentColor"`
 * against. That is the whole trick, and it is what keeps a monochrome mark on
 * a *role*: `className="text-ink"` is a dark glyph on a light screen and a
 * light one on a dark screen, from the same token every other foreground uses.
 * Writing the hex here instead would be the thing the styling rules exist to
 * stop — a colour that names a pixel and cannot follow a theme.
 */
cssInterop(Svg, {
    className: {
        target: "style",
        nativeStyleToProp: { color: true },
    },
});

export { Svg };
export { Path } from "react-native-svg";
