import {
    AiIcon,
    BackendIcon,
    FrontendIcon,
    GameIcon,
    MobileIcon,
} from "../ui/icons/lucide";
import type { LucideIcon } from "lucide-react-native";
import type { TranslationKey } from "../i18n/translations";

/**
 * The five fields the API knows about, and the taxonomy the whole system uses:
 * it tags posts and articles, and onboarding borrows it to ask a new account
 * what it is here for.
 *
 * Shared rather than declared per screen, and the web's own note says why —
 * the feed's filter chips and the onboarding picker have to offer the same
 * five in the same order, or a field chosen at sign-up has no chip to match it
 * later.
 *
 * The values are the API's `PostCategory`, spelled out rather than imported:
 * this file is in `shared/` and may not reach into a feature. A mismatch would
 * be a 400 on the first request rather than something that hides.
 */
export type CategoryValue = "FRONTEND" | "BACKEND" | "MOBILE" | "GAME" | "AI";

export interface CategoryOption {
    labelKey: TranslationKey;
    value: CategoryValue;
    Icon: LucideIcon;
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
    { labelKey: "feed.frontend", value: "FRONTEND", Icon: FrontendIcon },
    { labelKey: "feed.backend", value: "BACKEND", Icon: BackendIcon },
    { labelKey: "feed.mobile", value: "MOBILE", Icon: MobileIcon },
    { labelKey: "feed.game", value: "GAME", Icon: GameIcon },
    { labelKey: "feed.ai", value: "AI", Icon: AiIcon },
];
