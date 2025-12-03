/**
 * Webpack configuration for Meet Media API client bundle
 */
const path = require('path');

module.exports = {
  entry: './sdk/client-entry.ts',
  target: 'web',
  mode: 'development',
  devtool: 'inline-source-map',
  output: {
    filename: 'meet-client.bundle.js',
    path: path.resolve(__dirname, 'public'),
    library: {
      name: 'MeetMediaClient',
      type: 'window',
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.sdk.json',
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
};
