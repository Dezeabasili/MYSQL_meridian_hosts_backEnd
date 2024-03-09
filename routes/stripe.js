const express = require('express')
const {stripeCheckout, stripeWebHook} = require('../controllers/stripeController')
const verifyAccessToken = require('./../middlewares/verifyJWT')

const router = express.Router()

router.post('/create-checkout-session', verifyAccessToken, stripeCheckout)
router.post('/stripe-webhook', express.raw({type: 'application/json'}), stripeWebHook)

module.exports = router