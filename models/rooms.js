const mongoose = require('mongoose')
const Hotel = require('./hotels')

const RoomSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please provide room title'],
        lowercase: true
    },
    price: {
        type: Number,
        required: [true, 'Please provide room price'],
    },
    maxPeople: {
        type: Number,
        required: [true, 'Please provide max people per room'],
        default: 2
    },
    description: {
        type: String,
        required: [true, 'Please provide room description'],
        lowercase: true
    },
    roomNumbers: [{
        number: Number,
        unavailableDates: [Date]
    }],
    photos: {
        type: [String]
    },
    photo_id: {
        type: [String]
    },
    hotel: {
        type: mongoose.ObjectId, 
        ref: 'Hotel',
        required: [true, 'Please provide the hotel id'], 
    }
}, { timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
}
)

// define the static method to calculate the minimum room price
RoomSchema.statics.minimumPrice = async function (hotel_id) {
    // in a static method, 'this' points to the model
    const minPrice = await this.aggregate([
        {
            $match: { hotel: hotel_id }
        },
        {
            $group: {
                _id: '$hotel',
                minPriceForRoom: { $min: '$price' }
            }
        }
    ])

    console.log(minPrice)
    if (minPrice.length > 0) {
        await Hotel.findByIdAndUpdate(hotel_id, {
            cheapestPrice: minPrice[0].minPriceForRoom
        })
    } else {
        await Hotel.findByIdAndUpdate(hotel_id, {
            cheapestPrice: 0
        })
    }

}


RoomSchema.post('save', function (doc, next) {
    this.constructor.minimumPrice(this.hotel)
    next()
})

RoomSchema.pre(/^findOneAnd/, async function (next) {
    this.r = await this.model.findOne(this.getQuery());
    next()
})

RoomSchema.post(/^findOneAnd/, async function (doc, next) {
    await this.r?.constructor.minimumPrice(this.r?.hotel)
    next()
})


// RoomSchema.pre(/^find/, function (next) {
//     this.populate({
//         path: 'hotel',
//         select: 'name'
//     })
//     next()
// })



// // virtual populate the hotel to get all the reviews belonging to a particular hotel.
// // need virtual populate because the hotel has no reference to the Reviews collection.
// // ie, there is no reviews field in the hotel schema.
// RoomSchema.virtual('hotel', {
//     ref: 'Hotel',
//     foreignField: 'room_ids',
//     localField: '_id'
// })

module.exports = mongoose.model('Room', RoomSchema)