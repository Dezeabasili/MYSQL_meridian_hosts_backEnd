const express = require('express')
const verifyAccessToken = require('./../middlewares/verifyJWT')
const verifyRoles = require('./../middlewares/verifyRoles')
const reviewsController = require('./../controllers/reviewsController')

const router = express.Router({ mergeParams: true })

router.get('/', reviewsController.getAllReviews)

router.get('/myreviews', verifyAccessToken, verifyRoles(2010), reviewsController.getAllMyReviews)

router.post('/', verifyAccessToken, verifyRoles(2010), reviewsController.createReview)

router.patch('/:review_id', verifyAccessToken, verifyRoles(2010, 2030), reviewsController.updateReview)

router.delete('/:review_id', verifyAccessToken, verifyRoles(2010, 2030), reviewsController.deleteReview)


module.exports = router