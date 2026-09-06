import type { ExpoConfig } from "expo/config";

/**
 * Android only for now. iOS lands later, and the platform seam that makes that
 * a configuration change rather than a rewrite lives in `src/core/platform/`.
 */

/** Shown to people. */
const VERSION = "0.1.0";

/**
 * The build number, and the one the API compares against.
 *
 * `GET /meta/client?build=<this>` answers whether this build is still
 * supported, so it must be the same integer Play sees. A web bundle is
 * replaced every morning; an app version lives on phones for months, which is
 * why the floor exists at all.
 */
const ANDROID_VERSION_CODE = 1;

const config: ExpoConfig = {
    name: "TDN",
    slug: "tdn-mobile",
    version: VERSION,
    orientation: "portrait",
    userInterfaceStyle: "automatic",

    /**
     * The custom scheme OAuth comes back on. It has to match an entry in the
     * API's `OAUTH_NATIVE_REDIRECT_ALLOWLIST`, which is an *exact* match with
     * no prefix test — the target receives the exchange code, so a loose match
     * would hand a session to whoever owns the address.
     */
    scheme: "tdn",

    android: {
        package: "net.developernetwork.tdn",
        versionCode: ANDROID_VERSION_CODE,
    },

    plugins: [
        "expo-router",
        "expo-secure-store",
        "expo-web-browser",
        [
            /*
             * The splash is held open until the stored theme has been read, so
             * its background has to be the dark ground. Left at the platform
             * default it is white, and holding a white splash while waiting for
             * a dark theme lengthens the flash rather than removing it.
             */
            "expo-splash-screen",
            { backgroundColor: "#000000", resizeMode: "contain" },
        ],
    ],

    experiments: {
        typedRoutes: true,
    },

    extra: {
        /**
         * Read through `expo-constants` rather than `process.env`, so the build
         * number the update gate sends is the one the binary was stamped with
         * and cannot drift from `versionCode` above.
         */
        build: ANDROID_VERSION_CODE,
    },
};

export default config;
