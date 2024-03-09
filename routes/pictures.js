const express = require('express')
const router = express.Router()
const picturesController = require('./../controllers/picturesController')
const verifyRoles = require('./../middlewares/verifyRoles')


router.get('/cities/:cityname', picturesController.getCities)
// router.get('/hotels/', picturesController.getHotels)
// router.get('/rooms', picturesController.getRooms)
// router.get('/types', picturesController.getHotelTypes)


module.exports = router