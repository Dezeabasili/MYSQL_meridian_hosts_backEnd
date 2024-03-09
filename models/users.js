const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide your name'],
    },
    username: {
        type: String,
        required: [true, 'Please provide username'],
        unique: true,
        lowercase: true
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        select: false
    },
    passwordResetToken: {
        type: String,
    },
    passwordResetTime: {
        type: Date
    },
    passwordTokenExpiration: {
        type: Date
    },
    roles: {
        type: Number,
        default: 2010
    },
    photo: {
        type: String,
        default: 'https://res.cloudinary.com/dmth3elzl/image/upload/v1705633392/profilephotos/edeo8b4vzeppeovxny9c.png',
        // lowercase: true
    },
    photo_id: {
        type: String
    },
    active: {
        type: Boolean,
        default: true,
        select: false
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

// // alternative way to encrypt user password
// UserSchema.pre('save', async function (next) {
//     if (!this.isModified('password')) return next()

//     this.password = await bcrypt.hash(this.password, 12)
//     next()
// })

// alternative way to set the passwordResetTime property
// UserSchema.pre('save', function (next) {
//     if (!this.isModified('password') || this.isNew) return next()
//     this.passwordResetTime = new Date()
//     next()
// })

// set the passwordResetTime property for a new user
UserSchema.pre('save', function (next) {
    if (this.isNew)
        this.passwordResetTime = new Date()
    next()
})

// aggregate middleware
UserSchema.pre('aggregate', function (next) {
    // console.log(this.pipeline())
    //console.log(this._pipeline)
    this._pipeline.unshift({ $match: { roles: { $ne: 2030 } } })

    next()
})

// only present users with active:true
UserSchema.pre(/^find/, function (next) {
    // this refers to the query object
    this.find({ active: true })
    next()
})

// alternative way to compare user password and the encrypted password.
// Using an instance method
UserSchema.methods.comparePasswords = async function (plainPassword) {
    return await bcrypt.compare(plainPassword, this.password)
}

module.exports = mongoose.model('User', UserSchema)