const mongoose = require("mongoose");
const User = require("./users");

const { Schema } = mongoose;

const HotelSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "A name is required to create a new hotel"],
      unique: true,
      lowercase: true,
    },
    type: {
      type: mongoose.ObjectId,
      ref: "HotelType",
    },
    city: {
      type: mongoose.ObjectId,
      ref: "City",
    },
    description: {
      type: String,
      required: [true, "Please provide a brief description of the hotel"],
      lowercase: true,
    },
    detailedDescription: {
      type: String,
      required: [
        true,
        "Please provide a detailed description of the hotel and its facilities",
      ],
      lowercase: true,
    },
    hotelLocation: {
      type: {
        type: String,
        default: "Point",
        enum: ["Point"],
      },
      coordinates: [Number],
      address: {
        type: String,
        lowercase: true,
      },
    },
    closestTouristLocation: {
      type: String,
      lowercase: true,
    },
    distanceToClosestTouristLocation: {
      type: Number,
    },
    otherLocations: [
      {
        type: {
          type: String,
          default: "Point",
          enum: ["Point"],
        },
        coordinates: [Number],
        address: {
          type: String,
          lowercase: true,
        },
      },
    ],
    photos: {
      type: String,
    },
    photo_id: {
      type: String,
    },
    numberOfRatings: {
      type: Number,
      default: 0,
    },
    ratingsAverage: {
      type: Number,
      min: 1,
      max: 5,
      default: 4.5,
      set: (val) => Math.round(val * 10) / 10,
    },
    room_ids: [
      {
        type: mongoose.ObjectId,
        ref: "Room",
      },
    ],
    cheapestPrice: {
      type: Number,
      default: 0,
    },
    vipPrice: {
      type: Number,
      validate: {
        //works only when the hotel is created
        validator: function (vPrice) {
          return vPrice < this.cheapestPrice;
        },
        message: (props) => {
          return `VIP Price ${props.value} should be less than the cheapest price, ${this.cheapestPrice}`;
        },
      },
    },
    secretBranch: {
      type: Boolean,
      default: false,
      select: false,
    },
    manager: {
      type: mongoose.ObjectId,
      ref: "User",
    },
    //staff: Array    this was used to practice for embedding staff
    staff: [
      {
        type: mongoose.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// create an index for the cheapestPrice
HotelSchema.index({ cheapestPrice: 1 });

// add index to the hotelLocation field to carry out geospatial calculations
HotelSchema.index({ hotelLocation: "2dsphere" });

// this was only used as a practice to embed staff in the Hotel data.
// will require you to update all the hotels where the staff if listed if the staff data is
// updated in the Users collection.
// HotelSchema.pre('save', async function (next) {
//     const staffPromises = this.staff.map(async id => await User.findById(id))
//     this.staff = await Promise.all(staffPromises)
//     next()
// })

//document middleware
HotelSchema.pre("save", async function (next) {
  this.otherLocations = [];
  const hotels = await this.constructor.find();
  hotels.forEach((hotel) => {
    this.otherLocations.push(hotel.hotelLocation);
  });

  next();
});

// to populate the staff property with selected fields
HotelSchema.pre(/^find/, function (next) {
  this.populate({
    path: "staff",
    select: "name",
  })
    .populate({
      path: "manager",
      select: "name",
    })
    .populate({
      path: "room_ids",
      select: "title price description",
    })
    .populate("city")
    .populate("type");
  next();
});

// Query middleware
HotelSchema.pre(/^find/, function (next) {
  this.find({ secretBranch: { $ne: true } });
  next();
});

HotelSchema.pre(/^count/, function (next) {
  this.find({ secretBranch: { $ne: true } });
  next();
});

// HotelSchema.post('save', function (doc, next) {
//     // console.log(doc)
//     next()
// })

HotelSchema.virtual("priceInPounds").get(function () {
  return Math.round((this.cheapestPrice / 1.4) * 100) / 100;
});

// virtual populate the hotel to get all the reviews belonging to a particular hotel.
// need virtual populate because the hotel has no reference to the Reviews collection.
// ie, there is no reviews field in the hotel schema.
HotelSchema.virtual("reviews", {
  ref: "Review",
  foreignField: "hotel",
  localField: "_id",
});

module.exports = mongoose.model("Hotel", HotelSchema);
