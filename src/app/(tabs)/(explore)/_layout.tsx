import { Stack } from "expo-router";

/**
 * The Explore tab's own stack.
 *
 * A tag opens *inside* the tab, for the reason the Home tab has one: pushed at
 * the root it would cover the navigator that draws the bar, and a reader who
 * tapped a trend would lose every other way to move.
 */
export default function ExploreStackLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
