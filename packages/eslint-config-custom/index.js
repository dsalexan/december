// module.exports = {
//   extends: ["next", "turbo", "prettier"],
//   rules: {
//     "@next/next/no-html-link-for-pages": "off",
//   },
//   parserOptions: {
//     babelOptions: {
//       presets: [require.resolve("next/babel")],
//     },
//   },
// };

const prettierOptions = {
  printWidth: 180,
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: false,
  trailingComma: `all`,
  arrowParens: `avoid`,
  endOfLine: `auto`,
}

module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },

  parserOptions: {
    ecmaVersion: `latest`,
    sourceType: `module`,
  },

  extends: [`eslint:recommended`, `plugin:prettier/recommended`, `plugin:@typescript-eslint/recommended`],

  parser: `@typescript-eslint/parser`,

  plugins: [`prettier`, `@typescript-eslint`],

  rules: {
    "prettier/prettier": [`error`, prettierOptions],
    //
    // "json/*": [`error`, `allowComments`],
    //
    "prefer-const": [`off`],
    semi: [`off`],
    quotes: [`warn`, `backtick`],
    "no-undef": [`error`],
    "no-unused-vars": [`off`],
    "no-sparse-arrays": [`off`],
    "no-useless-escape": [`off`],
    // "jsdoc/require-param": [`off`],
    // "jsdoc/require-param-description": [`off`],
    // "jsdoc/require-returns-description": [`off`],
    // "jsdoc/require-returns": [`off`],
    //
    // "@typescript-eslint/no-shadow": [
    //   `error`,
    //   {
    //     builtinGlobals: true,
    //     hoist: `all`,
    //     allow: [`document`, `event`, `name`, `parent`, `status`, `top`, `GURPS`, `getType`, `context`, `origin`, 'logger'],
    //   },
    // ],
    //
    //
    "@typescript-eslint/ban-ts-comment": [`warn`],
    "@typescript-eslint/no-unsafe-call": [`off`],
    "@typescript-eslint/no-unsafe-return": [`off`],
    "@typescript-eslint/no-unsafe-argument": [`off`],
    "@typescript-eslint/no-explicit-any": [`warn`],
    "@typescript-eslint/no-unsafe-member-access": [`off`],
    "@typescript-eslint/no-unsafe-assignment": [`off`],
    "@typescript-eslint/no-floating-promises": [`off`],
    "@typescript-eslint/require-await": [`off`],
    "@typescript-eslint/restrict-template-expressions": [`off`],
    "@typescript-eslint/no-unused-vars": [`warn`],
  },
}
