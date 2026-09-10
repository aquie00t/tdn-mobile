import { Stack } from "expo-router";

/**
 * The Home tab's own stack.
 *
 * Detail screens live *inside* a tab rather than over the whole app, which is
 * what keeps the tab bar on screen while a post, a thread or a profile is
 * open. Pushed at the root they cover the navigator that draws the bar, and a
 * reader who opened somebody's profile loses every other way to move.
 *
 * Headers are off here as they are at the root: `ScreenHeader` draws its own,
 * for the reason the tab bar is drawn rather than configured — the navigator's
 * header takes colour values and every colour in this app is a role.
 */
export default function HomeStackLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
