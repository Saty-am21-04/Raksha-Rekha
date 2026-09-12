const Zone = require('../models/Zone');
const Habitation = require('../models/Habitation');
const SafeSite = require('../models/SafeSite');
const { calculateRiskAndPriority } = require('../services/scoringService');

const getWayanadBacktest = async (request, response, next) => {

	try {
		const [zones, habitations, safeSites] = await Promise.all([
			Zone.find({ isBacktest: true }).lean(),
			Habitation.find({ isBacktest: true }).lean(),
			SafeSite.find({}).lean()
		]);
		const calculations = zones.map((zone) => calculateRiskAndPriority(zone, habitations, safeSites));
		const priorityById = calculations
			.flatMap((calculation) => calculation.prioritizedHabitations)
			.reduce((uniqueHabitations, habitation) => {
				const key = habitation._id?.toString() || habitation.name;
				const existing = uniqueHabitations.get(key);
				if (!existing || habitation.evacuationPriority > existing.evacuationPriority) {
					uniqueHabitations.set(key, habitation);
				}
				return uniqueHabitations;
			}, new Map());
		const scoredHabitations = habitations.map((habitation) => {
			const key = habitation._id?.toString() || habitation.name;
			const scoredHabitation = priorityById.get(key);
			return scoredHabitation ? { ...habitation, evacuationPriority: scoredHabitation.evacuationPriority } : habitation;
		});
		const capacityDeficit = calculations.reduce(
			(total, calculation) => total + calculation.capacity.overflow,
			0
		);

		response.status(200).json({
			zones: calculations.map((calculation) => calculation.zone),
														habitations: scoredHabitations,
			safeSites,
			capacityDeficit
		});
	} catch (error) {
		next(error);
	}
};

module.exports = { getWayanadBacktest };
