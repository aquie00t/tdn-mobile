import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * `.mts`, not `.ts`. There is no `"type": "module"` in `package.json` — the
 * Metro and Babel configs are CommonJS and have to stay that way — so a `.ts`
 * config using ESM syntax is loaded as CommonJS and warns about it.
 *
 * `environment: "node"`, because what is tested here is the network client and
 * the logic around it: plain TypeScript with no React Native rendering in it.
 * Component testing needs a renderer and a different set of native module
 * mocks, and that is a decision to make when the first component needs it.
 */
const dir = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        setupFiles: ["./tests/setup.ts"],
        include: ["src/**/*.{test,spec}.ts"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: ["src/**/*.types.ts", "src/core/platform/adapters/**"],
        },
    },
    resolve: {
        alias: {
            "@core": dir("./src/core"),
            "@features": dir("./src/features"),
            "@shared": dir("./src/shared"),
            "@": dir("./src"),
        },
    },
});
