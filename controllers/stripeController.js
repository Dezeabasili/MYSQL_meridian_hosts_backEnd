const dotenv = require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Room = require("./../models/rooms");
const Booking = require("./../models/bookings");
const User = require("./../models/users");
const createError = require("../utils/error");
const sendOutMail = require("../utils/handleEmail3");
const db = require("./../utils/mysqlConnectionWithPromise");
const configureQueryStr = require("./../utils/configureQueryString");
const { format } = require("date-fns");


// function to format date
const formatDate = (value) => {
  let date = new Date(value);
  const day = date.toLocaleString('default', { day: '2-digit' });
  const month = date.toLocaleString('default', { month: 'short' });
  const year = date.toLocaleString('default', { year: 'numeric' });
  return day + '-' + month + '-' + year;
}


// function to sort dates
const compareRoomNumbers = (a, b) => {
  return a.roomNumber - b.roomNumber;
};

let bookedRoomsDetails = [];

// app.post('/create-checkout-session', async (req, res) => {
const stripeCheckout = async (req, res, next) => {
  const { selectedRooms, reservedDates, hotel_id } = req.body;
  const mysqlConnection = await db();

  try {
    const numberOfNights = reservedDates.length - 1;

    // get all room styles
    let q;
    q = " SELECT * FROM hotels WHERE id_hotels = ?"
    const [hotelArr] = await mysqlConnection.execute(q, [hotel_id * 1])

    // build the query to get all the booked room styles
    let qstring = "";
    let qvalues = [hotel_id];

    for (let i = 0; i < selectedRooms.length; i++) {
      qstring = qstring + " ?, ";
      qvalues.push(selectedRooms[i]);
    }
    // remove last ,
    let queryString = configureQueryStr(qstring, ",");

    // get the ids of the booked room styles
    q =
      "SELECT * FROM roomnumbers INNER JOIN roomstyledescription " + 
       " ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription " + 
       " INNER JOIN roomstyles ON roomstyles.id_roomStyles = roomstyledescription.id_roomStyles  " + 
       " WHERE roomstyledescription.id_hotels = ? AND  roomnumbers.roomNumber IN ( " + queryString + " )";
    const [selectedRoomsArr, styleFields] = await mysqlConnection.execute(
      q,
      qvalues
    );

    const sortedselectedRoomsArr = selectedRoomsArr.sort(compareRoomNumbers);
    bookedRoomsDetails = [...sortedselectedRoomsArr]

    let line_items = [];
    sortedselectedRoomsArr.forEach((oneRoom) => {
      let sortedObj = {};
      sortedObj.price_data = {
        currency: "usd",
        product_data: {
          name: hotelArr[0].name,
          description: oneRoom.roomStylesNames,
          metadata: {
            id: oneRoom.id_roomStyleDescription,
            // city: roomType.hotel.city,
          },
        },
        unit_amount: oneRoom.price * 100,
      };
      sortedObj.quantity = numberOfNights;
      line_items.push({ ...sortedObj });
    });


    // create customer
    const customer = await stripe.customers.create({
      metadata: {
        userId: req.userInfo.id,
        hotel_id,
        selectedRooms: JSON.stringify(selectedRooms),
        reservedDates: JSON.stringify(reservedDates),
      },
    });

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      line_items,
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/checkout-success`,
      cancel_url: `${process.env.CLIENT_URL}/hotels/${hotel_id}/all`,
    });

    res.send({ url: session.url });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};


const stripeWebHook = async (req, res, next) => {

  let signinSecret = process.env.SIGNING_SECRET;

  const payload = req.body;

  const sig = req.headers["stripe-signature"];

  const mysqlConnection = await db();

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, signinSecret);
  } catch (err) {
    console.log(err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      console.log("inside webhook");

      const customer = await stripe.customers.retrieve(
        event.data.object.customer
      );

      // console.log('customer: ', customer)

      console.log(1);

      const selectedRooms = JSON.parse(customer.metadata.selectedRooms);
      const reservedDates = JSON.parse(customer.metadata.reservedDates);
      const user_id = customer.metadata.userId;
      const hotel_id = customer.metadata.hotel_id;

      const checkin_date = reservedDates[0];
      // const lastNight = reservedDates[reservedDates.length - 1];
      const checkout_date = reservedDates[reservedDates.length - 1];

      console.log("reservedDates: ", reservedDates);
      console.log("checkout_date: ", checkout_date);

      const numberOfNights = reservedDates.length - 1;

      // get all room styles


      console.log(2);

      // update the bookings table
      q =
        "INSERT INTO bookings (id_users, id_hotels, createdAt) VALUES (?, ?, ?)";
      const bookingResults = await mysqlConnection.execute(q, [
        user_id,
        hotel_id,
        format(new Date().toLocaleString(), "yyyy-MM-dd HH:mm:ss"),
      ]);
      const id_bookings = bookingResults[0].insertId;

      // get the last inserted booking
      q = "SELECT * FROM bookings WHERE id_bookings = ?";
      const [bookingArr, bookingFields] = await mysqlConnection.execute(q, [
        id_bookings,
      ]);
      const lastBooking = bookingArr[0];

      console.log(3);

      // build the query string to insert check-in and check-out dates
      let q2 = "";
      let values2 = [];

      for (let i = 0; i < bookedRoomsDetails.length; i++) {
        q2 = q2 + "(?, ?, ?, ?), ";
        values2.push(bookedRoomsDetails[i].id_roomNumbers);
        values2.push(id_bookings);
        values2.push(checkin_date);
        values2.push(checkout_date);
      }

      // remove the last ,
      let queryString2 = configureQueryStr(q2, ",");

      q =
        "INSERT INTO unavailabledates (id_roomNumbers, id_bookings, check_in_date, check_out_date) VALUES " +
        queryString2;
      const unavailableDatesResults = await mysqlConnection.execute(q, values2);

      console.log(4);

      // get the customer details
      q = "SELECT name, email FROM users WHERE id_users = ?";
      const [userArr, usersFields] = await mysqlConnection.execute(q, [
        lastBooking.id_users,
      ]);
      const customerDetails = userArr[0];

      // get the hotel details
      q =
        "SELECT hotels.name, cities.cityName FROM hotels INNER JOIN cities ON hotels.id_cities = cities.id_cities WHERE hotels.id_hotels = ?";
      const [hotelArr, hotelsFields] = await mysqlConnection.execute(q, [
        lastBooking.id_hotels,
      ]);
      const hotelDetails = hotelArr[0];

      console.log(5);

      // get the booked rooms
      q =
        "SELECT * FROM unavailabledates INNER JOIN roomnumbers ON unavailabledates.id_roomNumbers = roomnumbers.id_roomNumbers " + 
        " INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription " + 
        " INNER JOIN roomstyles ON roomstyles.id_roomStyles = roomstyledescription.id_roomStyles WHERE unavailabledates.id_bookings = ?";
      const [bookedRoomsArr, bookedRoomsArrFields] =
        await mysqlConnection.execute(q, [id_bookings]);

      console.log(6);
      // get all the room numbers for this booking
      const bookedRoomNumbers = [];
      bookedRoomsArr.forEach((eachRoom) => {
        bookedRoomNumbers.push(eachRoom.roomNumber);
      });

      // build the customer receipt
      let newBooking = {};
      newBooking.id_bookings = bookingArr[0].id_bookings
      newBooking.user = customerDetails;
      newBooking.hotel = hotelDetails;
      newBooking.createdAt = bookingArr[0].createdAt;
      newBooking.bookingDetails = [];
      // let bookingsArray = []

      bookedRoomNumbers.forEach((selectedRoom, index1) => {
        bookedRoomsArr.forEach((roomType, index2) => {
          if (roomType.roomNumber == selectedRoom) {
            let roomDetails = {};
            roomDetails.roomType_id = roomType.id_roomStyleDescription;
            roomDetails.roomNumber = roomType.roomNumber;
            roomDetails.checkin_date = roomType.check_in_date;
            roomDetails.checkout_date = roomType.check_out_date;
            roomDetails.price_per_night = roomType.price;
            roomDetails.number_of_nights = numberOfNights;
            roomDetails.room_type = roomType.roomStylesNames;

            newBooking.bookingDetails.push({ ...roomDetails });
          }
          // });
        });
      });


    const bookingDate = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: 'CST',
    }).format(newBooking.createdAt)

      let htmlReceipt = ''
      htmlReceipt = htmlReceipt + `<p>Booking reference: ${newBooking.id_bookings}</p>`
      htmlReceipt = htmlReceipt + `<p style="text-transform: capitalize">Customer name: ${customerDetails.name}</p>`
      htmlReceipt = htmlReceipt + `<p style="text-transform: capitalize">Hotel name: <strong>${hotelDetails.name}</strong></p>`
      htmlReceipt = htmlReceipt + `<p>Booking date: ${bookingDate}</p><br/>`
      newBooking.bookingDetails.forEach(detail => {
        htmlReceipt = htmlReceipt + `<p style="text-transform: capitalize">Room type: ${detail.room_type}</p>`
        htmlReceipt = htmlReceipt + `<p>Price per night: $${detail.price_per_night}</p>`
        htmlReceipt = htmlReceipt + `<p>Room number: ${detail.roomNumber}</p>`
        htmlReceipt = htmlReceipt + `<p>Check-in date: ${formatDate(detail.checkin_date)}</p>`
        htmlReceipt = htmlReceipt + `<p>Check-out date: ${formatDate(detail.checkout_date)}</p>`
        htmlReceipt = htmlReceipt + `<p>Number of nights: ${detail.number_of_nights}</p><br/>`
      })


      await sendOutMail(customerDetails, htmlReceipt);
    }

    return res.json({ received: true });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

module.exports = {
  stripeCheckout,
  stripeWebHook,
};
