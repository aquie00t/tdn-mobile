import { View } from "react-native";

import { Button } from "../shared/ui/Button";
import { EmptyState } from "../shared/ui/EmptyState";
import { ErrorState } from "../shared/ui/ErrorState";
import { Screen } from "../shared/ui/Screen";
import { Spinner } from "../shared/ui/Spinner";
import { Text } from "../shared/ui/Text";
import { useAuthActions } from "../features/auth/ui/hooks/useAuthActions";
import { useI18n } from "../shared/hooks/useI18n";
import { useSessionStore } from "../core/session/session.store";
import { useTheme } from "../shared/hooks/useTheme";
import { useToastStore } from "../shared/store/toast.store";
import type { Theme } from "../shared/store/theme.store";

/**
 * Temporary. The design system is the only thing in the app so far, and a PR
 * that adds components nobody can look at is a PR reviewed on trust — so this
 * puts them on screen. PR 7 replaces it with the feed.
 */

const THEMES: Theme[] = ["dark", "light", "system"];

function Row({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <View className="gap-3 border-b border-ink/10 px-5 py-6">
            <Text size="caption" tone="subtle" className="uppercase">
                {label}
            </Text>
            {children}
        </View>
    );
}

export default function IndexScreen() {
    const { t, locale } = useI18n();
    const { theme, setTheme } = useTheme();
    const addToast = useToastStore((s) => s.addToast);
    const user = useSessionStore((s) => s.user);
    const { signOut } = useAuthActions();

    return (
        <Screen scroll>
            <View className="gap-1 px-5 pb-2 pt-6">
                <Text size="display">TDN</Text>
                <Text tone="muted">The Developer Network</Text>
            </View>

            <Row
                label={`session · @${user?.username}${user?.isEmailVerified ? "" : " · unverified"}`}
            >
                <Button
                    label="Sign out"
                    size="sm"
                    variant="outline"
                    onPress={() => void signOut()}
                />
            </Row>

            <Row label={`theme · ${theme}`}>
                <View className="flex-row gap-2">
                    {THEMES.map((option) => (
                        <Button
                            key={option}
                            label={option}
                            size="sm"
                            variant={theme === option ? "primary" : "outline"}
                            onPress={() => setTheme(option)}
                        />
                    ))}
                </View>
            </Row>

            <Row label="type">
                <Text size="display">Display</Text>
                <Text size="title">Title</Text>
                <Text size="lead">Lead</Text>
                <Text>Body</Text>
                <Text size="small" tone="muted">
                    Small, muted
                </Text>
                <Text size="caption" tone="subtle">
                    Caption, subtle
                </Text>
                <View className="flex-row gap-4">
                    <Text tone="danger">danger</Text>
                    <Text tone="success">success</Text>
                    <Text tone="accent">accent</Text>
                </View>
            </Row>

            <Row label="buttons">
                <View className="flex-row flex-wrap gap-2">
                    <Button label="Primary" size="sm" />
                    <Button label="Secondary" size="sm" variant="secondary" />
                    <Button label="Outline" size="sm" variant="outline" />
                    <Button label="Ghost" size="sm" variant="ghost" />
                </View>
                <Button label="Loading" size="sm" loading />
                <Button label="Full width" size="full" />
            </Row>

            <Row label="toasts">
                <View className="flex-row flex-wrap gap-2">
                    <Button
                        label="Error"
                        size="sm"
                        variant="outline"
                        onPress={() =>
                            addToast({
                                type: "error",
                                message: t("error.network"),
                            })
                        }
                    />
                    <Button
                        label="Success"
                        size="sm"
                        variant="outline"
                        onPress={() =>
                            addToast({
                                type: "success",
                                message: t("common.linkCopied"),
                            })
                        }
                    />
                    <Button
                        label="Info"
                        size="sm"
                        variant="outline"
                        onPress={() =>
                            addToast({
                                type: "info",
                                message: `locale: ${locale}`,
                            })
                        }
                    />
                </View>
            </Row>

            <Row label="states">
                <View className="h-32">
                    <Spinner center />
                </View>
                <View className="h-40">
                    <EmptyState
                        title={t("postList.empty")}
                        description={t("feed.community")}
                    />
                </View>
                <View className="h-40">
                    <ErrorState
                        message={t("error.network")}
                        onRetry={() =>
                            addToast({ type: "info", message: "retried" })
                        }
                    />
                </View>
            </Row>
        </Screen>
    );
}
