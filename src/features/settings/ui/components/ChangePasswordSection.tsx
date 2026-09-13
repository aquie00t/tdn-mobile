import { useState } from "react";

import { Button } from "@shared/ui/Button";
import { FormStatus } from "./FormStatus";
import type { NewPasswordProblem } from "@shared/data/account-rules";
import { SettingsSection } from "./SettingsSection";
import { TextField } from "@shared/ui/TextField";
import type { TranslationKey } from "@shared/i18n/translations";
import { useI18n } from "@shared/hooks/useI18n";
import { useUpdatePassword } from "../hooks/useUpdatePassword";
import { validateNewPassword } from "@shared/data/account-rules";

const PROBLEMS: Record<NewPasswordProblem, TranslationKey> = {
    mismatch: "settings.passwordMismatch",
    tooShort: "settings.passwordTooShort",
};

export function ChangePasswordSection() {
    const { t } = useI18n();
    const { submit, isSubmitting, error, succeeded, reset } =
        useUpdatePassword();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [problem, setProblem] = useState<NewPasswordProblem | null>(null);

    const isFilled = !!currentPassword && !!newPassword && !!confirmation;

    const handleSubmit = async () => {
        if (!isFilled || isSubmitting) return;

        const found = validateNewPassword(newPassword, confirmation);
        setProblem(found);
        if (found) return;

        if (await submit({ currentPassword, newPassword })) {
            setCurrentPassword("");
            setNewPassword("");
            setConfirmation("");
        }
    };

    /** Any keystroke retracts the verdict on the previous attempt. */
    const edit = (setter: (value: string) => void) => (value: string) => {
        setter(value);
        setProblem(null);
        reset();
    };

    return (
        <SettingsSection title={t("settings.changePassword")}>
            <TextField
                value={currentPassword}
                onChangeText={edit(setCurrentPassword)}
                placeholder={t("settings.currentPasswordPlaceholder")}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
            />
            <TextField
                value={newPassword}
                onChangeText={edit(setNewPassword)}
                placeholder={t("settings.newPasswordPlaceholder")}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
            />
            <TextField
                value={confirmation}
                onChangeText={edit(setConfirmation)}
                placeholder={t("settings.confirmPasswordPlaceholder")}
                error={problem ? t(PROBLEMS[problem]) : null}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={() => void handleSubmit()}
            />
            <Button
                label={
                    isSubmitting
                        ? t("settings.saving")
                        : t("settings.updatePassword")
                }
                size="sm"
                className="self-start"
                loading={isSubmitting}
                disabled={!isFilled}
                onPress={() => void handleSubmit()}
            />
            <FormStatus
                error={error}
                success={succeeded ? t("settings.passwordSuccess") : null}
            />
        </SettingsSection>
    );
}
