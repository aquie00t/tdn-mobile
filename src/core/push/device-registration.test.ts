import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DeviceDescriptor } from "./device-registration";

/**
 * The port, substituted whole — which is what the platform seam is for. The
 * alternative is standing up `expo-notifications`, `react-native` and
 * `expo-constants` off-device to test four branches of sequencing.
 */
const push = vi.hoisted(() => ({
    getPermission: vi.fn(),
    requestPermission: vi.fn(),
    getToken: vi.fn(),
    onTapped: vi.fn(),
}));

vi.mock("@core/platform", () => ({ platform: { push } }));

const deviceApi = vi.hoisted(() => ({
    register: vi.fn(),
    unregister: vi.fn(),
}));

vi.mock("./device.api", () => ({ deviceApi }));

const ANDROID: DeviceDescriptor = {
    platform: "ANDROID",
    appVersion: "1",
    locale: "tr",
};

/**
 * Reimported for every test, because the token this launch registered is
 * module state — that is the point of it, and a leaked one would make the
 * sign-out tests pass for the wrong reason.
 */
async function load() {
    vi.resetModules();
    return import("./device-registration");
}

beforeEach(() => {
    vi.clearAllMocks();
    deviceApi.register.mockResolvedValue({ registered: true });
    deviceApi.unregister.mockResolvedValue({ registered: false });
});

describe("syncDevice", () => {
    it("registers the token with what this phone is", async () => {
        push.getPermission.mockResolvedValue("granted");
        push.getToken.mockResolvedValue("ExponentPushToken[abc]");

        const { syncDevice } = await load();
        await syncDevice(ANDROID);

        expect(deviceApi.register).toHaveBeenCalledWith({
            token: "ExponentPushToken[abc]",
            platform: "ANDROID",
            appVersion: "1",
            locale: "tr",
        });
    });

    it("registers nothing while the permission has not been granted", async () => {
        // A token can be minted without permission on Android — the
        // notification simply arrives and is never shown — so registering
        // anyway would write a row that can never buzz and spend a send on it
        // for every notification the account receives.
        push.getPermission.mockResolvedValue("undetermined");

        const { syncDevice } = await load();
        await syncDevice(ANDROID);

        expect(push.getToken).not.toHaveBeenCalled();
        expect(deviceApi.register).not.toHaveBeenCalled();
    });

    it("gives up quietly when there is no token to be had", async () => {
        // Expo mints the token on its servers, so this is offline, or Expo Go.
        push.getPermission.mockResolvedValue("granted");
        push.getToken.mockResolvedValue(null);

        const { syncDevice } = await load();
        await expect(syncDevice(ANDROID)).resolves.toBeUndefined();

        expect(deviceApi.register).not.toHaveBeenCalled();
    });

    it("does not fail a launch over a failed registration", async () => {
        push.getPermission.mockResolvedValue("granted");
        push.getToken.mockResolvedValue("t");
        deviceApi.register.mockRejectedValue(new Error("offline"));

        const { syncDevice } = await load();

        await expect(syncDevice(ANDROID)).resolves.toBeUndefined();
    });
});

describe("retireDevice", () => {
    it("retires the token this launch registered, without asking again", async () => {
        push.getPermission.mockResolvedValue("granted");
        push.getToken.mockResolvedValue("ExponentPushToken[abc]");

        const { syncDevice, retireDevice } = await load();
        await syncDevice(ANDROID);

        push.getToken.mockClear();
        await retireDevice();

        expect(deviceApi.unregister).toHaveBeenCalledWith(
            "ExponentPushToken[abc]",
        );
        expect(push.getToken).not.toHaveBeenCalled();
    });

    it("retires a token registered by an earlier launch", async () => {
        // Nothing was registered in this process — the app was reopened and
        // signed out before anything got that far — but the phone keeps its
        // token across restarts, so yesterday's row is still named by it.
        push.getPermission.mockResolvedValue("granted");
        push.getToken.mockResolvedValue("ExponentPushToken[abc]");

        const { retireDevice } = await load();
        await retireDevice();

        expect(deviceApi.unregister).toHaveBeenCalledWith(
            "ExponentPushToken[abc]",
        );
    });

    it("retires a token even when its registration failed", async () => {
        // The registration that failed may be a repeat of one that succeeded
        // in an earlier launch. Deleting a row that is not there is answered
        // calmly; leaving one behind is the failure this request exists for.
        push.getPermission.mockResolvedValue("granted");
        push.getToken.mockResolvedValue("t");
        deviceApi.register.mockRejectedValue(new Error("offline"));

        const { syncDevice, retireDevice } = await load();
        await syncDevice(ANDROID);
        await retireDevice();

        expect(deviceApi.unregister).toHaveBeenCalledWith("t");
    });

    it("asks for no token when the permission was never granted", async () => {
        // Then there is no row to retire, and asking Expo for a token would be
        // a network round trip in the middle of signing out.
        push.getPermission.mockResolvedValue("denied");

        const { retireDevice } = await load();
        await retireDevice();

        expect(push.getToken).not.toHaveBeenCalled();
        expect(deviceApi.unregister).not.toHaveBeenCalled();
    });

    it("does not hold up a sign-out that the server refused", async () => {
        push.getPermission.mockResolvedValue("granted");
        push.getToken.mockResolvedValue("t");
        deviceApi.unregister.mockRejectedValue(new Error("401"));

        const { retireDevice } = await load();

        await expect(retireDevice()).resolves.toBeUndefined();
    });
});
