require('dotenv').config();

const http = require('http');
const mongoose = require('mongoose');
const { Server: SocketServer } = require('socket.io');
const Zone = require('./models/Zone');
const Habitation = require('./models/Habitation');
const SafeSite = require('./models/SafeSite');
const { calculateRiskAndPriority } = require('./services/scoringService');
const { buildEvacuationQueue, normalizePriorityUpdate } = require('./services/priorityService');

const app = require('./app');

const port = Number(process.env.PORT) || 5000;
const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
	console.log(`Socket.IO client connected: ${socket.id}`);
	socket.on('sensor:update', async (reading = {}) => {
		const rainfall72h = Number(reading.rainfall72h);
		const soilSaturation = Number(reading.soilSaturation);
		if (!reading.zoneId && !reading.habitationId) {
			socket.emit('sensor:error', { message: 'Sensor update requires zoneId or habitationId.' });
			return;
		}

		if (!Number.isFinite(rainfall72h) || rainfall72h < 0 || rainfall72h > 2000
			|| !Number.isFinite(soilSaturation) || soilSaturation < 0 || soilSaturation > 100) {
			socket.emit('sensor:error', { message: 'Invalid sensor bounds.' });
			return;
		}

		try {
			const query = reading.zoneId ? { _id: reading.zoneId } : { isBacktest: true };
			const zones = await Zone.find(query).lean();
			const habitations = await Habitation.find(reading.habitationId ? { _id: reading.habitationId } : {}).lean();
			const safeSites = await SafeSite.find({}).lean();
			const updates = zones.map((zone) => {
				const updatedZone = { ...zone, metrics: { ...zone.metrics, rainfall72h, soilSaturation } };
				return calculateRiskAndPriority(updatedZone, habitations, safeSites);
			});
			const priorityQueue = buildEvacuationQueue(
				updates.flatMap((update) => update.prioritizedHabitations),
				updates[0]?.zone || {}
			);
			io.emit('risk:update', {
				zones: updates.map((update) => update.zone),
				prioritizedHabitations: updates.flatMap((update) => update.prioritizedHabitations),
				recordedAt: reading.recordedAt || new Date().toISOString()
			});
			io.emit('priority:update', {
				...normalizePriorityUpdate(priorityQueue),
				recordedAt: reading.recordedAt || new Date().toISOString()
			});
		} catch (error) {
			socket.emit('sensor:error', { message: error.message });
		}
	});
	socket.on('disconnect', () => console.log(`Socket.IO client disconnected: ${socket.id}`));
});

server.on('error', async (error) => {
	if (error.code === 'EADDRINUSE') {
		console.error(`PORT ${port} is already in use. Stop the existing server or choose another PORT.`);
	} else {
		console.error('Express server failed to start:', error.message);
	}

	await mongoose.disconnect();
	process.exitCode = 1;
});

const connectDatabase = async () => {
	if (!process.env.MONGO_URI) {
		throw new Error('MONGO_URI is not configured. Add it to server/.env.');
	}

	await mongoose.connect(process.env.MONGO_URI);
	console.log('MongoDB connected successfully.');
};

const shutdown = async (signal) => {
	console.log(`${signal} received. Shutting down gracefully.`);

	server.close(async (serverError) => {
		if (serverError) {
			console.error('HTTP server shutdown failed:', serverError);
			process.exitCode = 1;
		}

		try {
			await mongoose.disconnect();
			console.log('MongoDB disconnected.');
		} catch (databaseError) {
			console.error('MongoDB shutdown failed:', databaseError);
			process.exitCode = 1;
		}
	});
};

const startServer = async () => {
	try {
		await connectDatabase();
		server.listen(port, () => {
			console.log(`Express server listening on PORT ${port}.`);
		});
	} catch (error) {
		console.error('Server startup failed:', error.message);
		await mongoose.disconnect();
		process.exitCode = 1;
	}
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();

module.exports = server;
