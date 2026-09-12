const RED_THRESHOLD = 70;

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

const toPlainObject = (value) => {
	if (value && typeof value.toObject === 'function') {
		return value.toObject();
	}

	return value || {};
};

const getCoordinates = (geoJson) => geoJson && Array.isArray(geoJson.coordinates)
	? geoJson.coordinates
	: [];

const pointInRing = ([longitude, latitude], ring) => {
	let inside = false;

	for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index++) {
		const [currentLongitude, currentLatitude] = ring[index];
		const [previousLongitude, previousLatitude] = ring[previousIndex];
		const intersects = ((currentLatitude > latitude) !== (previousLatitude > latitude))
			&& longitude < ((previousLongitude - currentLongitude) * (latitude - currentLatitude))
				/ (previousLatitude - currentLatitude) + currentLongitude;

		if (intersects) inside = !inside;
	}

	return inside;
};

const pointInPolygon = (point, polygon) => {
	const rings = getCoordinates(polygon);
	return rings.length > 0
		&& pointInRing(point, rings[0])
		&& rings.slice(1).every((hole) => !pointInRing(point, hole));
};

const distanceInKilometres = (firstPoint, secondPoint) => {
	const [firstLongitude, firstLatitude] = firstPoint;
	const [secondLongitude, secondLatitude] = secondPoint;
	const radians = (degrees) => degrees * Math.PI / 180;
	const latitudeDelta = radians(secondLatitude - firstLatitude);
	const longitudeDelta = radians(secondLongitude - firstLongitude);
	const latitude = radians(firstLatitude);
	const secondLatitudeRadians = radians(secondLatitude);
	const haversine = Math.sin(latitudeDelta / 2) ** 2
		+ Math.sin(longitudeDelta / 2) ** 2 * Math.cos(latitude) * Math.cos(secondLatitudeRadians);

	return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const calculateRiskScore = (metrics = {}) => {
	const rainfallScore = clamp((Number(metrics.rainfall72h) || 0) / 600 * 50, 0, 50);
	const slopeScore = clamp((Number(metrics.slopeAngle) || 0) / 45 * 35, 0, 35);
	const saturationScore = clamp((Number(metrics.soilSaturation) || 0) / 100 * 15, 0, 15);

	return Math.round(clamp(rainfallScore + slopeScore + saturationScore, 0, 100));
};

const calculateEvacuationPriority = (habitation) => {
	const factors = habitation.vulnerabilityFactors || {};
	const vulnerabilityScore = clamp(
		(Number(factors.elderlyAndChildrenRatio) || 0) * 45
			+ (Number(factors.structuralFragility) || 0) * 35
			+ (factors.accessRoadsCutoffRisk ? 20 : 0),
		0,
		100
	);
	const populationScore = clamp((Number(habitation.population) || 0) / 1000 * 20, 0, 20);

	return Math.round(clamp(vulnerabilityScore * 0.8 + populationScore, 0, 100));
};

const calculateRiskAndPriority = (zoneInput, habitationsInput = [], safeSitesInput = []) => {
	const zone = toPlainObject(zoneInput);
	const habitations = habitationsInput.map(toPlainObject);
	const safeSites = safeSitesInput.map(toPlainObject);
	const riskScore = calculateRiskScore(zone.metrics);
	const status = riskScore >= RED_THRESHOLD ? 'RED' : riskScore >= 40 ? 'YELLOW' : 'SAFE';
	const prioritizedHabitations = status === 'RED'
		? habitations
			.filter((habitation) => pointInPolygon(getCoordinates(habitation.location), zone.geometry))
			.map((habitation) => ({
				...habitation,
				evacuationPriority: calculateEvacuationPriority(habitation)
			}))
			.sort((first, second) => second.evacuationPriority - first.evacuationPriority)
		: [];
	const prioritizedPopulation = prioritizedHabitations.reduce(
		(total, habitation) => total + (Number(habitation.population) || 0),
		0
	);
	const availableCapacity = safeSites.reduce(
		(total, safeSite) => total + Math.max((Number(safeSite.totalCapacity) || 0)
			- (Number(safeSite.currentOccupancy) || 0), 0),
		0
	);
	const nearestSafeSites = safeSites
		.filter((safeSite) => getCoordinates(safeSite.location).length === 2)
		.map((safeSite) => ({
			...safeSite,
			distanceKm: distanceInKilometres(
				getCoordinates(zone.geometry)[0][0],
				getCoordinates(safeSite.location)
			)
		}))
		.sort((first, second) => first.distanceKm - second.distanceKm);

	return {
		zone: { ...zone, riskScore, status },
		prioritizedHabitations,
		prioritizedPopulation,
		nearestSafeSites,
		capacity: {
			available: availableCapacity,
			required: prioritizedPopulation,
			overflow: Math.max(prioritizedPopulation - availableCapacity, 0),
			isOverCapacity: prioritizedPopulation > availableCapacity
		}
	};
};

module.exports = { calculateRiskAndPriority };
