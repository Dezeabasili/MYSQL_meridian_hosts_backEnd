const Review = require("./../models/reviews");
const Hotel = require("./../models/hotels");
const User = require("./../models/users");
const Booking = require("./../models/bookings")
const createError = require("./../utils/error");
const db = require("./../utils/mysqlConnectionWithPromise");
const { format } = require("date-fns");
const configureQueryStr = require("./../utils/configureQueryString");

// create review
const createReview = async (req, res, next) => {
  try {
    const mysqlConnection = await db();
    // confirm the booking ref exists
    let q = "SELECT * FROM bookings WHERE id_bookings = ?"
    const [customerBookingArr, bookingFields] = await mysqlConnection.execute(q, [req.body.bookingRef * 1])
    if (customerBookingArr.length == 0)
        return next(createError("fail", 404, "The booking reference provided does not exist"));

    // check if the customer is the one writing the review
    if (customerBookingArr[0].id_users != req.userInfo.id) {
      return next(createError("fail", 400, "You are not the customer who made the reservation"))
    }

    // insert the review 
    q = "INSERT INTO reviews (review, rating, id_bookings, createdAt) VALUES (?, ?, ?, ?)"
    const reviewsResults = await mysqlConnection.execute(q, [req.body.review, req.body.rating * 1, req.body.bookingRef * 1, new Date()])
    const reviewId = reviewsResults[0].insertId

    // get the inserted review
    let outputString ="reviews.id_reviews, reviews.review, reviews.rating, reviews.createdAt, hotels.id_hotels, hotels.name AS hotelName, users.name AS customerName";
 
    q= "SELECT " + outputString + " FROM reviews INNER JOIN bookings ON reviews.id_bookings = bookings.id_bookings INNER JOIN users ON users.id_users = bookings.id_users INNER JOIN hotels ON hotels.id_hotels = bookings.id_hotels WHERE id_reviews = ?"
    const [reviewArr, reviewFields] = await mysqlConnection.execute(q, [reviewId])

    // build the response obj
    let reviewObj = {}
    let hotel = {}
    let customer = {}
    hotel.name = reviewArr[0].hotelName
    customer.name = reviewArr[0].customerName
    reviewObj.id_reviews = reviewArr[0].id_reviews
    reviewObj.review = reviewArr[0].review
    reviewObj.rating = reviewArr[0].rating
    reviewObj.createdAt = reviewArr[0].createdAt
    reviewObj.hotel = hotel
    reviewObj.customer = customer

    // calculate the average rating and the number of ratings for the hotel
    q = "SELECT AVG(rating) AS aveRatings, COUNT(rating) AS numOfRatings  FROM reviews INNER JOIN bookings ON reviews.id_bookings = bookings.id_bookings GROUP BY id_hotels HAVING id_hotels = ?"
    const [hotelStats] = await mysqlConnection.execute(q, [reviewArr[0].id_hotels])

    // update the average ratings and the number of ratings for the hotel
    q = "UPDATE hotels SET `ratingsAverage` = ?, `numberOfRatings` = ?  WHERE id_hotels = ?"
    const hotelResults = await mysqlConnection.execute(q, [hotelStats[0]?.aveRatings || 4.5, hotelStats[0]?.numOfRatings || 0, reviewArr[0].id_hotels])
 

    res.status(201).json({
      status: "success",
      data: reviewObj,
    });
  } catch (err) {
    next(err);
  }
};

// get all reviews
const getAllReviews = async (req, res, next) => {
  try {
    const mysqlConnection = await db();

    let values = []
    let outputString ="reviews.id_reviews, reviews.review, reviews.rating, reviews.createdAt, hotels.name AS hotelName, users.name AS customerName";
    let q= "SELECT " + outputString + " FROM reviews INNER JOIN bookings ON reviews.id_bookings = bookings.id_bookings INNER JOIN users ON users.id_users = bookings.id_users INNER JOIN hotels ON hotels.id_hotels = bookings.id_hotels"

    if (req.query.review_id) {
      q= "SELECT " + outputString + " FROM reviews INNER JOIN bookings ON reviews.id_bookings = bookings.id_bookings INNER JOIN users ON users.id_users = bookings.id_users INNER JOIN hotels ON hotels.id_hotels = bookings.id_hotels WHERE id_reviews = ?"
      values.push(req.query.review_id)
    }

    const [reviewArr, reviewFields] = await mysqlConnection.execute(q, values)

    let responseArr = []
    reviewArr.forEach(eachArray => {
      // build the response obj
    let reviewObj = {}
    let hotel = {}
    let customer = {}
    hotel.name = eachArray.hotelName
    customer.name = eachArray.customerName
    reviewObj.id_reviews = eachArray.id_reviews
    reviewObj.review = eachArray.review
    reviewObj.rating = eachArray.rating
    reviewObj.createdAt = eachArray.createdAt
    reviewObj.hotel = hotel
    reviewObj.customer = customer

    responseArr.push(reviewObj)

    })



    // This first two lines of code will modify the filter to get all reviews for
    // a particular hotel. If filterObject is empty, then we get all the reviews for all the hotels
    // let filterObject = {};
    // if (req.params.hotel_id) filterObject.hotel = req.params.hotel_id;
    // if (req.query.review_id) filterObject._id = req.query.review_id;
    // if (req.body.email) {
    //   const user = await User.findOne({ email: req.body.email });
    //   if (!user)
    //     return next(createError("fail", 404, "This user does not exist"));
    //   filterObject.customer = user._id;
    // }



    // const reviews = await Review.find(filterObject)
    //   .populate({ path: "hotel", select: "name" })
    //   .populate({ path: "customer", select: "name" });
    res.status(200).json({
      results: responseArr.length,
      status: "success",
      data: responseArr,
    });
  } catch (err) {
    next(err);
  }
};

const getAllMyReviews = async (req, res, next) => {
  try {
    const mysqlConnection = await db();

    let outputString ="reviews.id_reviews, reviews.review, reviews.rating, reviews.createdAt, hotels.name AS hotelName, users.name AS customerName";
    let q= "SELECT " + outputString + " FROM reviews INNER JOIN bookings ON reviews.id_bookings = bookings.id_bookings INNER JOIN users ON users.id_users = bookings.id_users INNER JOIN hotels ON hotels.id_hotels = bookings.id_hotels WHERE users.id_users = ?"
    const [reviewArr, reviewFields] = await mysqlConnection.execute(q, [req.userInfo.id])

    let responseArr = []
    reviewArr.forEach(eachArray => {
      // build the response obj
    let reviewObj = {}
    let hotel = {}
    let customer = {}
    hotel.name = eachArray.hotelName
    customer.name = eachArray.customerName
    reviewObj.id_reviews = eachArray.id_reviews
    reviewObj.review = eachArray.review
    reviewObj.rating = eachArray.rating
    reviewObj.createdAt = eachArray.createdAt
    reviewObj.hotel = hotel
    reviewObj.customer = customer

    responseArr.push(reviewObj)

    })


  
    // const reviews = await Review.find({customer: req.userInfo.id})
    //   .populate({ path: "hotel", select: "name" })
    //   .populate({ path: "customer", select: "name" });
    // console.log('review: ', reviews)
    
    res.status(200).json({
      results: responseArr.length,
      status: "success",
      data: responseArr,
    });
  } catch (err) {
    next(err);
  }
};



// update a review
const updateReview = async (req, res, next) => {
  try {

    const mysqlConnection = await db();
    let queryString = "";
    let values = [];
    let q;

    // check if the review exist
    q = "SELECT * FROM reviews WHERE id_reviews = ?"
    const [reviewsArr, reviewFields] = await mysqlConnection.execute(q, [req.params.review_id])
    if (reviewsArr.length == 0)
      return next(
        createError("fail", 404, "The review you specified does not exist")
      );

    if (req.body.rating) {
      queryString = queryString + " `rating` = ?, "
      values.push(req.body.rating)

    }

    if (req.body.review) {
      queryString = queryString + " `review` = ?, "
      values.push(req.body.review)

    }

       // remove the last ,
    let queryString2 = configureQueryStr(queryString, ",")
    values.push(req.params.review_id)

    q = "UPDATE reviews SET " + queryString2 + " WHERE id_reviews = ?"
    const reviewsResults = await mysqlConnection.execute(q, values)

    // console.log("reviewsResults: ", reviewsResults)

    // get the updated review
    let outputString ="reviews.id_reviews, reviews.review, reviews.rating, reviews.createdAt, hotels.id_hotels, hotels.name AS hotelName";
 
    q= "SELECT " + outputString + " FROM reviews INNER JOIN bookings ON reviews.id_bookings = bookings.id_bookings INNER JOIN hotels ON hotels.id_hotels = bookings.id_hotels WHERE id_reviews = ?"
    const [reviewArr] = await mysqlConnection.execute(q, [req.params.review_id])


    // calculate the average rating and the number of ratings for the hotel
    q = "SELECT AVG(rating) AS aveRatings, COUNT(rating) AS numOfRatings  FROM reviews INNER JOIN bookings ON reviews.id_bookings = bookings.id_bookings GROUP BY id_hotels HAVING id_hotels = ?"
    const [hotelStats] = await mysqlConnection.execute(q, [reviewArr[0].id_hotels])

    // update the average ratings and the number of ratings for the hotel
    q = "UPDATE hotels SET `ratingsAverage` = ?, `numberOfRatings` = ?  WHERE id_hotels = ?"
    const hotelResults = await mysqlConnection.execute(q, [hotelStats[0]?.aveRatings || 4.5, hotelStats[0]?.numOfRatings || 0, reviewArr[0].id_hotels])
 



    res.status(201).json({
      status: "success"
    });
  } catch (err) {
    next(err);
  }
};

// delete a review
const deleteReview = async (req, res, next) => {
  try {
    const mysqlConnection = await db();
    // check if the review exist
    let outputString ="reviews.id_reviews, reviews.review, reviews.rating, reviews.createdAt, hotels.id_hotels, hotels.name AS hotelName";
 
     let q= "SELECT " + outputString + " FROM reviews INNER JOIN bookings ON reviews.id_bookings = bookings.id_bookings INNER JOIN hotels ON hotels.id_hotels = bookings.id_hotels WHERE id_reviews = ?"
    const [reviewArr] = await mysqlConnection.execute(q, [req.params.review_id])
    if (reviewArr.length == 0)
      return next(
        createError("fail", 404, "The review you specified does not exist")
      );



    // // check if the review exist
    // q = "SELECT * FROM reviews WHERE id_reviews = ?"
    // const [reviewsArr, reviewFields] = await mysqlConnection.execute(q, [req.params.review_id])
    // if (reviewsArr.length == 0)
    //   return next(
    //     createError("fail", 404, "The review you specified does not exist")
    //   );

    q = "DELETE FROM reviews WHERE id_reviews = ?"
    const deleteResults = await mysqlConnection.execute(q, [req.params.review_id])
    // console.log("deleteResults: ", deleteResults)


    
    // calculate the average rating and the number of ratings for the hotel
    q = "SELECT AVG(rating) AS aveRatings, COUNT(rating) AS numOfRatings  FROM reviews INNER JOIN bookings ON reviews.id_bookings = bookings.id_bookings GROUP BY id_hotels HAVING id_hotels = ?"
    const [hotelStats] = await mysqlConnection.execute(q, [reviewArr[0].id_hotels])

    // update the average ratings and the number of ratings for the hotel
    q = "UPDATE hotels SET `ratingsAverage` = ?, `numberOfRatings` = ?  WHERE id_hotels = ?"
    const hotelResults = await mysqlConnection.execute(q, [hotelStats[0]?.aveRatings || 4.5, hotelStats[0]?.numOfRatings || 0, reviewArr[0].id_hotels])
 

   
    res.status(204).json({
      status: "success",
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllReviews,
  createReview,
  updateReview,
  deleteReview,
  getAllMyReviews
};
