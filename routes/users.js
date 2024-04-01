const express = require('express')
const router = express.Router()
const usersController = require('./../controllers/usersController')
const authController = require('./../controllers/authController')
const verifyAccessToken = require('./../middlewares/verifyJWT')
const verifyRoles = require('./../middlewares/verifyRoles')

router.route('/')
    // .get(verifyAccessToken, verifyRoles(2030), usersController.getAllUsers)
    .get(usersController.getAllUsers)

// router.get('/usercategories', usersController.usersByCategories)

router.post('/forgotpassword', authController.forgotPassword)

router.post('/finduser', verifyAccessToken, verifyRoles(2030), usersController.findUser)

router.patch('/resetpassword/:token/:id', authController.resetPassword)

router.patch('/changepassword', verifyAccessToken, authController.changePassword)

router.patch('/updatemyaccount', verifyAccessToken, usersController.updateMyAccount)

// router.patch('/updateuser', verifyAccessToken, verifyRoles(2030), usersController.updateUser)
router.patch('/updateuser', verifyAccessToken, usersController.updateUser)

router.delete('/deletemyaccount', verifyAccessToken, usersController.deleteMyAccount)

router.get('/myaccount', verifyAccessToken, usersController.seeMyAccount)

router.get('/myaccount/myphoto', verifyAccessToken, usersController.seeMyPhoto)

router.delete('/myaccount/deletemyphoto', verifyAccessToken, usersController.deleteMyPhoto)

router.post('/subscriptions', usersController.handleSubscription)

router.post('/roles', usersController.createRoles)



router.route('/:user_id')
    .get(usersController.getUser)
    // .patch(usersController.updateUser)
    .delete(usersController.deleteUser)


module.exports = router