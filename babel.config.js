module.exports = {
  extends: require('@darkobits/ts').babel,
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current'
      },
      exclude: [
        '@babel/plugin-proposal-dynamic-import'
      ]
    }]
  ]
};
