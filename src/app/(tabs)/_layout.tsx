import { TabList, TabSlot, TabTrigger, Tabs } from "expo-router/ui";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TabBarButton } from "@shared/layout/TabBarButton";
import {
    ExploreIcon,
    HomeIcon,
    MessagesIcon,
    NotificationsIcon,
    ProfileIcon,
} from "@shared/ui/icons/lucide";
import { useNotificationStore } from "@features/notifications/ui/store/notification.store";
import { useSessionStore } from "@core/session/session.store";

/**
 * The app, once there is a session. Five tabs mirroring the web's `BottomNav`.
 *
 * Expo Router's **headless** tabs, from `expo-router/ui`, rather than the
 * configured navigator. The configured one is styled with colour *values* —
 * `tabBarActiveTintColor` and friends — and every colour in this app is a role
 * in `global.css`. Handing them over in JavaScript would mean writing each one
 * down again in hex, where no theme could reach it, and one of those anywhere
 * is a spot that stays dark on a light screen. Here the bar is ordinary views
 * with ordinary classes.
 *
 * `TabList asChild` hands its props to the `View` below and drops the wrapper
 * it would otherwise add; the trigger parser unwraps that layer on purpose, so
 * the five triggers still define the routes.
 *
 * Notifications and Messages carry the short labels — `nav.notifs`, `nav.msgs`
 * — for the reason the web uses them: a fifth of a 360px phone is 72px.
 * Messages holds the slot Saved has on the web's sidebar, which was a decision
 * rather than an omission: six tabs leave 60px each, and Saved is reachable
 * from a profile while the inbox had no way in at all.
 */
export default function TabsLayout() {
    const insets = useSafeAreaInsets();
    const avatarUrl = useSessionStore((s) => s.user?.avatarUrl);
    // PR 6 drew this badge and wrote that nothing filled it yet. This is it.
    const unreadCount = useNotificationStore((s) => s.unreadCount);

    return (
        <Tabs>
            {/*
             * Inactive tabs are detached rather than kept in the tree.
             *
             * By default every tab that has been opened stays rendered, so a
             * theme change repaints the feed, the profile and whatever else
             * has been visited — all at once, for one screen anybody can see.
             * Detached, they keep their state and their scroll position and
             * pay nothing until they are looked at again.
             */}
            <TabSlot detachInactiveScreens />

            <TabList asChild>
                <View
                    className="flex-row border-t border-ink/10 bg-ground"
                    // Inside the bar rather than under it: padding here fills
                    // the gesture strip with the bar's own background, where a
                    // margin would leave the ground showing through beneath.
                    style={{ paddingBottom: insets.bottom }}
                >
                    {/*
                     * The Home tab is a *group* — `(home)` — because it has a
                     * stack of its own, so a post, a thread or a profile opens
                     * inside the tab and the bar below stays where it is. The
                     * trigger names the group; the href is still the root.
                     */}
                    <TabTrigger name="(home)" href="/" asChild>
                        <TabBarButton icon={HomeIcon} label="nav.home" />
                    </TabTrigger>

                    <TabTrigger name="explore" href="/explore" asChild>
                        <TabBarButton icon={ExploreIcon} label="nav.explore" />
                    </TabTrigger>

                    <TabTrigger
                        name="notifications"
                        href="/notifications"
                        asChild
                    >
                        <TabBarButton
                            icon={NotificationsIcon}
                            label="nav.notifs"
                            badge={unreadCount}
                        />
                    </TabTrigger>

                    <TabTrigger name="messages" href="/messages" asChild>
                        <TabBarButton icon={MessagesIcon} label="nav.msgs" />
                    </TabTrigger>

                    <TabTrigger name="(profile)" href="/profile" asChild>
                        <TabBarButton
                            icon={ProfileIcon}
                            label="nav.profile"
                            avatarUrl={avatarUrl}
                        />
                    </TabTrigger>
                </View>
            </TabList>
        </Tabs>
    );
}
