// ============================================================
// CODE CHECKS AND EXCLUDED GENERATED FILES
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
    {
        ignores: [
            "dist/**",
            "dist-server/**",
            "node_modules/**",
            ".venv/**",
            ".venv-*/**",
            ".test-build/**",
            "public/mediapipe/**"
        ]
    },
    js.configs.recommended,
    ...ts.configs.recommended,
    {
        rules: {
            "eol-last": ["error", "always"],
            "no-trailing-spaces": "error",
            quotes: ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],
            semi: ["error", "always"],
            "space-before-function-paren": [
                "error",
                { anonymous: "always", named: "always", asyncArrow: "always" }
            ]
        }
    },
    {
        files: ["**/*.{ts,tsx}"],
        rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] }
    },
    {
        files: ["scripts/*.mjs"],
        languageOptions: { globals: { process: "readonly", console: "readonly" } }
    },
    {
        files: ["public/pose-worker.js"],
        languageOptions: {
            globals: { self: "readonly", importScripts: "readonly", vision: "readonly" }
        }
    }
);
