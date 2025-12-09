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
        { max: 80, skipBlankLines: true, skipComments: true },
      ],
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", 15],
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
      "consistent-return": "error",
      "prefer-template": "error",
    },
  },
]);
