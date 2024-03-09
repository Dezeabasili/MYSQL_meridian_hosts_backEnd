const express = require('express')
const router = express.Router()
const bookingsController = require('./../controllers/bookingsController')
const verifyAccessToken = require('./../middlewares/verifyJWT')
const verifyRoles = require('./../middlewares/verifyRoles')


router.get('/', verifyAccessToken, verifyRoles(2030), bookingsController.getAllBookings)

router.get('/mybookings',verifyAccessToken, verifyRoles(2010), bookingsController.getMyBookings)

router.post('/findbooking', verifyAccessToken, verifyRoles(2030), bookingsController.findCustomerBooking)

router.delete('/:booking_id', verifyAccessToken, verifyRoles(2010, 2030),  bookingsController.deleteBooking)


module.exports = router