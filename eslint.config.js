import js from "@eslint/js"
import next from "@next/eslint-plugin-next"
import typescript from "@typescript-eslint/eslint-plugin"
import typescriptParser from "@typescript-eslint/parser"
import react from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import security from "eslint-plugin-security"

export default [
  {
    ignores: ["**/node_modules/", "**/.next/", "**/dist/", "**/build/", "**/coverage/"],
  },
  js.configs.recommended,
  security.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      globals: {
        console: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        File: "readonly",
        setTimeout: "readonly",
        process: "readonly",
        window: "readonly",
        document: "readonly",
        module: "readonly",
        require: "readonly",
        URL: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        EventSource: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        SVGSVGElement: "readonly",
        crypto: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
        PositionOptions: "readonly",
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
      react,
      "react-hooks": reactHooks,
      "@next/next": next,
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "off",

      // React rules
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // General rules
      "no-unused-vars": "off", // Use TypeScript version instead
      "no-console": "off",
      "no-undef": "off",
      "prefer-const": "error",
      "no-var": "error",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: ["**/*.config.{js,ts}", "**/middleware.ts"],
    rules: {
      "no-console": "off",
    },
  },
]
