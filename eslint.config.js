import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/etc/**", "**/node_modules/**", "**/*.d.ts"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@wicklib/*/*", "!@wicklib/*/package.json"],
              message:
                "Import only from a package entrypoint. Deep imports are not part of the public contract.",
            },
          ],
        },
      ],
    },
  },
);
