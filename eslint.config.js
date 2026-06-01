import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "supabase/functions/**",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // Dead-code / unreachable-code guards. These were OFF, which is how
      // ~353 lines of unreachable code accumulated after an early `return`
      // in services/dataContext.tsx (updateSale). The whole repo is clean of
      // these today, so they are pure prevention against recurrence.
      "no-unreachable": "error",
      "no-unreachable-loop": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-fallthrough": "error",
      "no-dupe-keys": "error",
      "no-unsafe-finally": "error",
    },
  },
];
