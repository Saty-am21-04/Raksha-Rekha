const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  hazardType: {
    type: String,
    enum: ['landslide', 'flood', 'cyclone'],
    required: true
  },
  geometry: {
    type: {
      type: String,
      enum: ['Polygon'],
      required: true,
      default: 'Polygon'
    },
    coordinates: {
      type: [[[Number]]],
      required: true
    }
  },
  riskScore: { type: Number, min: 0, max: 100, default: 0 },
  status: {
    type: String,
    enum: ['RED', 'YELLOW', 'SAFE'],
    default: 'SAFE'
  },
  metrics: {
    slopeAngle: { type: Number, min: 0 },
    rainfall72h: { type: Number, min: 0 },
    soilSaturation: { type: Number, min: 0, max: 100 }
  },
  isBacktest: { type: Boolean, default: false }
}, { timestamps: true });

zoneSchema.index({ geometry: '2dsphere' });

module.exports = mongoose.model('Zone', zoneSchema);