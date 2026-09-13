import { useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";

import { Button } from "./Button";
import { Modal } from "./Modal";
import {
    REPORT_DETAILS_MAX_LENGTH,
    REPORT_REASONS,
    type ReportReason,
    type ReportTargetKind,
} from "../data/report.types";
import { Text } from "./Text";
import { TextField } from "./TextField";
import type { TranslationKey } from "../i18n/translations";
import { cn } from "./cn";
import { useI18n } from "../hooks/useI18n";
import { useReport } from "../hooks/useReport";

/** The label for each reason. A map rather than a built key, so a typo fails typechecking. */
const REASON_LABELS: Record<ReportReason, TranslationKey> = {
    SPAM: "report.reason.SPAM",
    HARASSMENT: "report.reason.HARASSMENT",
    HATE: "report.reason.HATE",
    SEXUAL: "report.reason.SEXUAL",
    VIOLENCE: "report.reason.VIOLENCE",
    SELF_HARM: "report.reason.SELF_HARM",
    MISINFORMATION: "report.reason.MISINFORMATION",
    ILLEGAL: "report.reason.ILLEGAL",
    OTHER: "report.reason.OTHER",
};

export interface ReportDialogProps {
    visible: boolean;
    onClose: () => void;
    targetKind: ReportTargetKind;
    targetId: string;
}

/**
 * The report form.
 *
 * A reason is required and the free text is not, which mirrors the endpoint:
 * `reason` is one of nine the queue understands, `details` is 1–500
 * characters when it is there at all.
 *
 * **The confirmation is in the dialog, not in a toast.** There are no toasts
 * any more, and closing on success with nothing said would leave the reader
 * unsure the report went anywhere. So the form gives way to one sentence —
 * received, thank you — and a button that closes it. Nothing more is said,
 * because the endpoint answers a repeat exactly as it answers a first report:
 * there is no "already reported" to show and no count.
 *
 * Scrolls inside the panel: nine reasons, a text field and a keyboard do not
 * fit a small phone at once.
 */
export function ReportDialog({
    visible,
    onClose,
    targetKind,
    targetId,
}: ReportDialogProps) {
    const { t } = useI18n();
    const { height } = useWindowDimensions();
    const [reason, setReason] = useState<ReportReason | null>(null);
    const [details, setDetails] = useState("");
    const [isReceived, setIsReceived] = useState(false);
    const { submit, isSubmitting, error, reset } = useReport();

    const close = () => {
        if (isSubmitting) return;
        setReason(null);
        setDetails("");
        setIsReceived(false);
        reset();
        onClose();
    };

    const handleSubmit = async () => {
        if (!reason) return;
        if (await submit(targetKind, targetId, reason, details)) {
            setIsReceived(true);
        }
    };

    return (
        <Modal visible={visible} onClose={close} dismissible={!isSubmitting}>
            {isReceived ? (
                <View className="gap-5">
                    <Text>{t("report.received")}</Text>
                    <Button
                        label={t("report.done")}
                        size="full"
                        onPress={close}
                    />
                </View>
            ) : (
                <ScrollView
                    style={{ maxHeight: height * 0.75 }}
                    keyboardShouldPersistTaps="handled"
                    contentContainerClassName="gap-4"
                >
                    <View className="gap-2">
                        <Text size="title">
                            {t(
                                targetKind === "POST"
                                    ? "report.titlePost"
                                    : "report.titleComment",
                            )}
                        </Text>
                        <Text size="small" tone="muted">
                            {t("report.body")}
                        </Text>
                    </View>

                    <View className="gap-1">
                        <Text size="small" className="pb-1 font-medium">
                            {t("report.reasonLabel")}
                        </Text>
                        {REPORT_REASONS.map((value) => {
                            const isChecked = reason === value;

                            return (
                                <Pressable
                                    key={value}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: isChecked }}
                                    disabled={isSubmitting}
                                    onPress={() => {
                                        setReason(value);
                                        reset();
                                    }}
                                    className="flex-row items-center gap-3 rounded-xl px-2 py-2.5 active:bg-ink/5"
                                >
                                    <View
                                        className={cn(
                                            "h-5 w-5 items-center justify-center rounded-full border-2",
                                            isChecked
                                                ? "border-danger"
                                                : "border-ink/30",
                                        )}
                                    >
                                        {isChecked && (
                                            <View className="h-2.5 w-2.5 rounded-full bg-danger" />
                                        )}
                                    </View>
                                    <Text size="small">
                                        {t(REASON_LABELS[value])}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    <View className="gap-1.5">
                        <Text size="small" className="font-medium">
                            {t("report.detailsLabel")}
                        </Text>
                        <TextField
                            value={details}
                            onChangeText={(next) => {
                                setDetails(next);
                                reset();
                            }}
                            placeholder={t("report.detailsPlaceholder")}
                            multiline
                            maxLength={REPORT_DETAILS_MAX_LENGTH}
                            textAlignVertical="top"
                            editable={!isSubmitting}
                            className="min-h-[88px]"
                        />
                        <Text
                            size="caption"
                            tone="subtle"
                            className="text-right"
                        >
                            {details.length}/{REPORT_DETAILS_MAX_LENGTH}
                        </Text>
                    </View>

                    <Text size="caption" tone="subtle">
                        {t("report.privacyNote")}
                    </Text>

                    {error && (
                        <Text size="small" tone="danger">
                            {error}
                        </Text>
                    )}

                    <View className="gap-2">
                        <Button
                            label={
                                isSubmitting
                                    ? t("report.submitting")
                                    : t("report.submit")
                            }
                            variant="danger"
                            size="full"
                            loading={isSubmitting}
                            disabled={!reason}
                            onPress={() => void handleSubmit()}
                        />
                        <Button
                            label={t("common.cancel")}
                            variant="ghost"
                            size="full"
                            disabled={isSubmitting}
                            onPress={close}
                        />
                    </View>
                </ScrollView>
            )}
        </Modal>
    );
}
