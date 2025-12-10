import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Disable for test files - handled in override below
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      // Existing
      "no-nested-ternary": "error",

      // Category 1: Functional/Immutable Style
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='forEach']",
          message: "Use map/filter/reduce instead of forEach",
        },
        {
          selector: "CallExpression[callee.property.name='push']",
          message: "Use spread [...arr, item] instead of push() for immutability",
        },
        {
          selector: "CallExpression[callee.property.name='unshift']",
          message: "Use spread [item, ...arr] instead of unshift() for immutability",
        },
        {
          selector: "ForStatement",
          message: "Use map/filter/reduce instead of for loops",
        },
        {
          selector: "ForInStatement",
          message: "Use Object.keys/entries with map instead of for...in",
        },
        {
          selector: "ForOfStatement",
          message: "Use map/filter/reduce instead of for...of",
        },
      ],
      "prefer-const": "error",
      "no-var": "error",
      "no-else-return": ["error", { allowElseIf: false }],

      // Category 2: TypeScript Safety
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "as",
          objectLiteralTypeAssertions: "allow-as-parameter",
        },
      ],
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

      // Category 4: Complexity Limits
      "max-lines-per-function": [
        "error",
        { max: 200, skipBlankLines: true, skipComments: true },
      ],
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", 20],
      "max-nested-callbacks": ["error", 4],
      "max-params": ["error", 4],

      // Category 5: Readability
      "no-magic-numbers": [
        "error",
        {
          ignore: [0, 1, -1],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
        },
      ],
      "prefer-template": "error",
    },
  },
  // Test file overrides - relax rules for test globals and structure
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      // Bun test globals aren't typed, causing false positives
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      // Test files often need more flexibility
      "max-lines-per-function": "off",
      "max-lines": "off",
      "max-nested-callbacks": ["error", 5],
      "no-magic-numbers": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "ForStatement",
          message: "Use map/filter/reduce instead of for loops",
        },
        {
          selector: "ForInStatement",
          message: "Use Object.keys/entries with map instead of for...in",
        },
      ],
    },
  },
]);
