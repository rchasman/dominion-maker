import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Preact uses mutable signals; React Compiler rules assume React-only semantics.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      // Disable for test files - handled in override below
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      // Correctness is enforced here; layout and stylistic preferences belong to Prettier.
      "prefer-const": "error",
      "no-var": "error",
      "no-else-return": ["error", { allowElseIf: false }],

      // Category 2: TypeScript Safety

      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description", "ts-ignore": true },
      ],
      "@typescript-eslint/no-explicit-any": "error",

      // Category 3: Promise Safety
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: false },
      ],

      // Category 6: Unused Variables (Infinite Game Thinking)
      // NEVER allow underscore prefix - delete unused code instead
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "after-used",
          ignoreRestSiblings: true,
          // DO NOT allow underscore prefix for vars - delete instead
          varsIgnorePattern: undefined,
          // Allow underscore for destructured rest (..._rest)
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Test file overrides - relax rules for test globals and structure
  {
    files: ["**/*.test.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.test.ts", "*.test.tsx"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Bun test globals aren't typed, causing false positives
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      // Promise-returning mocks need not await; method references are commonly asserted, not called.
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
      "no-useless-assignment": "off",
      // Test files often need more flexibility
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "max-lines-per-function": "off",
      "max-lines": "off",
      "max-nested-callbacks": ["error", 5],
      "no-magic-numbers": "off",
    },
  },
]);
