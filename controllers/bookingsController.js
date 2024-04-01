const Room = require("./../models/rooms");
const Booking = require("./../models/bookings");
const User = require("./../models/users");
const createError = require("../utils/error");
const db = require("./../utils/mysqlConnectionWithPromise");
const configureQueryStr = require("./../utils/configureQueryString");
const { format } = require("date-fns");

// Build the response object in accordance to what is expected at the Front End
const resArray = (bookingsAr) => {
  let responseArr = [];
  const allBookings = [];
  const bookingRef = [];
  bookingsAr.forEach((eachRoom) => {
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

  allBookings.forEach((selectedRef) => {
    bookingsAr.forEach((roomType) => {
      if (roomType.id_bookings == selectedRef.id_bookings) {
        let roomDetails = {};
        roomDetails.roomType_id = roomType.id_roomStyleDescription;
        roomDetails.roomNumber = roomType.roomNumber;
        roomDetails.checkin_date = roomType.check_in_date;
        roomDetails.checkout_date = roomType.check_out_date;
        roomDetails.price_per_night = roomType.price;
        roomDetails.number_of_nights = roomType.number_of_nights;
        roomDetails.room_type = roomType.roomStylesNames;

        selectedRef.bookingDetails.push(roomDetails);
      }
    });
    responseArr.push({ ...selectedRef });
  });

  return responseArr;
};

// Build part of the query string common to all the request handlers below
const query =
  "SELECT * FROM " +
  " (SELECT users.email, users.name AS customer, users.id_users AS userId, bookings.id_bookings AS id_bookings, bookings.createdAt AS createdAt, " +
  " hotels.name, hotels.id_hotels, cities.cityName FROM users INNER JOIN bookings ON users.id_users = bookings.id_users " +
  " INNER JOIN hotels ON bookings.id_hotels = hotels.id_hotels " +
  " INNER JOIN cities ON hotels.id_cities = cities.id_cities) AS cte1 " +
  " INNER JOIN " +
  " (SELECT unavailabledates.check_in_date, unavailabledates.check_out_date, DATEDIFF(unavailabledates.check_out_date, unavailabledates.check_in_date) AS number_of_nights, " +
  " unavailabledates.id_bookings AS id_bookings, roomnumbers.roomNumber, roomstyledescription.price, roomstyledescription.id_roomStyleDescription, roomstyles.roomStylesNames " +
  " FROM unavailabledates INNER JOIN roomnumbers ON unavailabledates.id_roomNumbers = roomnumbers.id_roomNumbers " +
  " INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription " +
  " INNER JOIN roomstyles ON roomstyles.id_roomStyles = roomstyledescription.id_roomStyles) AS cte2 " +
  " WHERE cte1.id_bookings = cte2.id_bookings";

const getAllBookings = async (req, res, next) => {
  const mysqlConnection = await db();
  try {
    let responseArray;

    // if requesting for all the bookings for a specific hotel
    if (req.query.hotel_id) {
      const qWithHotel_id = query + " AND cte1.id_hotels = ?";

      const [bookingsArray] = await mysqlConnection.execute(qWithHotel_id, [
        req.query.hotel_id,
      ]);

      responseArray = resArray(bookingsArray);
    } else {
      const qAllBookings = query;

      const [bookingsArray2] = await mysqlConnection.execute(qAllBookings, []);

      responseArray = resArray(bookingsArray2);
    }

    res.status(200).json({
      number: responseArray.length,
      data: responseArray,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

const getMyBookings = async (req, res, next) => {
  const mysqlConnection = await db();
  try {
    const qMyBookings = query + " AND cte1.userId = ?";

    const [bookingsArray] = await mysqlConnection.execute(qMyBookings, [
      req.userInfo.id,
    ]);

    if (bookingsArray.length == 0) {
      return next(createError("fail", 404, "This user has no booking"));
    }

    const responseArray = resArray(bookingsArray);

    res.status(200).json({
      number: responseArray.length,
      data: responseArray,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

const findCustomerBooking = async (req, res, next) => {
  const mysqlConnection = await db();
  // either booking reference or customer email if provided
  try {
    let bookingsArray;

    // if the booking reference is provided
    if (req.body.booking_id) {
      const qWithBooking_id = query + " AND cte1.id_bookings = ?";

      const [bookingsArray2] = await mysqlConnection.execute(qWithBooking_id, [
        req.body.booking_id,
      ]);

      if (bookingsArray2.length == 0) {
        return next(createError("fail", 404, "This user has no booking"));
      }
      bookingsArray = [...bookingsArray2];
    } else if (req.body.email) {
      const qWithEmail = query + " AND cte1.email = ?";

      const [bookingsArray3] = await mysqlConnection.execute(qWithEmail, [
        req.body.email,
      ]);

      if (bookingsArray3.length == 0) {
        return next(createError("fail", 404, "This user has no booking"));
      }

      bookingsArray = [...bookingsArray3];
    }

    const responseArray = resArray(bookingsArray);

    res.status(200).json({ data: responseArray });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

const deleteBooking = async (req, res, next) => {
  const mysqlConnection = await db();
  try {
    // check if the booking exist
    let q = "SELECT * FROM bookings WHERE id_bookings = ?";
    const [bookingArr, fields] = await mysqlConnection.execute(q, [
      req.params.booking_id,
    ]);
    if (bookingArr.length == 0) {
      return next(createError("fail", 404, "This booking does not exist"));
    }

    q = "DELETE FROM bookings WHERE id_bookings = ?";
    const deleteResult = await mysqlConnection.execute(q, [
      req.params.booking_id,
    ]);

    res.status(204).json("booking has been deleted");
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

module.exports = {
  deleteBooking,
  getAllBookings,
  getMyBookings,
  findCustomerBooking,
};
