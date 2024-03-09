const mongoose = require('mongoose')

const { Schema } = mongoose

const HotelTypeSchema = new Schema({
    hotelType: {
        type: String,
        required: [true, 'A hotel must have a type'],
        unique: true,
        lowercase: true
    },
    photo: {
        type: String
    },
    photo_id: {
        type: String
    },
    
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

module.exports = mongoose.model("HotelType", HotelTypeSchema)