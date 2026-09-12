const mongoose = require('mongoose');

const safeSiteSchema = new mongoose.Schema({
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
  totalCapacity: { type: Number, required: true, min: 0 },
  currentOccupancy: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

safeSiteSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('SafeSite', safeSiteSchema);