const mongoose = require('mongoose')

const { Schema } = mongoose

const CitySchema = new Schema({
    cityName: {
        type: String,
        required: [true, 'A city must have a name'],
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


module.exports = mongoose.model("City", CitySchema)