import type { PushPermission, PushPort } from "../push.port";

/**
 * Push, where there is none to be had: Expo Go on Android.
 *
 * Expo Go stopped carrying remote notifications on Android in SDK 53, and it
 * does not fail politely. `expo-notifications` registers a token listener at
 * module scope (`DevicePushTokenAutoRegistration.fx`), that listener checks
 * for Expo Go, and on Android the check *throws* — so the import alone takes
 * the root layout down, and every route after it reports a missing default
 * export. There is no call to guard; the module cannot be loaded at all.
 *
 * So the composition root binds this instead and never requires the real
 * adapter. A development build is unaffected.
 *
 * `denied` rather than `undetermined`, because `undetermined` is the state that
 * puts the permission card at the top of the notifications list, and a card
 * offering something that cannot be delivered is worse than no card.
 */
export const unavailablePush: PushPort = {
    getPermission: (): Promise<PushPermission> => Promise.resolve("denied"),
    requestPermission: () => Promise.resolve(false),
    getToken: () => Promise.resolve(null),
    onTapped: () => () => {},
};
