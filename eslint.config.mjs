import js from "@eslint/js";

const sharedGlobals = {
  URL: "readonly",
  __dirname: "readonly",
  atob: "readonly",
  beforeEach: "readonly",
  clearInterval: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  describe: "readonly",
  document: "readonly",
  expect: "readonly",
  fetch: "readonly",
  globalThis: "readonly",
  it: "readonly",
  navigator: "readonly",
  process: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
  window: "readonly",
};

const generatedUiFiles = [
  "app/components/ui/**/*.{js,jsx,mjs,cjs}",
  "app/hooks/use-mobile.js",
];

export default [
  {
    ignores: [
      "work/**",
      ".react-router/",
      ".ui-build/",
      ".shared-ui-build/",
      ".foundation-build/",
      ".local/",
      ".vercel/",
      "playwright-report/",
      "test-results/",
      "build/",
      "coverage/",
      "dist/",
      "node_modules/",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: sharedGlobals,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      sourceType: "module",
    },
    rules: {
      "array-callback-return": "error",
      curly: ["error", "all"],
      "default-case-last": "error",
      "dot-notation": "error",
      eqeqeq: ["error", "always"],
      "no-alert": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-implicit-coercion": "error",
      "no-implied-eval": "error",
      "no-loop-func": "error",
      "no-shadow": "warn",
      "no-undef-init": "error",
      "no-unneeded-ternary": "error",
      "no-useless-concat": "error",
      "no-useless-return": "warn",
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^React$" },
      ],
      "object-shorthand": ["error", "always"],
      "prefer-arrow-callback": "warn",
      "prefer-const": "error",
      "prefer-object-has-own": "error",
      "prefer-template": "error",
      radix: "error",
    },
  },
  {
    files: generatedUiFiles,
    rules: {
      curly: "off",
      eqeqeq: "off",
      "no-implicit-coercion": "off",
      "no-shadow": "off",
      "object-shorthand": "off",
    },
  },
  {
    files: ["app/**/*.{js,jsx,mjs,cjs}"],
    ignores: ["app/components/ui/native-select.jsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/(^|[ \\t\\r\\n:])scrollbar-(thin|auto|thumb-|track-)/], TemplateElement[value.raw=/(^|[ \\t\\r\\n:])scrollbar-(thin|auto|thumb-|track-)/]",
          message:
            "Use the shared thumb-only scrollbar policy. Standard scrollbar width/color utilities bypass Chromium's custom parts and restore platform tracks/buttons. Use --scrollbar-thumb-color for visibility; scrollbar-none is allowed for intentional hiding.",
        },
        {
          selector: "JSXOpeningElement[name.name='select']",
          message:
            "Use the tuned Select or Combobox from @/components/ui. Native select is reserved for the explicit test gallery fixture.",
        },
        {
          selector: "ImportSpecifier[imported.name=/^NativeSelect/]",
          message:
            "Product screens must use Select or Combobox, including when importing from a barrel.",
        },
        {
          selector:
            "JSXOpeningElement[name.name=/^NativeSelect/], JSXOpeningElement[name.property.name=/^NativeSelect/]",
          message:
            "Use Select or Combobox in product screens; NativeSelect belongs only in the explicit test gallery fixture.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "cn",
              message:
                "Import cn from @/lib/utils to preserve semantic typography merging.",
            },
          ],
          patterns: [
            {
              group: ["clsx", "tailwind-merge"],
              message:
                "Import cn from @/lib/utils so semantic typography overrides merge as complete styles.",
            },
            {
              group: ["**/ui/native-select", "**/ui/native-select.*"],
              message:
                "Product screens must use the shared Select or Combobox.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["app/**/*.{js,jsx,mjs,cjs}"],
    ignores: ["app/components/ui/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "cn",
              message:
                "Import cn from @/lib/utils to preserve semantic typography merging.",
            },
          ],
          patterns: [
            {
              group: ["clsx", "tailwind-merge"],
              message:
                "Import cn from @/lib/utils so semantic typography overrides merge as complete styles.",
            },
            {
              group: ["**/ui/native-select", "**/ui/native-select.*"],
              message:
                "Product screens must use the shared Select or Combobox.",
            },
            {
              group: [
                "@base-ui/react",
                "@base-ui/react/**",
                "radix-ui",
                "@radix-ui/react-*",
              ],
              message:
                "Compose from @/components/ui wrappers; primitive packages belong inside those wrappers so shared behavior and styling are retained.",
            },
          ],
        },
      ],
    },
  },
];
