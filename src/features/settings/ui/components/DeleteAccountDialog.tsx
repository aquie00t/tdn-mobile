import { useState } from "react";
import { View } from "react-native";

import { Button } from "@shared/ui/Button";
import { Modal } from "@shared/ui/Modal";
import { Text } from "@shared/ui/Text";
import { TextField } from "@shared/ui/TextField";
import { useDeleteAccount } from "../hooks/useDeleteAccount";
import { useI18n } from "@shared/hooks/useI18n";

export interface DeleteAccountDialogProps {
    visible: boolean;
    onClose: () => void;
    /** The sign-out that follows a deletion. See `useDeleteAccount`. */
    onDeleted: () => Promise<void>;
}

/**
 * The password, asked for again, in front of the one irreversible-looking
 * thing on the page.
 *
 * It cannot be dismissed while the request is out. Closing it then would leave
 * somebody on a settings page with no way to tell whether their account still
 * exists; waiting a second for the answer is the lesser cost.
 *
 * The confirm button is full width and red, and the way back sits under it —
 * on a phone the two are stacked rather than side by side, because the web's
 * "Yes, delete my account" does not fit half of a 360px row.
 */
export function DeleteAccountDialog({
    visible,
    onClose,
    onDeleted,
}: DeleteAccountDialogProps) {
    const { t } = useI18n();
    const { submit, isSubmitting, error, reset } = useDeleteAccount(onDeleted);
    const [password, setPassword] = useState("");
    const [isMissing, setIsMissing] = useState(false);

    const close = () => {
        setPassword("");
        setIsMissing(false);
        reset();
        onClose();
    };

    const handleConfirm = async () => {
        if (isSubmitting) return;

        if (!password) {
            setIsMissing(true);
            return;
        }

        await submit(password);
    };

    return (
        <Modal visible={visible} onClose={close} dismissible={!isSubmitting}>
            <View className="gap-4">
                <View className="gap-2">
                    <Text size="title">{t("settings.deleteAccountTitle")}</Text>
                    <Text size="small" tone="muted">
                        {t("settings.deleteAccountBody")}
                    </Text>
                </View>

                <View className="gap-2">
                    <Text size="small" tone="muted">
                        {t("settings.deleteAccountPasswordLabel")}
                    </Text>
                    <TextField
                        value={password}
                        onChangeText={(next) => {
                            setPassword(next);
                            setIsMissing(false);
                            reset();
                        }}
                        placeholder={t(
                            "settings.deleteAccountPasswordPlaceholder",
                        )}
                        error={
                            isMissing
                                ? t("settings.deleteAccountPasswordRequired")
                                : error
                        }
                        secureTextEntry
                        autoCapitalize="none"
                        autoComplete="current-password"
                        textContentType="password"
                        editable={!isSubmitting}
                        returnKeyType="go"
                        onSubmitEditing={() => void handleConfirm()}
                    />
                </View>

                <View className="gap-2">
                    <Button
                        label={
                            isSubmitting
                                ? t("settings.deleting")
                                : t("settings.deleteAccountConfirm")
                        }
                        variant="danger"
                        size="full"
                        loading={isSubmitting}
                        onPress={() => void handleConfirm()}
                    />
                    <Button
                        label={t("settings.cancel")}
                        variant="ghost"
                        size="full"
                        disabled={isSubmitting}
                        onPress={close}
                    />
                </View>
            </View>
        </Modal>
    );
}
