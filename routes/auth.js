const express = require('express')
const fileUpload = require('express-fileupload')
const authController = require('./../controllers/authController')
const registerController = require('./../controllers/registerController')
const renew_access_token = require('./../controllers/renewAccessToken')
const logout = require('./../controllers/logoutController')
const upload_file = require('./../controllers/uploadfile')
const generateSignature = require('./../controllers/cloudinaryController')
const verifyAccessToken = require('./../middlewares/verifyJWT')

const router = express.Router()

router.post('/register', registerController.register)
router.post('/login', authController.login)
router.get('/renew_access_token', renew_access_token)
router.get('/logout', logout)
router.post('/upload', verifyAccessToken, fileUpload({ createParentPath: true }), upload_file)
router.post('/generatesignature', verifyAccessToken, generateSignature)
router.post('/forgotpassword', authController.forgotPassword)
router.post('/changepassword',verifyAccessToken, authController.changePassword)
router.post('/resetpassword/:resettoken/:user_id', authController.resetPassword)


module.exports = router