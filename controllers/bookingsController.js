const Room = require("./../models/rooms");
const Booking = require("./../models/bookings");
const User = require("./../models/users");
const createError = require("../utils/error");
const db = require("./../utils/mysqlConnectionWithPromise");
const configureQueryStr = require("./../utils/configureQueryString");
const { format } = require("date-fns");



const getAllBookings = async (req, res, next) => {
  try {
    const mysqlConnection = await db();

    let hotelValue = []
    let q;
    q =   "SELECT * FROM " + 
          "(SELECT users.email, users.name AS customer, users.id_users AS userId, bookings.id_bookings AS id_bookings, hotels.name, hotels.id_hotels, cities.cityName FROM users INNER JOIN bookings ON users.id_users = bookings.id_users " + 
          "INNER JOIN hotels ON bookings.id_hotels = hotels.id_hotels " +
          "INNER JOIN cities ON hotels.id_cities = cities.id_cities) AS cte1 " +
          "INNER JOIN " +
          "(SELECT unavailabledates.check_in_date, unavailabledates.check_out_date, DATEDIFF(unavailabledates.check_out_date, unavailabledates.check_in_date) AS number_of_nights, unavailabledates.id_bookings AS id_bookings, roomnumbers.roomNumber, roomstyledescription.price, roomstyledescription.id_roomStyleDescription, roomstyles.roomStylesNames " +
          "FROM unavailabledates INNER JOIN roomnumbers ON unavailabledates.id_roomNumbers = roomnumbers.id_roomNumbers " +
          "INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription " +
          "INNER JOIN roomstyles ON roomstyles.id_roomStyles = roomstyledescription.id_roomStyles) AS cte2 " +
          "WHERE cte1.id_bookings = cte2.id_bookings"
         



    if (req.query.hotel_id) {
      q =   "SELECT * FROM " + 
          "(SELECT users.email, users.name AS customer, users.id_users AS userId, bookings.id_bookings AS id_bookings, bookings.createdAt, hotels.name, hotels.id_hotels, cities.cityName FROM users INNER JOIN bookings ON users.id_users = bookings.id_users " + 
          "INNER JOIN hotels ON bookings.id_hotels = hotels.id_hotels " +
          "INNER JOIN cities ON hotels.id_cities = cities.id_cities) AS cte1 " +
          "INNER JOIN " +
          "(SELECT unavailabledates.check_in_date, unavailabledates.check_out_date, DATEDIFF(unavailabledates.check_out_date, unavailabledates.check_in_date) AS number_of_nights, unavailabledates.id_bookings AS id_bookings, roomnumbers.roomNumber, roomstyledescription.price, roomstyledescription.id_roomStyleDescription, roomstyles.roomStylesNames " +
          "FROM unavailabledates INNER JOIN roomnumbers ON unavailabledates.id_roomNumbers = roomnumbers.id_roomNumbers " +
          "INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription " +
          "INNER JOIN roomstyles ON roomstyles.id_roomStyles = roomstyledescription.id_roomStyles) AS cte2 " + 
          "WHERE cte1.id_bookings = cte2.id_bookings AND cte1.id_hotels = ?"

      
      hotelValue.push(req.query.hotel_id)
    }
    const [bookingsArray, bookingsFields] = await mysqlConnection.execute(q, hotelValue);

    // get all the booking references
    let responseArray = [];
    const allBookings = [];
    const bookingRef = [];
    bookingsArray.forEach((eachRoom) => {
      let newBooking = {};
      let userObj = {};
      let hotelObj = {};
      if (!bookingRef.includes(eachRoom.id_bookings)) {
        userObj.name = eachRoom.customer;
        hotelObj.name = eachRoom.name;
        newBooking.createdAt = eachRoom.createdAt;
        newBooking.user = userObj;
        newBooking.hotel = hotelObj;
        newBooking.id_bookings = eachRoom.id_bookings;
        newBooking.bookingDetails = [];
        allBookings.push(newBooking);
        bookingRef.push(eachRoom.id_bookings);
      }
    });

    allBookings.forEach((selectedRef, index1) => {
      bookingsArray.forEach((roomType, index2) => {
        // roomType.roomNumbers.forEach((roomNumber, index3) => {
        // if (roomNumber.number == selectedRef) {
        if (roomType.id_bookings == selectedRef.id_bookings) {
          let roomDetails = {};
          roomDetails.roomType_id = roomType.id_roomStyleDescription;
          // roomDetails.room_id = selectedRef;
          roomDetails.roomNumber = roomType.roomNumber;
          roomDetails.checkin_date = roomType.check_in_date;
          roomDetails.checkout_date = roomType.check_out_date;
          roomDetails.price_per_night = roomType.price;
          roomDetails.number_of_nights = roomType.number_of_nights;
          roomDetails.room_type = roomType.roomStylesNames;

          selectedRef.bookingDetails.push(roomDetails);

          // newBooking.bookingDetails.push({ ...roomDetails });
        }
        // });
      });
      responseArray.push({ ...selectedRef });
    });

    res.status(200).json({
      number: responseArray.length,
      data: responseArray,
    });
  } catch (err) {
    next(err);
  }
};

const getMyBookings = async (req, res, next) => {
  try {
    const mysqlConnection = await db();

    let q;
    q =   "SELECT * FROM " + 
          "(SELECT users.email, users.name AS customer, users.id_users AS userId, bookings.id_bookings AS id_bookings, bookings.createdAt, hotels.name, hotels.id_hotels, cities.cityName FROM users INNER JOIN bookings ON users.id_users = bookings.id_users " + 
          "INNER JOIN hotels ON bookings.id_hotels = hotels.id_hotels " +
          "INNER JOIN cities ON hotels.id_cities = cities.id_cities) AS cte1 " +
          "INNER JOIN " +
          "(SELECT unavailabledates.check_in_date, unavailabledates.check_out_date, DATEDIFF(unavailabledates.check_out_date, unavailabledates.check_in_date) AS number_of_nights, unavailabledates.id_bookings AS id_bookings, roomnumbers.roomNumber, roomstyledescription.price, roomstyledescription.id_roomStyleDescription, roomstyles.roomStylesNames " +
          "FROM unavailabledates INNER JOIN roomnumbers ON unavailabledates.id_roomNumbers = roomnumbers.id_roomNumbers " +
          "INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription " +
          "INNER JOIN roomstyles ON roomstyles.id_roomStyles = roomstyledescription.id_roomStyles) AS cte2 " + 
          "WHERE cte1.id_bookings = cte2.id_bookings AND cte1.userId = ?"


    const [bookingsArray, bookingsFields] = await mysqlConnection.execute(q, [
      req.userInfo.id,
    ]);

    if (bookingsArray.length == 0) {
      return next(createError("fail", 404, "This user has no booking"));
    }

    // get all the booking references
    let responseArray = [];
    const allBookings = [];
    const bookingRef = [];
    bookingsArray.forEach((eachRoom) => {
      let newBooking = {};
      let userObj = {};
      let hotelObj = {};
      if (!bookingRef.includes(eachRoom.id_bookings)) {
        userObj.name = eachRoom.customer;
        hotelObj.name = eachRoom.name;
        newBooking.createdAt = eachRoom.createdAt;
        newBooking.user = userObj;
        newBooking.hotel = hotelObj;
        newBooking.id_bookings = eachRoom.id_bookings;
        newBooking.bookingDetails = [];
        allBookings.push(newBooking);
        bookingRef.push(eachRoom.id_bookings);
      }
    });



    allBookings.forEach((selectedRef, index1) => {
      bookingsArray.forEach((roomType, index2) => {
        // roomType.roomNumbers.forEach((roomNumber, index3) => {
        // if (roomNumber.number == selectedRef) {
        if (roomType.id_bookings == selectedRef.id_bookings) {
          let roomDetails = {};
          roomDetails.roomType_id = roomType.id_roomStyleDescription;
          // roomDetails.room_id = selectedRef;
          roomDetails.roomNumber = roomType.roomNumber;
          roomDetails.checkin_date = roomType.check_in_date;
          roomDetails.checkout_date = roomType.check_out_date;
          roomDetails.price_per_night = roomType.price;
          roomDetails.number_of_nights = roomType.number_of_nights;
          roomDetails.room_type = roomType.roomStylesNames;

          selectedRef.bookingDetails.push(roomDetails);

          // newBooking.bookingDetails.push({ ...roomDetails });
        }
        // });
      });
      responseArray.push({ ...selectedRef });
    });

    res.status(200).json({
      number: responseArray.length,
      data: responseArray,
    });
  } catch (err) {
    next(err);
  }


};

const findCustomerBooking = async (req, res, next) => {
  try {
    const mysqlConnection = await db();

    let bookingsArray;
    if (req.body.booking_id) {
      let q;
      q =   "SELECT * FROM " + 
          "(SELECT users.email, users.name AS customer, users.id_users AS userId, bookings.id_bookings AS id_bookings, bookings.createdAt, hotels.name, hotels.id_hotels, cities.cityName FROM users INNER JOIN bookings ON users.id_users = bookings.id_users " + 
          "INNER JOIN hotels ON bookings.id_hotels = hotels.id_hotels " +
          "INNER JOIN cities ON hotels.id_cities = cities.id_cities) AS cte1 " +
          "INNER JOIN " +
          "(SELECT unavailabledates.check_in_date, unavailabledates.check_out_date, DATEDIFF(unavailabledates.check_out_date, unavailabledates.check_in_date) AS number_of_nights, unavailabledates.id_bookings AS id_bookings, roomnumbers.roomNumber, roomstyledescription.price, roomstyledescription.id_roomStyleDescription, roomstyles.roomStylesNames " +
          "FROM unavailabledates INNER JOIN roomnumbers ON unavailabledates.id_roomNumbers = roomnumbers.id_roomNumbers " +
          "INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription " +
          "INNER JOIN roomstyles ON roomstyles.id_roomStyles = roomstyledescription.id_roomStyles) AS cte2 " + 
          "WHERE cte1.id_bookings = cte2.id_bookings AND cte1.id_bookings = ?"





      const [bookingsArray2, bookingsFields] = await mysqlConnection.execute(q, [
        req.body.booking_id,
      ]);

      if (bookingsArray2.length == 0) {
        return next(createError("fail", 404, "This user has no booking"));
      }
      bookingsArray = [...bookingsArray2]

    } else if (req.body.email) {
        let q;
        q =   "SELECT * FROM " + 
          "(SELECT users.email, users.name AS customer, users.id_users AS userId, bookings.id_bookings AS id_bookings, bookings.createdAt, hotels.name, hotels.id_hotels, cities.cityName FROM users INNER JOIN bookings ON users.id_users = bookings.id_users " + 
          "INNER JOIN hotels ON bookings.id_hotels = hotels.id_hotels " +
          "INNER JOIN cities ON hotels.id_cities = cities.id_cities) AS cte1 " +
          "INNER JOIN " +
          "(SELECT unavailabledates.check_in_date, unavailabledates.check_out_date, DATEDIFF(unavailabledates.check_out_date, unavailabledates.check_in_date) AS number_of_nights, unavailabledates.id_bookings AS id_bookings, roomnumbers.roomNumber, roomstyledescription.price, roomstyledescription.id_roomStyleDescription, roomstyles.roomStylesNames " +
          "FROM unavailabledates INNER JOIN roomnumbers ON unavailabledates.id_roomNumbers = roomnumbers.id_roomNumbers " +
          "INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription " +
          "INNER JOIN roomstyles ON roomstyles.id_roomStyles = roomstyledescription.id_roomStyles) AS cte2 " + 
          "WHERE cte1.id_bookings = cte2.id_bookings AND cte1.email = ?"


      const [bookingsArray3, bookingsFields] = await mysqlConnection.execute(q, [
        req.body.email
      ]);

      if (bookingsArray3.length == 0) {
        return next(createError("fail", 404, "This user has no booking"));
      }

      bookingsArray = [...bookingsArray3]

    }

      // get all the booking references
      let responseArray = [];
      const allBookings = [];
      const bookingRef = [];
      bookingsArray.forEach((eachRoom) => {
        let newBooking = {};
        let userObj = {};
        let hotelObj = {};
        if (!bookingRef.includes(eachRoom.id_bookings)) {
          userObj.name = eachRoom.customer;
          hotelObj.name = eachRoom.name;
          newBooking.createdAt = eachRoom.createdAt;
          newBooking.user = userObj;
          newBooking.hotel = hotelObj;
          newBooking.id_bookings = eachRoom.id_bookings;
          newBooking.bookingDetails = [];
          allBookings.push(newBooking);
          bookingRef.push(eachRoom.id_bookings);
        }
      });
  
  
  
      allBookings.forEach((selectedRef, index1) => {
        bookingsArray.forEach((roomType, index2) => {
          // roomType.roomNumbers.forEach((roomNumber, index3) => {
          // if (roomNumber.number == selectedRef) {
          if (roomType.id_bookings == selectedRef.id_bookings) {
            let roomDetails = {};
            roomDetails.roomType_id = roomType.id_roomStyleDescription;
            // roomDetails.room_id = selectedRef;
            roomDetails.roomNumber = roomType.roomNumber;
            roomDetails.checkin_date = roomType.check_in_date;
            roomDetails.checkout_date = roomType.check_out_date;
            roomDetails.price_per_night = roomType.price;
            roomDetails.number_of_nights = roomType.number_of_nights;
            roomDetails.room_type = roomType.roomStylesNames;
  
            selectedRef.bookingDetails.push(roomDetails);
  
            // newBooking.bookingDetails.push({ ...roomDetails });
          }
          // });
        });
        responseArray.push({ ...selectedRef });
      });

    // let bookings = [];
    // if (req.body.booking_id) {
    //   const userbooking = await Booking.findById(req.body.booking_id);
    //   if (!userbooking)
    //     return next(createError("fail", 404, "the booking does not exist"));
    //   bookings.push(userbooking);
    // } else if (req.body.email) {
    //   const user = await User.findOne({ email: req.body.email });
    //   if (!user)
    //     return next(createError("fail", 404, "this user email does not exist"));
    //   // find all the bookings for this user
    //   bookings = await Booking.find({ user: user._id });
    //   if (!bookings)
    //     return next(createError("fail", 404, "the booking does not exist"));
    // }

    res.status(200).json({ data: responseArray });
  } catch (err) {
    next(err);
  }
};

const deleteBooking = async (req, res, next) => {
  try {
    const mysqlConnection = await db();
     // check if the booking exist
     let q = "SELECT * FROM bookings WHERE id_bookings = ?"
     const [bookingArr, fields] = await mysqlConnection.execute(q, [req.params.booking_id])
     if (bookingArr.length == 0) {
        return next(createError("fail", 404, "This booking does not exist"));
      }


    q = "DELETE FROM bookings WHERE id_bookings = ?"
    const deleteResult = await mysqlConnection.execute(q, [req.params.booking_id])


    res.status(204).json("booking has been deleted");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  deleteBooking,
  getAllBookings,
  getMyBookings,
  findCustomerBooking,
};
