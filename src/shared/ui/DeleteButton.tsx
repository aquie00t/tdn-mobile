import { useState } from "react";
import { Pressable, View } from "react-native";

import { Button } from "./Button";
import { DeleteIcon } from "./icons/lucide";
import { Modal } from "./Modal";
import { Text } from "./Text";
import { useI18n } from "../hooks/useI18n";

export interface DeleteButtonProps {
    /** The question — "Delete post?". */
    title: string;
    /** What deleting means. */
    body: string;
    /**
     * Anything else that goes with it, said in `danger` under the body — a
     * post's quotes, which the server deletes along with it.
     */
    warning?: string | null;
    onConfirm: () => void;
    /** Matches the card's other controls. */
    size?: number;
}

/**
 * The bin on your own post or comment, and the question before it acts.
 *
 * Asked every time, because nothing brings the content back: the API deletes
 * the row, its replies or its quotes with it, and there is no undo. It is the
 * one control on a card that does not act on a tap.
 *
 * It takes the place the report control has on somebody else's card — the two
 * are never on the same content, because you report what is not yours and
 * delete what is.
 */
export function DeleteButton({
    title,
    body,
    warning,
    onConfirm,
    size = 16,
}: DeleteButtonProps) {
    const { t } = useI18n();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("common.delete")}
                onPress={() => setIsOpen(true)}
                hitSlop={10}
                className="flex-row items-center"
            >
                <DeleteIcon size={size} className="text-ink/40" />
            </Pressable>

            <Modal visible={isOpen} onClose={() => setIsOpen(false)}>
                <View className="gap-2">
                    <Text size="lead" className="font-semibold">
                        {title}
                    </Text>
                    <Text size="small" tone="muted">
                        {body}
                    </Text>
                    {warning ? (
                        <Text size="small" tone="danger">
                            {warning}
                        </Text>
                    ) : null}
                </View>
                <View className="mt-6 flex-row justify-end gap-2">
                    <Button
                        label={t("common.cancel")}
                        variant="outline"
                        size="sm"
                        onPress={() => setIsOpen(false)}
                    />
                    <Button
                        label={t("common.delete")}
                        variant="danger"
                        size="sm"
                        onPress={() => {
                            setIsOpen(false);
                            onConfirm();
                        }}
                    />
                </View>
            </Modal>
        </>
    );
}
