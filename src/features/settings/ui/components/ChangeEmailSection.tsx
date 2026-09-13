import { useState } from "react";

import { AUTH_LIMITS, EMAIL_PATTERN } from "@shared/data/account-rules";
import { Button } from "@shared/ui/Button";
import { FormStatus } from "./FormStatus";
import { SettingsSection } from "./SettingsSection";
import { TextField } from "@shared/ui/TextField";
import { useI18n } from "@shared/hooks/useI18n";
import { useUpdateEmail } from "../hooks/useUpdateEmail";

export interface ChangeEmailSectionProps {
    /** The address the account now has — unverified, as the API stores it. */
    onChanged: (email: string) => void;
}

export function ChangeEmailSection({ onChanged }: ChangeEmailSectionProps) {
    const { t } = useI18n();
    const { submit, isSubmitting, error, succeeded, reset } = useUpdateEmail();
    const [value, setValue] = useState("");
    const [isMalformed, setIsMalformed] = useState(false);

    const trimmed = value.trim();

    const handleSubmit = async () => {
        if (!trimmed || isSubmitting) return;

        if (!EMAIL_PATTERN.test(trimmed)) {
            setIsMalformed(true);
            return;
        }

        if (await submit(trimmed)) {
            setValue("");
            onChanged(trimmed);
        }
    };

    return (
        <SettingsSection title={t("settings.changeEmail")}>
            <TextField
                value={value}
                onChangeText={(next) => {
                    setValue(next);
                    setIsMalformed(false);
                    reset();
                }}
                placeholder={t("settings.newEmailPlaceholder")}
                error={isMalformed ? t("settings.emailInvalid") : error}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                maxLength={AUTH_LIMITS.identifierMax}
                returnKeyType="done"
                onSubmitEditing={() => void handleSubmit()}
            />
            <Button
                label={
                    isSubmitting
                        ? t("settings.saving")
                        : t("settings.updateEmail")
                }
                size="sm"
                className="self-start"
                loading={isSubmitting}
                disabled={!trimmed}
                onPress={() => void handleSubmit()}
            />
            <FormStatus
                error={null}
                success={succeeded ? t("settings.emailSuccess") : null}
            />
        </SettingsSection>
    );
}
