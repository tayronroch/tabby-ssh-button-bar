const path = require('path')

module.exports = {
  target: 'node',
  entry: './src/index.ts',
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    library: {
      type: 'commonjs2',
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  externals: [
    'tabby-core',
    'tabby-terminal',
    '@angular/core',
    '@angular/common',
    '@angular/forms',
    'rxjs',
    'rxjs/operators',
  ],
}
