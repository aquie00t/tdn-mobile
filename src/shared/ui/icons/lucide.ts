import {
    ArrowLeft,
    Bell,
    Bookmark,
    CircleUser,
    Clock,
    Compass,
    EyeOff,
    Heart,
    Home,
    Mail,
    MessageCircle,
    Repeat2,
    RefreshCw,
    Send,
    Share2,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { cssInterop } from "nativewind";

/**
 * The icon set, taught to take a `className`.
 *
 * Lucide draws its glyphs with `stroke="currentColor"` and takes the colour as
 * a `color` prop, so the mapping is the one `icons/svg.ts` uses for the brand
 * marks: the resolved `color` style is moved onto the prop. What that buys is
 * the same thing — `className="text-ink/40"` is a role rather than a pixel, so
 * a tab that is not the current one is faint on both themes without either
 * value being written down.
 *
 * Registered here rather than at each call site because `cssInterop` mutates
 * the component it is given: doing it twice for one icon is harmless, doing it
 * zero times renders a black glyph on a black ground.
 */
function themed(icon: LucideIcon): LucideIcon {
    cssInterop(icon, {
        className: {
            target: "style",
            nativeStyleToProp: { color: true },
        },
    });

    return icon;
}

export const HomeIcon = themed(Home);
export const ExploreIcon = themed(Compass);
export const NotificationsIcon = themed(Bell);
export const MessagesIcon = themed(Mail);
export const ProfileIcon = themed(CircleUser);

/** Media: the cover over sensitive content, and the wait for a video. */
export const HiddenIcon = themed(EyeOff);
export const PendingIcon = themed(Clock);
export const RefreshIcon = themed(RefreshCw);

/** Getting back. */
export const BackIcon = themed(ArrowLeft);

/** Writing. */
export const SendIcon = themed(Send);

/** A post's actions, and the counters beside them. */
export const BookmarkIcon = themed(Bookmark);
export const ShareIcon = themed(Share2);

/** A post's three counters, in the order the web's card draws them. */
export const CommentIcon = themed(MessageCircle);
export const LikeIcon = themed(Heart);
export const QuoteIcon = themed(Repeat2);
