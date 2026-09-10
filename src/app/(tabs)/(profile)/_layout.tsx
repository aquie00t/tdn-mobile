import { Stack } from "expo-router";

/**
 * The Profile tab's own stack — the same arrangement the Home tab has, and for
 * the same reason: settings opens inside the tab, so the bar below stays.
 */
export default function ProfileStackLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
