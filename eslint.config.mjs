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
      "work/",
      ".react-router/",
      ".local/",
      ".foundation-build/",
      ".ui-build/",
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
          patterns: [
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
];
