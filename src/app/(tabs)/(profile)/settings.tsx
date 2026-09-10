import { SettingsScreen } from "@features/settings/ui/screens/SettingsScreen";
import { useAuthActions } from "@features/auth/ui/hooks/useAuthActions";

/**
 * Settings reaches into two features — its own screen and the auth action that
 * ends a session — so the two meet in the route, which is the one place
 * allowed to import both.
 */
export default function SettingsRoute() {
    const { signOut } = useAuthActions();
    return <SettingsScreen onSignOut={() => void signOut()} />;
}
