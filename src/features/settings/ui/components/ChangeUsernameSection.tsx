import { useState } from "react";

import { AUTH_LIMITS, validateUsername } from "@shared/data/account-rules";
import type { UsernameProblem } from "@shared/data/account-rules";
import { Button } from "@shared/ui/Button";
import { FormStatus } from "./FormStatus";
import { SettingsSection } from "./SettingsSection";
import { TextField } from "@shared/ui/TextField";
import type { TranslationKey } from "@shared/i18n/translations";
import { useI18n } from "@shared/hooks/useI18n";
import { useUpdateUsername } from "../hooks/useUpdateUsername";

const PROBLEMS: Record<UsernameProblem, TranslationKey> = {
    tooShort: "settings.usernameTooShort",
    tooLong: "settings.usernameTooLong",
    invalidCharacters: "settings.usernameInvalid",
};

export interface ChangeUsernameSectionProps {
    /** The name the account now has, once the server has agreed to it. */
    onChanged: (username: string) => void;
}

export function ChangeUsernameSection({
    onChanged,
}: ChangeUsernameSectionProps) {
    const { t } = useI18n();
    const { submit, isSubmitting, error, succeeded, reset } =
        useUpdateUsername();
    const [value, setValue] = useState("");
    const [problem, setProblem] = useState<UsernameProblem | null>(null);

    const trimmed = value.trim();

    const handleSubmit = async () => {
        if (!trimmed || isSubmitting) return;

        const found = validateUsername(trimmed);
        setProblem(found);
        if (found) return;

        if (await submit(trimmed)) {
            setValue("");
            onChanged(trimmed);
        }
    };

    return (
        <SettingsSection title={t("settings.changeUsername")}>
            <TextField
                value={value}
                onChangeText={(next) => {
                    setValue(next);
                    setProblem(null);
                    reset();
                }}
                placeholder={t("settings.newUsernamePlaceholder")}
                error={problem ? t(PROBLEMS[problem]) : error}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username-new"
                maxLength={AUTH_LIMITS.usernameMax}
                returnKeyType="done"
                onSubmitEditing={() => void handleSubmit()}
            />
            <Button
                label={
                    isSubmitting
                        ? t("settings.saving")
                        : t("settings.updateUsername")
                }
                size="sm"
                className="self-start"
                loading={isSubmitting}
                disabled={!trimmed}
                onPress={() => void handleSubmit()}
            />
            <FormStatus
                error={null}
                success={succeeded ? t("settings.usernameSuccess") : null}
            />
        </SettingsSection>
    );
}
