import { Text } from "@shared/ui/Text";

export interface FormStatusProps {
    error: string | null;
    /** Shown only when there is no error. */
    success: string | null;
}

/** The line under a form that says how the last attempt went. */
export function FormStatus({ error, success }: FormStatusProps) {
    if (error) {
        return (
            <Text size="small" tone="danger">
                {error}
            </Text>
        );
    }

    if (success) {
        return (
            <Text size="small" tone="success">
                {success}
            </Text>
        );
    }

    return null;
}
