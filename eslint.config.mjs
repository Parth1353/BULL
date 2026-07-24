import { defineConfig, globalIgnores } from "eslint/config";
import nextParser from "eslint-config-next/parser.js";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: {
      parser: nextParser,
      parserOptions: {
        requireConfigFile: false,
        sourceType: "module",
        babelOptions: { presets: ["next/babel"], caller: { supportsTopLevelAwait: true } },
      },
    },
    rules: {
      "no-constant-binary-expression": "error",
      "no-duplicate-imports": "error",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "storage/**", "output/**", "tmp/**"]),
]);
