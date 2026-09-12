import { useCallback, useEffect, useState } from 'react';
import { fetchBacktestData } from '../services/apiClient.js';

const useBacktestController = ({ enabled = true } = {}) => {
	const [isLoading, setIsLoading] = useState(false);
	const [data, setData] = useState(null);
	const [error, setError] = useState(null);

	const loadBacktest = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const backtestData = await fetchBacktestData();
			setData(backtestData);
			return backtestData;
		} catch (requestError) {
			setError(requestError);
			throw requestError;
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!enabled) return undefined;

		const request = window.setTimeout(() => {
			loadBacktest().catch(() => {
				// Consumers can render the exposed error state.
			});
		}, 0);

		return () => window.clearTimeout(request);
	}, [enabled, loadBacktest]);

	return {
		isLoading,
		data,
		error,
		refetch: loadBacktest
	};
};

export default useBacktestController;
