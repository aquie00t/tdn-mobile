import { EmptyState } from "@shared/ui/EmptyState";
import { Screen } from "@shared/ui/Screen";
import { ExploreIcon } from "@shared/ui/icons/lucide";
import { useI18n } from "@shared/hooks/useI18n";

/**
 * A placeholder. The tab exists so the shell can be walked end to end; what
 * goes in it is its own pull request.
 *
 * `bottom: false` because the bar below already covers that edge — padding
 * for it twice leaves a strip the ground shows through.
 */
export default function ExploreTab() {
    const { t } = useI18n();

    return (
        <Screen edges={{ top: true, bottom: false }}>
            <EmptyState
                title={t("nav.explore")}
                icon={<ExploreIcon size={28} className="text-ink/40" />}
            />
        </Screen>
    );
}
