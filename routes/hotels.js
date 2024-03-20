const express = require('express')
const router = express.Router()
const hotelsController = require('./../controllers/hotelsController')
const verifyAccessToken = require('./../middlewares/verifyJWT')
const verifyRoles = require('./../middlewares/verifyRoles')
const reviewsRouter = require('./reviews')

router.use('/:hotel_id/reviews', reviewsRouter)

router.route('/')
    .post(verifyAccessToken, verifyRoles(2030), hotelsController.createHotel)

    .get(hotelsController.getAllHotels)


router.get('/countbycity', hotelsController.countByCityNew)

router.get('/countbytype', hotelsController.countByTypeNew)
router.get('/room/:hotel_id', hotelsController.getHotelRooms)
router.get('/allcityrefs', hotelsController.getAllHotelCityRefs)
router.get('/allhoteltyperefs', hotelsController.getAllHotelTypeRefs)
router.post('/createcity', verifyAccessToken, verifyRoles(2030), hotelsController.createHotelCity)

router.post('/createhoteltype', verifyAccessToken, verifyRoles(2030), hotelsController.createHotelType)

router.get('/price', hotelsController.getAllHotelsWithinPriceRange)

router.route('/:hotel_id')
    .get(hotelsController.getHotel)
    .patch(verifyAccessToken, verifyRoles(2030), hotelsController.updateHotel)
    .delete(verifyAccessToken, verifyRoles(2030), hotelsController.deleteHotel)


module.exports = router