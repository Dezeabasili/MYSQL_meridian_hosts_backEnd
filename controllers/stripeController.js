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

// function to get an array of all the intended reservation dates
const reservationDates = (firstDay, lastDay) => {
  let startDate = new Date(firstDay);
  let lastDate = new Date(lastDay);
  // check if the check-in date and the check-out date are the same
  // by comparing the year, month and day
  if (
    startDate.getFullYear() === lastDate.getFullYear() &&
    startDate.getMonth() === lastDate.getMonth() &&
    startDate.getDate() === lastDate.getDate()
  ) {
    // add a day to the check-in date
    lastDate.setDate(startDate.getDate() + 1);
  }
  // format(new Date(), "yyyy-MM-dd")
  let reservationDays = [];

  while (startDate < lastDate) {
    // reservationDays.push(new Date(startDate));
    reservationDays.push(format(new Date(startDate), "yyyy-MM-dd"));
    // increase the day by 1
    startDate.setDate(startDate.getDate() + 1);
  }

  return reservationDays;
};

// function to sort dates
const compareNumbers = (a, b) => {
  return new Date(a).getTime() - new Date(b).getTime();
};

const updateRoomAvailability = async (room_id, reservedDates) => {
  // console.log(req.body.reservedDates)

  const compareNumbers = (a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  };
  try {
    // get the room style to update
    const roomStyle = await Room.findOne({ "roomNumbers._id": room_id });
    // console.log(roomStyle)
    // get the room to update
    // console.log(roomStyle.roomNumbers[0]?._id)
    const room = roomStyle.roomNumbers.find(({ _id }) => _id == room_id);
    // console.log(room)

    // update the unavailable dates for the room
    const unavailableDates = room.unavailableDates.concat(reservedDates);
    // console.log(unavailableDates)
    if (unavailableDates.length >= 2) {
      unavailableDates.sort(compareNumbers);
    }

    // room.unavailableDates = [...unavailableDates]
    roomStyle.roomNumbers = roomStyle.roomNumbers.map((roomNumber) => {
      if (roomNumber._id == room_id) {
        return {
          ...roomNumber,
          unavailableDates: [...unavailableDates],
        };
      } else return roomNumber;
    });

    // console.log(roomStyle)

    await Room.updateOne(
      { "roomNumbers._id": room_id },
      {
        $set: {
          "roomNumbers.$.unavailableDates": unavailableDates,
        },
      }
    );

    // save the updated room
    // await roomStyle.save();
  } catch (err) {
    console.log(err);
  }
};

// app.post('/create-checkout-session', async (req, res) => {
const stripeCheckout = async (req, res, next) => {
  const { selectedRooms, reservedDates, hotel_id } = req.body;

  try {
    const numberOfNights = reservedDates.length;

    // get all room styles
    const mysqlConnection = await db();

    // get all the room styles
    // console.log(1);
    let q = "SELECT * FROM roomstyledescription";
    const [roomStyleDescriptionArray, fields1] = await mysqlConnection.execute(
      q,
      []
    );
    if (roomStyleDescriptionArray.length == 0)
      return next(
        createError("fail", 404, "There is no room style in the database")
      );

    let outputString =
      "roomstyledescription.id_roomStyleDescription, roomstyledescription.id_hotels, roomstyledescription.id_roomStyles, roomstyledescription.price, roomstyledescription.maxPeople, roomstyledescription.description, hotels.name, cities.cityName ";
    q =
      "SELECT " +
      outputString +
      " FROM roomstyledescription INNER JOIN hotels ON roomstyledescription.id_hotels = hotels.id_hotels INNER JOIN cities ON cities.id_cities = hotels.id_cities WHERE hotels.id_hotels = ?";
    const [roomStyleArr, fields6] = await mysqlConnection.execute(q, [hotel_id]);

    // get all the room numbers
    q =
      "SELECT * FROM roomstyledescription INNER JOIN roomnumbers ON roomstyledescription.id_roomStyleDescription = roomnumbers.id_roomStyleDescription INNER JOIN roomstyles ON roomstyledescription.id_roomStyles = roomstyles.id_roomStyles WHERE roomstyledescription.id_hotels = ?";
    const [roomNumArr, fields7] = await mysqlConnection.execute(q, [hotel_id]);

    // get the unavailable dates for every room
    q =
      "SELECT * FROM roomstyledescription INNER JOIN roomnumbers ON roomstyledescription.id_roomStyleDescription = roomnumbers.id_roomStyleDescription INNER JOIN unavailabledates ON roomnumbers.id_roomNumbers = unavailabledates.id_roomNumbers WHERE roomstyledescription.id_hotels = ?";
    const [unavailableDatesArray, fields8] = await mysqlConnection.execute(
      q,
      [hotel_id]
    );

    // get all the room style photos
    q =
      "SELECT * FROM roomstylesphotos INNER JOIN roomstyledescription ON roomstylesphotos.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription WHERE roomstyledescription.id_hotels = ?";
    const [roomStylePhotosArray, fields9] = await mysqlConnection.execute(
      q,
      [hotel_id]
    );

    let responseArray = [];

    roomStyleArr.forEach((eachRoomStyle, index1) => {
      // create the room objects with room numbers and the unavailable dates array
      let roomStyleObj = {};
      roomStyleObj.roomNumbers = [];
      let roomNums = [];
      let datesArray = [];
      let name;
      roomNumArr.forEach((eachRoom, index2) => {
        let roomObj = {};

        if (
          eachRoomStyle.id_hotels == eachRoom.id_hotels &&
          eachRoomStyle.id_roomStyles == eachRoom.id_roomStyles
        ) {
          roomObj.number = eachRoom.roomNumber;
          roomObj.unavailableDates = datesArray;
          roomNums.push(roomObj);
          name = eachRoom.roomStylesNames;
        }
      });

      // add the unavailable dates for each room
      roomNums.forEach((room) => {
        unavailableDatesArray.forEach((eachReservation) => {
          if (
            eachRoomStyle.id_hotels == eachReservation.id_hotels &&
            eachRoomStyle.id_roomStyles == eachReservation.id_roomStyles
          ) {
            if (room.number == eachReservation.roomNumber) {
              room.unavailableDates = [
                ...room.unavailableDates,
                ...reservationDates(
                  eachReservation.check_in_date,
                  eachReservation.check_out_date
                ),
              ];
              room.unavailableDates =
                room.unavailableDates.sort(compareNumbers);
            }
          }
        });
        roomStyleObj.roomNumbers.push(room);
      });

      // add all the room style photos
      let picArray = [];
      let pic_idArray = [];
      roomStylePhotosArray.forEach((eachPhoto) => {
        if (
          eachRoomStyle.id_hotels == eachPhoto.id_hotels &&
          eachRoomStyle.id_roomStyles == eachPhoto.id_roomStyles
        ) {
          picArray.push(eachPhoto.photos);
          pic_idArray.push(eachPhoto.photo_id);
        }
      });

      // add the hotel object
      let hotelObj = {};
      hotelObj.name = eachRoomStyle.name;
      hotelObj.city = eachRoomStyle.cityName;

      roomStyleObj.id_roomStyleDescription =
        eachRoomStyle.id_roomStyleDescription;
      roomStyleObj.title = name;
      roomStyleObj.price = eachRoomStyle.price;
      roomStyleObj.maxPeople = eachRoomStyle.maxPeople;
      roomStyleObj.description = eachRoomStyle.description;
      roomStyleObj.photos = picArray;
      roomStyleObj.photo_id = pic_idArray;
      roomStyleObj.hotel = hotelObj;

      responseArray.push(roomStyleObj);
    });

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
      "SELECT * FROM roomnumbers INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription WHERE roomstyledescription.id_hotels = ? AND  roomnumbers.roomNumber IN ( " +
      queryString +
      " )";
    const [selectedRoomsArr, styleFields] = await mysqlConnection.execute(
      q,
      qvalues
    );

    let roomTypeArray = [];
    let styleCode = []
    selectedRoomsArr.forEach((eachStyle) => {
     

      // continue editing from here after breakfast
      responseArray.forEach((eachRoomStyle) => {
        if (eachStyle.id_roomStyleDescription == eachRoomStyle.id_roomStyleDescription) {
          if (!styleCode.includes(eachStyle.id_roomStyleDescription)) {
            styleCode.push(eachStyle.id_roomStyleDescription)
            roomTypeArray.push(eachRoomStyle)
          }
        }
        


        // if (
        //   eachStyle.id_roomStyleDescription ==
        //   eachRoomStyle.id_roomStyleDescription
        // ) {
        //   roomTypeArray.push(eachRoomStyle);
        // }
      });
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

    // console.log('customer: ', customer)

    let line_items = [];

    // console.log("responseArray: ", responseArray)
    // console.log("selectedRoomsArr: ", selectedRoomsArr)
    // console.log("selectedRooms: ", selectedRooms)
    // console.log("roomTypeArray: ", roomTypeArray)

    selectedRooms.forEach((room) => {
      roomTypeArray.forEach((roomType) => {
        roomType.roomNumbers.forEach((roomNumber) => {
          if (roomNumber.number == room) {
            let Obj = {};
            Obj.price_data = {
              currency: "usd",
              product_data: {
                name: roomType.hotel.name,
                description: roomType.title,
                metadata: {
                  id: roomType.id_roomStyleDescription,
                  // city: roomType.hotel.city,
                },
              },
              unit_amount: roomType.price * 100,
            };
            Obj.quantity = numberOfNights;
            line_items.push({ ...Obj });
          }
        });
      });
    });

    // console.log("line_items: ", line_items);

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
  }
};



const stripeWebHook = async (req, res, next) => {
  let signinSecret = process.env.SIGNING_SECRET;
  const payload = req.body;

  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, signinSecret);
  } catch (err) {
    console.log(err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      // console.log("inside webhook");

      const customer = await stripe.customers.retrieve(
        event.data.object.customer
      );

      // console.log('customer: ', customer)

      const selectedRooms = JSON.parse(customer.metadata.selectedRooms);
      const reservedDates = JSON.parse(customer.metadata.reservedDates);
      const user_id = customer.metadata.userId;
      const hotel_id = customer.metadata.hotel_id;

      const checkin_date = reservedDates[0];
      const lastNight = reservedDates[reservedDates.length - 1];

      const dateObj = new Date(lastNight);
      dateObj.setDate(dateObj.getDate() + 1);
      const checkout_date = dateObj;
      // console.log("Check out date: ", dateObj);
      // console.log("Check in date: ", checkin_date);
      // console.log("last night: ", lastNight);

      const numberOfNights = reservedDates.length;

      // get all room styles
      const mysqlConnection = await db();

      // update the bookings table
      q = "INSERT INTO bookings (id.users, id_hotels, createdAt) VALUES (?, ?, ?)";
      const bookingResults = await mysqlConnection.execute(q, [
        user_id,
        hotel_id,
        format(new Date().toLocaleString(), "yyyy-MM-dd hh-mm-ss bbb")
      ]);
      const id_bookings = bookingResults[0].insertId;

      // get the last inserted booking
      q = "SELECT * FROM bookings WHERE id_bookings = ?";
      const [bookingArr, bookingFields] = await mysqlConnection.execute(q, [
        id_bookings,
      ]);
      const lastBooking = bookingArr[0];

      // build the query string to insert check-in and check-out dates
      let q2 = "";
      let values2 = [];

      for (let i = 0; i < selectedStyleArr.length; i++) {
        q2 = q2 + "(?, ?, ?, ?), ";
        values2.push(selectedStyleArr[i].id_roomNumbers);
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

      // get the booked rooms
      q =
        "SELECT * FROM unavailabledates INNER JOIN roomnumbers ON unavailabledates.id_roomNumbers = roomnumbers.id_roomNumbers INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription INNER JOIN roomstyles ON roomstyles.id_roomStyles = roomstyledescription.id_roomStyles WHERE unavailabledates.id_bookings = ?";
      const [bookedRoomsArr, bookedRoomsArrFields] =
        await mysqlConnection.execute(q, [id_bookings]);

      // get all the room numbers for this booking
      const bookedRoomNumbers = [];
      bookedRoomsArr.forEach((eachRoom) => {
        bookedRoomNumbers.push(eachRoom.roomNumber);
      });

      // build the customer receipt
      let newBooking = {};
      newBooking.user = customerDetails;
      newBooking.hotel = hotelDetails;
      newBooking.createdAt = bookingArr[0].createdAt;
      newBooking.bookingDetails = [];
      // let bookingsArray = []

      bookedRoomNumbers.forEach((selectedRoom, index1) => {
        bookedRoomsArr.forEach((roomType, index2) => {
          // roomType.roomNumbers.forEach((roomNumber, index3) => {
          // if (roomNumber.number == selectedRoom) {
          if (roomType.roomNumber == selectedRoom) {
            let roomDetails = {};
            roomDetails.roomType_id = roomType.id_roomStyleDescription;
            // roomDetails.room_id = selectedRoom;
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

   

      await sendOutMail(customerDetails, newBooking);
    }

    //   console.log(event.type)
    //   console.log(event.data.object)
    return res.json({ received: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  stripeCheckout,
  stripeWebHook,
};

