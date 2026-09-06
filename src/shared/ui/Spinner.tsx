import { ActivityIndicator, View } from "react-native";

import { cn } from "./cn";

export interface SpinnerProps {
    size?: "small" | "large";
    /** Centres itself in the space it is given. */
    center?: boolean;
    className?: string;
}

/**
 * The platform's own indicator.
 *
 * The web draws its spinner as a bordered circle with one edge coloured and a
 * CSS rotation — a trick with no translation here, and no reason to reach for
 * one when the platform ships an indicator that already matches what people
 * expect a loading control to look like on their phone.
 */
export function Spinner({
    size = "small",
    center = false,
    className,
}: SpinnerProps) {
    const indicator = (
        <ActivityIndicator
            size={size}
            className={cn("text-ink/60", className)}
        />
    );

    if (!center) return indicator;

    return (
        <View className="flex-1 items-center justify-center p-10">
            {indicator}
        </View>
    );
}
