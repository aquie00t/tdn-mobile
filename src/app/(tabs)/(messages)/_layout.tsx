import { Stack } from "expo-router";

/**
 * The Messages tab's own stack.
 *
 * A thread opens *inside* the tab, as a post or a profile does inside Home:
 * pushed at the root it would cover the navigator that draws the bar, and
 * somebody reading a conversation would lose every other way to move.
 *
 * Headers are off here as they are everywhere else — `ScreenHeader` draws its
 * own, because the navigator's takes colour values and every colour in this
 * app is a role.
 */
export default function MessagesStackLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
