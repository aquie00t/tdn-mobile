import { useState } from "react";
import { Pressable, View } from "react-native";

import { BlockIcon } from "@shared/ui/icons/lucide";
import { Button } from "@shared/ui/Button";
import { Modal } from "@shared/ui/Modal";
import { Text } from "@shared/ui/Text";
import { useBlockAction } from "@shared/hooks/useBlockAction";
import { useI18n } from "@shared/hooks/useI18n";

export interface BlockToggleProps {
    /** `null` when the profile carries no usable id — the control is inert. */
    targetId: string | null;
    username: string;
    isBlocked: boolean;
    /**
     * Called once the server has answered, never before. The caller re-reads
     * the profile rather than being handed a patched copy: a block also tears
     * down both follows and zeroes the counts, and guessing all of that from
     * here is how two parts of one header come to disagree.
     */
    onChange: () => void;
}

/**
 * The block control on a profile header.
 *
 * Asymmetric on purpose, as on the web. **Blocking asks first** — it hides an
 * account from you and you from it, and drops both follows on the way in, none
 * of which the screen afterwards can show being undone. **Unblocking does
 * not** — it is the reversible direction, and a confirmation on the way out of
 * a state somebody chose to leave is a dialog nobody reads.
 *
 * Nothing announces the outcome. A block that worked replaces the timeline
 * with the notice and the button with "Unblock"; one that failed leaves the
 * dialog open with its button back, to try again or cancel.
 *
 * An icon beside the follow button rather than a menu, because there is no
 * menu anywhere in this app to put it in.
 */
export function BlockToggle({
    targetId,
    username,
    isBlocked,
    onChange,
}: BlockToggleProps) {
    const { t } = useI18n();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const { block, unblock, isPending } = useBlockAction();

    const handleBlock = async () => {
        if (!(await block(targetId))) return;

        setIsConfirmOpen(false);
        onChange();
    };

    const handleUnblock = async () => {
        if (!(await unblock(targetId))) return;

        onChange();
    };

    if (isBlocked) {
        return (
            <Button
                label={isPending ? t("block.working") : t("block.unblock")}
                variant="outline"
                size="sm"
                loading={isPending}
                disabled={!targetId}
                onPress={() => void handleUnblock()}
            />
        );
    }

    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("block.action")}
                disabled={!targetId || isPending}
                onPress={() => setIsConfirmOpen(true)}
                hitSlop={6}
                className="h-9 w-9 items-center justify-center rounded-full border border-ink/20 active:bg-danger/10"
            >
                <BlockIcon size={16} className="text-ink/60" />
            </Pressable>

            <Modal
                visible={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                dismissible={!isPending}
            >
                <View className="gap-4">
                    <View className="gap-2">
                        <Text size="title">
                            {t("block.confirmTitle", { username })}
                        </Text>
                        <Text size="small" tone="muted">
                            {t("block.confirmBody")}
                        </Text>
                        <Text size="small" tone="subtle">
                            {t("block.confirmFollowNote")}
                        </Text>
                    </View>

                    <View className="gap-2">
                        <Button
                            label={
                                isPending
                                    ? t("block.working")
                                    : t("block.action")
                            }
                            variant="danger"
                            size="full"
                            loading={isPending}
                            onPress={() => void handleBlock()}
                        />
                        <Button
                            label={t("common.cancel")}
                            variant="ghost"
                            size="full"
                            disabled={isPending}
                            onPress={() => setIsConfirmOpen(false)}
                        />
                    </View>
                </View>
            </Modal>
        </>
    );
}
