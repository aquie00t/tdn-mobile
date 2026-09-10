import { Stack } from "expo-router";

/**
 * The sign-in flow — and, on this client, the front door.
 *
 * Unlike the web, which lets a reader browse and only asks for a session when
 * they try to change something, the app is behind a sign-in wall: the gate in
 * the root layout sends anybody without a session here and keeps them here.
 *
 * These steps are routes rather than a store's `step` field, so navigation *is*
 * the state machine — the back button, the swipe and deep links all work
 * without anything being written for them.
 */
export default function AuthLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
            }}
        />
    );
}
