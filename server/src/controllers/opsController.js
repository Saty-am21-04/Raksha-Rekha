const { dispatchNotification } = require('../services/notificationService');
const { generateSitrep } = require('../services/sitrepService');

const sendEmergencyNotification = async (request, response, next) => {
  try {
    const result = await dispatchNotification(request.body);
    response.status(202).json(result);
  } catch (error) {
    next(error);
  }
};

const getSituationReport = async (request, response, next) => {
  try {
    response.status(200).json(await generateSitrep());
  } catch (error) {
    next(error);
  }
};

module.exports = { sendEmergencyNotification, getSituationReport };
