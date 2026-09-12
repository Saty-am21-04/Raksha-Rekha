const mongoose = require('mongoose');

const habitationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (coordinates) => coordinates.length === 2,
        message: 'location.coordinates must be [longitude, latitude]'
      }
    }
  },
  population: { type: Number, required: true, min: 0 },
  vulnerabilityFactors: {
    elderlyAndChildrenRatio: { type: Number, min: 0, max: 1, default: 0 },
    structuralFragility: { type: Number, min: 0, max: 1, default: 0 },
    accessRoadsCutoffRisk: { type: Boolean, default: false }
  },
  evacuationPriority: { type: Number, min: 0, max: 100, default: 0 },
  isBacktest: { type: Boolean, default: false }
}, { timestamps: true });

habitationSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Habitation', habitationSchema);