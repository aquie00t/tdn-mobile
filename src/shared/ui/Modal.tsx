import {
    KeyboardAvoidingView,
    Pressable,
    Modal as RNModal,
    View,
} from "react-native";
import type { ReactNode } from "react";

export interface ModalProps {
    visible: boolean;
    /** Asked for by the back button and by a tap on the scrim. */
    onClose: () => void;
    /**
     * `false` while something the modal started is still running. A request
     * whose outcome the person can no longer see is worse than a back button
     * that waits: they would not know whether it happened.
     */
    dismissible?: boolean;
    children: ReactNode;
}

/**
 * A panel over the screen, for a decision the screen should not carry inline.
 *
 * PR 3 held this back until something genuinely needed one; deleting an
 * account is that, and blocking and reporting are next in line.
 *
 * Three details are the point of it:
 *
 * - `onRequestClose` is Android's back button. React Native requires it on
 *   Android, and without it back does nothing while the modal is up.
 * - `statusBarTranslucent`, so the scrim reaches the top of the screen rather
 *   than stopping under a status bar left in the page's colour.
 * - The panel sits in a `KeyboardAvoidingView`. A modal is its own window, so
 *   the activity resizing for the keyboard does not reach it, and a password
 *   field centred on the screen would otherwise be typed into blind.
 *
 * The scrim is `scrim`, which does not swap between themes: it darkens what is
 * behind it on a light screen as much as on a dark one.
 */
export function Modal({
    visible,
    onClose,
    dismissible = true,
    children,
}: ModalProps) {
    const requestClose = () => {
        if (dismissible) onClose();
    };

    return (
        <RNModal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={requestClose}
        >
            <KeyboardAvoidingView
                behavior="padding"
                className="flex-1 justify-center px-6"
            >
                {/*
                 * Not announced as a control: the panel carries its own way
                 * out, and a screen reader landing on an unlabelled full-screen
                 * button first would read as nothing at all.
                 */}
                <Pressable
                    accessible={false}
                    onPress={requestClose}
                    className="absolute inset-0 bg-scrim/60"
                />
                {/*
                 * The panel claims every touch that lands on it and nothing
                 * inside it takes.
                 *
                 * React Native bubbles touches through the *component* tree,
                 * not the native windows, so a modal opened from inside a
                 * pressable card is still inside that card as far as touches
                 * are concerned: a tap on this panel's title would open the
                 * post behind it. Its own buttons, radios and fields sit
                 * deeper and are asked first, so they are unaffected; the
                 * scrim is a sibling, so a tap outside still closes.
                 */}
                <View
                    accessibilityViewIsModal
                    onStartShouldSetResponder={() => true}
                    className="rounded-2xl border border-ink/10 bg-surface-1 p-6"
                >
                    {children}
                </View>
            </KeyboardAvoidingView>
        </RNModal>
    );
}
