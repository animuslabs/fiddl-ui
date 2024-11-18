import js from "@eslint/js"
import eslintPluginVue from "eslint-plugin-vue"
import ts from "typescript-eslint"
import eslintConfigPrettier from "eslint-config-prettier"

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...eslintPluginVue.configs["flat/recommended"],
  {
    files: ["*.vue", "**/*.vue", "*.ts", "**/*.ts", "*.js", "**/*.js"],
    languageOptions: {
      parserOptions: {
        parser: "@typescript-eslint/parser",
        project: "./tsconfig.json",
        extraFileExtensions: [".vue"],
      },
    },
    rules: {
      "vue/no-mutating-props": "off",
      "vue/component-tags-order": "off",
      "vue/max-attributes-per-line": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "vue/multiword-component-names": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          ignoreVoid: true, // Ignore expressions with `void`
          ignoreIIFE: false, // Ignore immediately invoked function expressions
        },
      ],
      "@typescript-eslint/await-thenable": "error",
      "require-await": "warn",
      "vue/multi-word-component-names": "off",
    },
  },
  eslintConfigPrettier,
)
