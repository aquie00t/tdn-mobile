import {
    ArrowLeft,
    Bell,
    Bookmark,
    Camera,
    CircleUser,
    Clock,
    Compass,
    EyeOff,
    Gamepad2,
    Heart,
    Home,
    ImagePlus,
    Mail,
    MessageCircle,
    Monitor,
    Plus,
    Repeat2,
    RefreshCw,
    Send,
    Server,
    Settings,
    Share2,
    Smartphone,
    Sparkles,
    Users,
    X,
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

/** Getting back, and getting to the switches. */
export const SettingsIcon = themed(Settings);

export const BackIcon = themed(ArrowLeft);

/**
 * The five fields, in the order `CATEGORY_OPTIONS` names them, plus the mark
 * for a feed narrowed to the accounts you follow.
 */
export const FollowingIcon = themed(Users);
export const FrontendIcon = themed(Monitor);
export const BackendIcon = themed(Server);
export const MobileIcon = themed(Smartphone);
export const GameIcon = themed(Gamepad2);
export const AiIcon = themed(Sparkles);

/** Writing. */
export const SendIcon = themed(Send);
export const AddMediaIcon = themed(ImagePlus);

/**
 * Starting something, rather than sending it.
 *
 * The feed's write button began as the send glyph and was wrong: a paper
 * plane says "this goes now", and nothing goes when it is pressed — a
 * composer opens. Sending has its own control, at the top of that screen.
 */
export const CreateIcon = themed(Plus);
export const CameraIcon = themed(Camera);
export const CloseIcon = themed(X);

/** A post's actions, and the counters beside them. */
export const BookmarkIcon = themed(Bookmark);
export const ShareIcon = themed(Share2);

/** A post's three counters, in the order the web's card draws them. */
export const CommentIcon = themed(MessageCircle);
export const LikeIcon = themed(Heart);
export const QuoteIcon = themed(Repeat2);
