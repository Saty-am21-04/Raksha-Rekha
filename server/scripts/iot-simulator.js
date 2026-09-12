require('dotenv').config();

const { io } = require('socket.io-client');

const serverUrl = process.env.SOCKET_SERVER_URL || 'http://localhost:5000';
const intervalMs = Number(process.env.IOT_INTERVAL_MS) || 3000;
const socket = io(serverUrl, { transports: ['websocket'] });
let targetZoneId = process.env.IOT_ZONE_ID;

const randomBetween = (minimum, maximum) => Number((minimum + Math.random() * (maximum - minimum)).toFixed(1));
const emitReading = () => {
  if (!targetZoneId) return;
  const reading = {
    zoneId: targetZoneId,
    rainfall72h: randomBetween(50, 650),
    soilSaturation: randomBetween(30, 99),
    recordedAt: new Date().toISOString()
  };
  socket.emit('sensor:update', reading);
  console.log('IoT reading emitted:', JSON.stringify(reading));
};

const resolveTargetZone = async () => {
  if (targetZoneId) return targetZoneId;
  const response = await fetch(`${serverUrl}/api/backtest`);
  if (!response.ok) throw new Error(`Unable to load backtest zones: ${response.status}`);
  const payload = await response.json();
  targetZoneId = payload.zones?.[0]?._id;
  if (!targetZoneId) throw new Error('No target zone found. Set IOT_ZONE_ID manually.');
  return targetZoneId;
};

socket.on('connect', async () => {
  console.log(`IoT simulator connected to ${serverUrl}.`);
  try {
    await resolveTargetZone();
    emitReading();
  } catch (error) {
    console.error('Simulator target resolution failed:', error.message);
  }
});
socket.on('risk:update', (payload) => console.log('Risk update received:', JSON.stringify(payload)));
socket.on('sensor:error', (payload) => console.error('Sensor error:', payload.message));
socket.on('connect_error', (error) => console.error('Simulator connection error:', error.message));

const timer = setInterval(emitReading, intervalMs);
const shutdown = () => {
  clearInterval(timer);
  socket.disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
