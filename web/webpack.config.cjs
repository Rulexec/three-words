const _path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { createProxyMiddleware } = require('http-proxy-middleware');

const MODE = process.env.MODE || 'development';

let config = {
	mode: MODE,
	entry: _path.join(__dirname, 'src/main.js'),
	output: {
		path: _path.join(__dirname, 'dist'),
		filename: '[name]_[contenthash].js',
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: /\/node_modules\//,
				use: {
					loader: 'babel-loader',
					options: {
						presets: ['@babel/preset-env'],
					},
				},
			},
			{
				test: /\.less$/,
				use: [
					{
						loader: 'style-loader',
					},
					{
						loader: 'css-loader',
						options: {
							modules: 'local',
						},
					},
					{
						loader: 'less-loader',
					},
				],
			},
		],
	},
	plugins: [
		new HtmlWebpackPlugin({
			title: 'Три слова',
			favicon: _path.join(__dirname, 'static/favicon.png'),
		}),
		new webpack.DefinePlugin({
			'ENV.API_URL': '""',
		}),
	],
	devServer: {
		port: 9000,
		after(app) {
			app.use(createProxyMiddleware({ target: 'http://localhost:9001', changeOrigin: true }));
		},
	},
};

module.exports = config;
