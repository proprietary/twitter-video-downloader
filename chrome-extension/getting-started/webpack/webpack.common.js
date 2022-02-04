const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const src = path.join(__dirname, '..', 'src');

module.exports = {
	entry: {
		popup: path.join(src, 'popup', 'index.tsx'),
		background: path.join(src, 'background', 'index.ts'),
	},
	output: {
		path: path.join(__dirname, '..', 'dist'),
		filename: '[name].js',
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: 'ts-loader',
				exclude: /node_modules/,
				resourceQuery: { not: [/raw/] },
			},
			{
				test: /\.css$/i,
				use: ['style-loader', 'css-loader'],
				resourceQuery: { not: [/raw/] },
			},
			{
				resourceQuery: /raw/,
				type: 'asset/source',
			},
		],
	},
	resolve: {
		extensions: [
			'.ts',
			'.tsx',
			'.js',
		],
		alias: {
			'react': 'preact/compat',
			'react-dom/test-utils': 'preact/test-utils',
			'react-dom': 'preact/compat', // must be below test-utils
			'react/jsx-runtime': 'preact/jsx-runtime',
		},
	},
	plugins: [
		new CopyWebpackPlugin({
			patterns: [{
				from: '.',
				context: path.join(__dirname, '..', 'public'),
			}],
		}),
	],
};

