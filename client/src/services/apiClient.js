import axios from 'axios';

const apiClient = axios.create({
	baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
	headers: { 'Content-Type': 'application/json' },
	timeout: 8000
});

const responseData = (response) => response.data;

export const fetchZones = async (params = {}) =>
	responseData(await apiClient.get('/zones', { params }));

export const fetchHabitations = async (params = {}) =>
	responseData(await apiClient.get('/habitations', { params }));

export const fetchSafeSites = async (params = {}) =>
	responseData(await apiClient.get('/safe-sites', { params }));

export const fetchBacktest = async (enabled = true) =>
	responseData(await apiClient.get('/backtest', { params: { enabled } }));

export const fetchBacktestData = async () =>
	responseData(await apiClient.get('/backtest'));

export const toggleBacktest = async (enabled) =>
	responseData(await apiClient.post('/backtest/toggle', { enabled }));

export default apiClient;
