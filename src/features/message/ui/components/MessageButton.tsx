import { View } from "react-native";

import { Button } from "@shared/ui/Button";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";
import { useOpenConversation } from "../hooks/useOpenConversation";

export interface MessageButtonProps {
    /** The account to write to. */
    recipientId: string;
}

/**
 * Writing to somebody from their profile.
 *
 * **Handed to `ProfileHeader` by the route rather than imported into it.** The
 * header belongs to the profile feature and this belongs to messaging, and a
 * feature may not import another — so the route, which may import both, passes
 * this down as a node. It is the same arrangement that composes the profile
 * screen out of a profile header and a feed list.
 *
 * The button is not disabled while the conversation is being opened, it is
 * `loading`: opening is idempotent, so a second tap costs a request and
 * nothing else, and a control that greys out with no spinner reads as broken.
 */
export function MessageButton({ recipientId }: MessageButtonProps) {
    const { t } = useI18n();
    const { open, isOpening, error } = useOpenConversation();

    return (
        <View className="items-end gap-1">
            <Button
                label={t("messages.newMessage")}
                size="sm"
                variant="outline"
                loading={isOpening}
                onPress={() => void open(recipientId)}
            />

            {/*
             * `InvalidRecipientError` covers four cases with one status — the
             * reader themselves, a bot, an account pending deletion, and a
             * block in either direction — and the server writes which. Nothing
             * here can improve on that, and a button that answered with
             * nothing would read as broken.
             */}
            {error && (
                <Text size="caption" tone="danger" className="max-w-[200px]">
                    {error}
                </Text>
            )}
        </View>
    );
}
