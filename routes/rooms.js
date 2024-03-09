const express = require('express')
const router = express.Router()
const roomsController = require('./../controllers/roomsController')
const verifyAccessToken = require('./../middlewares/verifyJWT')
const verifyRoles = require('./../middlewares/verifyRoles')


router.post('/', verifyAccessToken, verifyRoles(2030), roomsController.createRoom)

router.get('/', roomsController.getAllRooms)

router.route('/:room_id')
    .get(roomsController.getRoom)
    .patch(verifyAccessToken, verifyRoles(2030), roomsController.updateRoom)
    .delete(verifyAccessToken, verifyRoles(2030), roomsController.deleteRoom)

router.patch('/availability/:room_id', roomsController.updateRoomAvailability)

module.exports = router