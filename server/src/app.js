const express = require('express');
const cors = require('cors');
const backtestRoutes = require('./routes/backtestRoutes');

const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const notFoundMiddleware = typeof notFound === 'function'
	? notFound
	: (request, response) => {
		response.status(404).json({
			error: 'Route not found',
			path: request.originalUrl
		});
	};

const errorMiddleware = typeof errorHandler === 'function'
	? errorHandler
	: (error, request, response, next) => {
		const statusCode = error.statusCode || 500;
		response.status(statusCode).json({
			error: statusCode === 500 ? 'Internal server error' : error.message
		});
	};

const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/backtest', backtestRoutes);

app.get('/health', (request, response) => {
	response.status(200).json({
		status: 'ok',
		service: 'raksha-rekha-api',
		environment: process.env.NODE_ENV || 'development',
		timestamp: new Date().toISOString()
	});
});

app.get('/api', (request, response) => {
	response.status(200).json({
		name: 'RAKSHA-REKHA API',
		version: '1.0.0',
		endpoints: {
			habitations: '/api/habitations',
			risk: '/api/risk',
			backtest: '/api/backtest',
			dispatchAlert: '/api/ops/dispatch-alert',
			sitrep: '/api/ops/sitrep'
		}
	});
});

const mountRouter = (path, router) => {
	if (typeof router === 'function') {
		app.use(path, router);
	}
};

mountRouter('/api/habitations', require('./routes/habitationRoutes'));
mountRouter('/api/risk', require('./routes/riskRoutes'));
mountRouter('/api/ops', require('./routes/opsRoutes'));

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
