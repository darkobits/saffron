module.exports = {
  extends: require('@darkobits/ts').eslint,
  rules: {
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    'no-console': 'off',
    'unicorn/no-process-exit': 'off'
  }
}
