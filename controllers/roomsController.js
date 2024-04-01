const createError = require("./../utils/error");
const Room = require("./../models/rooms");
const Hotel = require("./../models/hotels");
const Booking = require("./../models/bookings");
const db = require("./../utils/mysqlConnectionWithPromise");
const { format } = require("date-fns");
const configureQueryStr = require("./../utils/configureQueryString");
// const bookings = require("./../models/bookings");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});


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

const createRoom = async (req, res, next) => {
  const mysqlConnection = await db();
  try {
    let results1;
    let roomStyle;

    // check if the hotel exist
    let q = "SELECT name FROM hotels WHERE id_hotels = ?";
    const [hotelArray] = await mysqlConnection.execute(q, [
      req.body.hotel * 1,
    ]);
    if (hotelArray.length == 0)
      return next(
        createError("fail", 404, "the hotel you specified does not exist")
      );
    const hotel = hotelArray[0];

    // check if the room style name exists
    q = "SELECT * FROM roomstyles WHERE roomStylesNames = ?";
    const [roomStylesArray] = await mysqlConnection.execute(q, [
      req.body.title.toLowerCase(),
    ]);
    // create the room style if it does not exist
    if (roomStylesArray.length == 0) {
  
      q = "INSERT INTO roomstyles (roomStylesNames) VALUES (?)";
      const result = await mysqlConnection.execute(q, [
        req.body.title.toLowerCase(),
      ]);
      results1 = result[0].insertId;

      // retrieve the newly created room style
      q = "SELECT * FROM roomstyles WHERE id_roomStyles = ?";
      const [roomStylesArray2] = await mysqlConnection.execute(q, [
        results1,
      ]);
      roomStyle = roomStylesArray2[0];
      // console.log(2);
    } else {
      roomStyle = roomStylesArray[0];
      results1 = roomStylesArray[0].id_roomStyles;
    }
    // console.log(3);

    // check if any of the provided room numbers already exist in the hotel
    q = "SELECT * FROM roomnumbers INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription   WHERE roomstyledescription.id_hotels = ?";
    const [hotelRoomNumbersArray] = await mysqlConnection.execute(q, [
      req.body.hotel * 1,
    ]);

    const givenRoomNumbers = [...req.body.roomNumbers];
    let existingRoomNumbers = [];
    givenRoomNumbers.forEach((givenRoom) => {
      hotelRoomNumbersArray.forEach((hotelRoom) => {
        if (hotelRoom.roomNumber == givenRoom) {
          existingRoomNumbers.push(givenRoom);
        }
      });
    });

    if (existingRoomNumbers.length > 0) {
      return next(
        createError(
          "fail",
          404,
          `the following room numbers already exist in the hotel ${existingRoomNumbers}`
        )
      );
    }

    // console.log(4);

    // create the new room style in the given hotel
    q =
      "INSERT INTO roomstyledescription (id_roomStyles, id_hotels, price, maxPeople, description) VALUES (?, ?, ?, ?, ?)";
    const result2 = await mysqlConnection.execute(q, [
      results1,
      req.body.hotel * 1,
      req.body.price * 1,
      req.body.maxPeople * 1,
      req.body.description,
    ]);
    // console.log('result2: ', result2)
    // console.log(5);

    // retrieve the newly created room style
    q =
      "SELECT * FROM roomstyledescription WHERE id_roomStyleDescription = ?";
    const [roomStyleDescriptionArray] = await mysqlConnection.execute(
      q,
      [result2[0].insertId]
    );
    
    const roomStyleDescription = roomStyleDescriptionArray[0];
    // console.log(6);

    // build the query string to insert the room numbers
    let q2 = "";
    let values2 = [];

    for (let i = 0; i < req.body.roomNumbers.length; i++) {
      q2 = q2 + "(?, ?), ";
    
      values2.push(roomStyleDescriptionArray[0].id_roomStyleDescription);
      values2.push(req.body.roomNumbers[i] * 1);
    }

    // remove the last ,
    queryString2 = configureQueryStr(q2, ",");
    // console.log(7);

    // insert the given room numbers
    q =
      "INSERT INTO roomnumbers (id_roomStyleDescription, roomNumber) VALUES " +
      queryString2;
    const result3 = await mysqlConnection.execute(q, values2);
    q = "SELECT * FROM roomnumbers INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription WHERE roomstyledescription.id_roomStyles = ? AND roomstyledescription.id_hotels = ?";
    const [roomNumberArray] = await mysqlConnection.execute(q, [
      results1,
      req.body.hotel * 1,
    ]);
    // console.log("roomNumberArray: ", roomNumberArray);
    console.log("result3[0].insertId: ", result3[0].insertId);
    console.log("result3: ", result3);

    // console.log(8);

    let rooms = [];
    roomNumberArray.forEach((eachRoom) => {
      // rooms.push(eachRoom.roomNumber)
      rooms.push({ number: eachRoom.roomNumber, unavailableDates: [] });
    });
    let room = {};
    room.title = roomStyle.roomStylesNames;
    room.price = roomStyleDescription.price;
    room.maxPeople = roomStyleDescription.maxPeople;
    room.description = roomStyleDescription.description;
    room.id_roomStyleDescription = roomStyleDescription.id_roomStyleDescription;
    room.roomNumbers = rooms;
    room.hotel = hotel;

    // console.log(9);

    // recalculate the minimum price of the rooms in this hotel
    q = "SELECT MIN(price) AS minPrice FROM roomstyledescription GROUP BY id_hotels HAVING id_hotels = ?"
    const [minPriceArr] = await mysqlConnection.execute(q, [req.body.hotel * 1])
    
    q = "UPDATE hotels SET `cheapestPrice` = ? WHERE id_hotels = ?"
    const updatedHotelResult = await mysqlConnection.execute(q, [minPriceArr[0]?.minPrice || 0, req.body.hotel * 1])
    
    res.status(201).json({
      success: true,
      data: room,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};


const updateRoom = async (req, res, next) => {
  const mysqlConnection = await db();
  try {
 
    // console.log(1);
    // check if room style exist in the given hotel
    let q =
      "SELECT * FROM roomstyledescription WHERE id_roomStyleDescription = ?";
    const [roomStyleDescriptionArray] = await mysqlConnection.execute(
      q,
      [req.params.room_id]
    );
    if (roomStyleDescriptionArray.length == 0)
      return next(
        createError("fail", 404, "the room style you specified does not exist")
      );
    const givenRoomStyle = roomStyleDescriptionArray[0];
    const oldRoomStyleId = givenRoomStyle.id_roomStyles;
    // console.log(2);

    let newRoomStyleId = givenRoomStyle.id_roomStyles;
    let roomStyle;
    if (req.body.title) {
      // check if room style name exist
      q = "SELECT * FROM roomstyles WHERE roomStylesNames = ?";
      const [roomStylesArray] = await mysqlConnection.execute(q, [
        req.body.title.toLowerCase(),
      ]);
      // console.log("1a");

      if (roomStylesArray.length == 0) {
        console.log("1b");
        q = "INSERT INTO roomstyles (roomStylesNames) VALUES (?)";
        const result = await mysqlConnection.execute(q, [
          req.body.title.toLowerCase(),
        ]);
        let results1 = result[0].insertId;

        q = "SELECT * FROM roomstyles WHERE id_roomStyles = ?";
        const [roomStylesArray2] = await mysqlConnection.execute(q, [
          results1,
        ]);
        // roomStyle = roomStylesArray2[0];
        newRoomStyleId = roomStylesArray2[0].id_roomStyles;
        // console.log(3);
      } else {
        // console.log("3a");
        newRoomStyleId = roomStylesArray[0].id_roomStyles;
      }

      // update the id_roomStyles in the roomnumbers table
      q =
        "UPDATE roomstyledescription SET `id_roomStyles` = ? WHERE id_roomStyleDescription = ? ";
      const roomStyleDescriptionResult = await mysqlConnection.execute(q, [
        newRoomStyleId,
        roomStyleDescriptionArray[0].id_roomStyleDescription,
      ]);
      
    }

    // console.log(4);
    let roomNumbers2 = [];
    if (req.body.addRooms) {
      // check if any of the provided room numbers already exist in the hotel
      q = "SELECT * FROM roomnumbers INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription WHERE roomstyledescription.id_hotels = ?";
      const [hotelRoomNumbersArray] = await mysqlConnection.execute(
        q,
        [givenRoomStyle.id_hotels]
      );

      const givenRoomNumbers2 = req.body.addRooms.split(",");
      givenRoomNumbers2.forEach((givenRoom) => {
        roomNumbers2.push(givenRoom * 1);
      });

      // console.log("roomNumbers2:", roomNumbers2);
      // const givenRoomNumbers = [...req.body.roomNumbers]
      let existingRoomNumbers = [];
      roomNumbers2.forEach((givenRoom) => {
        hotelRoomNumbersArray.forEach((hotelRoom) => {
          if (hotelRoom.roomNumber == givenRoom) {
            existingRoomNumbers.push(givenRoom);
          }
        });
      });
      // console.log(5);
      if (existingRoomNumbers.length > 0) {
        return next(
          createError(
            "fail",
            404,
            `the following room numbers already exist in the hotel ${existingRoomNumbers}`
          )
        );
      }
    }

    // console.log(6);
    let roomNumbers3 = [];
    if (req.body.removeRooms) {
      // check if any of the provided room numbers does not exist for this room style in the hotel
      // q = "SELECT * FROM roomnumbers INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription WHERE roomstyledescription.id_hotels = ? AND roomstyledescription.id_roomStyles = ?";
      q = "SELECT * FROM roomnumbers INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription WHERE roomstyledescription.id_hotels = ?";
      const [hotelRoomNumbersArray] = await mysqlConnection.execute(
        q,
        [givenRoomStyle.id_hotels]
        // [givenRoomStyle.id_hotels, givenRoomStyle.id_roomStyles]
      );
      const hotelStyleRooms = hotelRoomNumbersArray.map((room) => {
        return room.roomNumber;
      });

      const givenRoomNumbers3 = req.body.removeRooms.split(",");
      givenRoomNumbers3.forEach((givenRoom) => {
        roomNumbers3.push(givenRoom * 1);
      });

      // console.log("roomNumbers3:", roomNumbers3);
      let nonexistingRoomNumbers = [];
      roomNumbers3.forEach((num) => {
        if (!hotelStyleRooms.includes(num)) {
          nonexistingRoomNumbers.push(num);
        }
      });

      if (nonexistingRoomNumbers.length > 0) {
        return next(
          createError(
            "fail",
            404,
            `the following room numbers do not exist for the room style provided ${nonexistingRoomNumbers}`
          )
        );
      }
    }

    // console.log(7);

    // configure query string
    let queryString1 = "";
    let values1 = [];
    if (req.body.price) {
      queryString1 = queryString1 + " `price` = ?, ";
      values1.push(req.body.price * 1);
    }
    // console.log(8);

    if (req.body.maxPeople) {
      queryString1 = queryString1 + " `maxPeople` = ?, ";
      values1.push(req.body.maxPeople * 1);
    }

    if (req.body.description) {
      queryString1 = queryString1 + " `description` = ?, ";
      values1.push(req.body.description);
    }

    //   // remove the last ,
    // let queryString2 = configureQueryStr(queryString1, ",")

    q =
      "UPDATE roomstyledescription SET " +
      queryString1 +
      " `id_roomStyles` = ? WHERE id_roomStyleDescription = ?";
    values1.push(newRoomStyleId);
    values1.push(req.params.room_id * 1);
    const results2 = await mysqlConnection.execute(q, values1);

    // console.log(9);

    if (req.body.addRooms) {
      let qstring = "";
      let qvalues = [];
      for (let i = 0; i < roomNumbers2.length; i++) {
        qstring = qstring + " (?, ?), ";
        qvalues.push(givenRoomStyle.id_roomStyleDescription);
        // qvalues.push(newRoomStyleId);
        qvalues.push(roomNumbers2[i]);
      }
      // remove last ,
      let queryString2 = configureQueryStr(qstring, ",");

      q =
        "INSERT INTO roomnumbers (id_roomStyleDescription, roomNumber) VALUES " +
        queryString2;
      const results3 = await mysqlConnection.execute(q, qvalues);
    }

    // console.log(10);
    if (req.body.removeRooms) {
      let qstring1 = "";
      let qvalues1 = [];
      qvalues1.push(givenRoomStyle.id_hotels);
      // qvalues.push(givenRoomStyle.id_hotels)
      // qvalues.push(results1)

      for (let i = 0; i < roomNumbers3.length; i++) {
        qstring1 = qstring1 + " ?, ";
        qvalues1.push(roomNumbers3[i]);
      }
      // remove last ,
      let queryString3 = configureQueryStr(qstring1, ",");

      // get bookings to delete
      q =
        "SELECT * FROM roomstyledescription INNER JOIN roomnumbers ON roomstyledescription.id_roomStyleDescription = roomnumbers.id_roomStyleDescription  INNER JOIN unavailabledates " + 
        " ON roomnumbers.id_roomNumbers = unavailabledates.id_roomNumbers WHERE roomstyledescription.id_hotels = ? AND roomnumbers.roomNumber IN ( " +
        queryString3 +
        " )";
      const [roomsToDeleteArray] = await mysqlConnection.execute(
        q,
        qvalues1
      );

      const bookingsToDelete = roomsToDeleteArray.map((room) => {
        return room.id_bookings;
      });

      // console.log("roomsToDeleteArray: ", roomsToDeleteArray);
      // console.log("bookingsToDelete: ", bookingsToDelete);

      let qstring = "";
      let qvalues = [];
      qvalues.push(givenRoomStyle.id_roomStyleDescription);
      // qvalues.push(newRoomStyleId);

      for (let i = 0; i < roomNumbers3.length; i++) {
        qstring = qstring + " ?, ";
        qvalues.push(roomNumbers3[i]);
      }
      // remove last ,
      let queryString2 = configureQueryStr(qstring, ",");

      q =
        "DELETE FROM roomnumbers WHERE id_roomStyleDescription = ? AND roomNumber IN (" +
        queryString2 +
        ")";
      const results4 = await mysqlConnection.execute(q, qvalues);

      // console.log("10B");

      // If roomsToDeleteArray is an empty array, this means the rooms deleted have no reservations
      if (roomsToDeleteArray.length > 0) {
        let qstring3 = "";
        let qvalues3 = [];

        for (let i = 0; i < bookingsToDelete.length; i++) {
          qstring3 = qstring3 + " ?, ";
          qvalues3.push(bookingsToDelete[i]);
        }
        // remove last ,
        let queryString4 = configureQueryStr(qstring3, ",");

        q = "DELETE FROM bookings WHERE id_bookings IN (" + queryString4 + ")";
        const results5 = await mysqlConnection.execute(q, qvalues3);
      }
    }

    // recalculate the minimum price of the rooms in this hotel
    q = "SELECT MIN(price) AS minPrice FROM roomstyledescription GROUP BY id_hotels HAVING id_hotels = ?"
    const [minPriceArr] = await mysqlConnection.execute(q, [roomStyleDescriptionArray[0].id_hotels])
    
    q = "UPDATE hotels SET `cheapestPrice` = ? WHERE id_hotels = ?"
    const updatedHotelResult = await mysqlConnection.execute(q, [minPriceArr[0]?.minPrice || 0, roomStyleDescriptionArray[0].id_hotels])
   
    res.status(200).json({
      success: true
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};


const deleteRoom = async (req, res, next) => {
  const mysqlConnection = await db();
  try {

    // check if the room style exist
    let q =
      "SELECT * FROM roomstyledescription WHERE id_roomStyleDescription = ?";
    const [roomStyleArr] = await mysqlConnection.execute(q, [
      req.params.room_id,
    ]);
    if (roomStyleArr.length == 0)
      return next(
        createError("fail", 404, "The room style you specified does not exist")
      );
    // console.log(1);
    // get all the bookings associated with this room style
    q =
      "SELECT * FROM roomstyledescription INNER JOIN roomnumbers ON roomstyledescription.id_roomStyleDescription = roomnumbers.id_roomStyleDescription " + 
      " INNER JOIN unavailabledates ON roomnumbers.id_roomNumbers = unavailabledates.id_roomNumbers WHERE roomstyledescription.id_hotels = ? AND roomstyledescription.id_roomStyles = ?";
    const [bookingsArr] = await mysqlConnection.execute(q, [
      roomStyleArr[0].id_hotels,
      roomStyleArr[0].id_roomStyles,
    ]);

    // get all the photos of this room style
    q = "SELECT * FROM roomstylesphotos WHERE id_roomStyleDescription = ? "
    const [roomStylePhotos] = await mysqlConnection.execute(q, [req.params.room_id])

    // console.log(2);
    // delete the room style
    q = "DELETE FROM roomstyledescription WHERE id_roomStyleDescription = ?";
    const results = await mysqlConnection.execute(q, [req.params.room_id]);

    // console.log(3);
    //build the query string to delete the bookings
    let qstring3 = "";
    let qvalues3 = [];

    for (let i = 0; i < bookingsArr.length; i++) {
      qstring3 = qstring3 + " ?, ";
      qvalues3.push(bookingsArr[i].id_bookings);
    }
    // remove last ,
    let queryString4 = configureQueryStr(qstring3, ",");
    if (bookingsArr.length > 0) {
      q = "DELETE FROM bookings WHERE id_bookings IN (" + queryString4 + ")";
      const results2 = await mysqlConnection.execute(q, qvalues3);
    }

     //delete the photos on Cloudinary
     if (roomStylePhotos.length) {
      for (let i = 0; i < roomStylePhotos.length; i++) {
        await cloudinary.uploader.destroy(roomStylePhotos[i].photo_id);
      }
    }

    // console.log(4);

    // recalculate the minimum price of the rooms in this hotel
    q = "SELECT MIN(price) AS minPrice FROM roomstyledescription GROUP BY id_hotels HAVING id_hotels = ?"
    const [minPriceArr] = await mysqlConnection.execute(q, [roomStyleArr[0].id_hotels])

    // console.log("minPriceArr: ", minPriceArr)


    
    q = "UPDATE hotels SET `cheapestPrice` = ? WHERE id_hotels = ?"
    const updatedHotelResult = await mysqlConnection.execute(q, [minPriceArr[0]?.minPrice || 0, roomStyleArr[0].id_hotels])


    res.status(204).json("Room has been deleted.");
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

const getRoom = async (req, res, next) => {
  const mysqlConnection = await db();
  try {

    // console.log(1);
    // check if room style exist in the given hotel
    let q =
      "SELECT * FROM roomstyledescription WHERE id_roomStyleDescription = ?";
    const [roomStyleDescriptionArray] = await mysqlConnection.execute(
      q,
      [req.params.room_id]
    );
    if (roomStyleDescriptionArray.length == 0)
      return next(
        createError("fail", 404, "the room style you specified does not exist")
      );
    const givenRoomStyle = roomStyleDescriptionArray[0];
    const oldRoomStyleId = givenRoomStyle.id_roomStyles;

    let newRoomStyleId = givenRoomStyle.id_roomStyles;

    // get the updated room style
    let outputString =
      "roomstyledescription.id_roomStyleDescription, roomstyledescription.id_hotels, roomstyledescription.id_roomStyles, roomstyledescription.price, roomstyledescription.maxPeople, roomstyledescription.description, hotels.name, cities.cityName ";
    q =
      "SELECT " +
      outputString +
      " FROM roomstyledescription INNER JOIN hotels ON roomstyledescription.id_hotels = hotels.id_hotels INNER JOIN cities ON cities.id_cities = hotels.id_cities WHERE roomstyledescription.id_roomStyleDescription = ?";
    const [roomStyleArr] = await mysqlConnection.execute(q, [
      req.params.room_id,
    ]);
    const updatedRoomStyle = roomStyleArr[0];
    // console.log("updatedRoomStyle: ", updatedRoomStyle);

    // console.log(12);
    // get all the room numbers associated with the updated room style
    q =
      "SELECT * FROM roomstyledescription INNER JOIN roomnumbers ON roomstyledescription.id_roomStyleDescription = roomnumbers.id_roomStyleDescription INNER JOIN roomstyles " + 
      " ON roomstyledescription.id_roomStyles = roomstyles.id_roomStyles   WHERE roomstyledescription.id_hotels = ? AND roomstyledescription.id_roomStyles = ?";
    const [roomNumArr] = await mysqlConnection.execute(q, [
      updatedRoomStyle.id_hotels,
      updatedRoomStyle.id_roomStyles,
    ]);
    // console.log("roomNumArr: ", roomNumArr);

    // console.log(13);

    // get the unavailable dates for every room of this room style
    q =
      "SELECT * FROM roomstyledescription INNER JOIN roomnumbers ON roomstyledescription.id_roomStyleDescription = roomnumbers.id_roomStyleDescription INNER JOIN unavailabledates " + 
      " ON roomnumbers.id_roomNumbers = unavailabledates.id_roomNumbers WHERE roomstyledescription.id_hotels = ? AND roomstyledescription.id_roomStyles = ?";
    const [unavailableDatesArray] = await mysqlConnection.execute(q, [
      updatedRoomStyle.id_hotels,
      updatedRoomStyle.id_roomStyles,
    ]);

    // console.log(14);

    // get all the room style photos
    q =
      "SELECT * FROM roomstylesphotos INNER JOIN roomstyledescription ON roomstylesphotos.id_roomstyleDescription = roomstyledescription.id_roomstyleDescription " + 
      " WHERE roomstyledescription.id_hotels = ? AND roomstyledescription.id_roomStyles = ?";
    const [roomStylePhotosArray] = await mysqlConnection.execute(q, [
      updatedRoomStyle.id_hotels,
      updatedRoomStyle.id_roomStyles,
    ]);

    // console.log(15);

    // create the room objects with room numbers and the unavailable dates array
    let roomStyleObj = {};
    roomStyleObj.roomNumbers = [];
    let roomNums = [];
    let datesArray = [];
    roomNumArr.forEach((eachRoom) => {
      let roomObj = {};
      roomObj.number = eachRoom.roomNumber;
      roomObj.unavailableDates = datesArray;
      roomNums.push(roomObj);
    });

    // add the unavailable dates
    roomNums.forEach((room) => {
      unavailableDatesArray.forEach((eachReservation) => {
        if (room.number == eachReservation.roomNumber) {
          room.unavailableDates = [
            ...room.unavailableDates,
            ...reservationDates(
              eachReservation.check_in_date,
              eachReservation.check_out_date
            ),
          ];
          room.unavailableDates = room.unavailableDates.sort(compareNumbers);
        }
      });
      roomStyleObj.roomNumbers.push(room);
    });

    // add all the room style photos
    let picArray = [];
    let pic_idArray = [];
    roomStylePhotosArray.forEach((eachPhoto) => {
      picArray.push(eachPhoto.photos);
      pic_idArray.push(eachPhoto.photo_id);
    });

    // add the hotel object
    let hotelObj = {};
    hotelObj.name = updatedRoomStyle.name;
    hotelObj.city = updatedRoomStyle.cityName;

    // update the response object
    roomStyleObj.title = roomNumArr[0].roomStylesNames;
    roomStyleObj.price = updatedRoomStyle.price;
    roomStyleObj.maxPeople = updatedRoomStyle.maxPeople;
    roomStyleObj.description = updatedRoomStyle.description;
    roomStyleObj.id_roomStyleDescription =
      updatedRoomStyle.id_roomStyleDescription;
    roomStyleObj.photos = picArray;
    roomStyleObj.photo_id = pic_idArray;
    roomStyleObj.hotel = hotelObj;

    // const room = await Room.findById(req.params.room_id).populate("hotel");
    // if (!room)
    //   return next(
    //     createError("fail", 404, "the room you specified does not exist")
    //   );

    console.log("roomStyleObj: ", roomStyleObj)
    res.status(200).json({
      success: true,
      data: roomStyleObj,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};



const getAllRooms = async (req, res, next) => {
  const mysqlConnection = await db();
  try {
    // get all the room styles
    // console.log(1);
    let q = "SELECT * FROM roomstyledescription";
    const [roomStyleDescriptionArray] = await mysqlConnection.execute(
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
      " FROM roomstyledescription INNER JOIN hotels ON roomstyledescription.id_hotels = hotels.id_hotels INNER JOIN cities ON cities.id_cities = hotels.id_cities";
    const [roomStyleArr] = await mysqlConnection.execute(q, []);

    // get all the room numbers
    q =
      "SELECT * FROM roomstyledescription INNER JOIN roomnumbers ON roomstyledescription.id_roomStyleDescription = roomnumbers.id_roomStyleDescription INNER JOIN roomstyles ON roomstyledescription.id_roomStyles = roomstyles.id_roomStyles";
    const [roomNumArr] = await mysqlConnection.execute(q, []);

    // get the unavailable dates for every room
    q =
      "SELECT * FROM roomnumbers INNER JOIN unavailabledates ON roomnumbers.id_roomNumbers = unavailabledates.id_roomNumbers";
    const [unavailableDatesArray] = await mysqlConnection.execute(
      q,
      []
    );

    // get all the room style photos
    q =
      "SELECT * FROM roomstylesphotos INNER JOIN roomstyledescription ON roomstylesphotos.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription";
    const [roomStylePhotosArray] = await mysqlConnection.execute(
      q,
      []
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
          eachRoomStyle.id_roomStyleDescription == eachRoom.id_roomStyleDescription 
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
            eachRoomStyle.id_roomStyleDescription == eachReservation.id_roomStyleDescription
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
          eachRoomStyle.id_roomStyleDescription == eachPhoto.id_roomStyleDescription 
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

    console.log("responseArray: ", responseArray)

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

module.exports = {
  createRoom,
  updateRoom,
  deleteRoom,
  getRoom,
  getAllRooms,
};
