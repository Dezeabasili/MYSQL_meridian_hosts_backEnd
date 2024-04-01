const Booking = require("../models/bookings");
const Review = require("../models/reviews");
const createError = require("../utils/error");
const Hotel = require("./../models/hotels");
const Room = require("./../models/rooms");
const City = require("./../models/cities");
const HotelType = require("./../models/hotelTypes");
const db = require("./../utils/mysqlConnectionWithPromise");
const configureQueryStr = require("./../utils/configureQueryString");
const { format } = require("date-fns");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// function to create an array of all the reservation dates
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

  let reservationDays = [];

  while (startDate < lastDate) {
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

// create a hotel
const createHotel = async (req, res, next) => {
  let insertedHotel = false;
  let insertedStaff = false;
  let hotelStaffList = [];
  let deleteString = "";
  let deleteString2 = "";
  let insertedHotel_id;
  let newStaff;

  const { name, city, type, description, detailedDescription } = req.body;
  let q = "";

  const mysqlConnection = await db();
  try {
 

    let queryString2;

    // check if the staff numbers provided are unique
    newStaff = [req.body.manager];
    req.body.staff.forEach((staff) => {
      if (!newStaff.includes(staff)) {
        newStaff.push(staff);
      }
    });

    let existingStaffList = [];

    // build the query string for inserting the hotel staff
    let q3 = "?, ";
    let values3 = [req.body.manager * 1];

    for (let i = 0; i < req.body.staff.length; i++) {
      q3 = q3 + "?, ";
      values3.push(req.body.staff[i] * 1);
    }

    // remove the last ,
    queryString2 = configureQueryStr(q3, ",");

    q = "SELECT * FROM users WHERE id_users IN ( " + queryString2 + ")";
    const [allStaffList2] = await mysqlConnection.execute(q, values3);
    const usersInDatabase = allStaffList2.map((eachUser) => {
      return eachUser.id_users;
    });

    // check if any of the staff provided is not a registered user
    let staffNotInDatabase = [];
    newStaff.forEach((staff) => {
      if (!usersInDatabase.includes(staff * 1)) {
        staffNotInDatabase.push(staff);
      }
    });


    if (staffNotInDatabase.length) {
      let response = "";
      for (let i = 0; i < staffNotInDatabase.length; i++) {
        response =
          response +
          `Staff with id ${staffNotInDatabase[i]} not found in the database. \n`;
      }
      return next(createError("fail", 400, response));
    }

    // check if the staff already works for another hotel 
    existingStaffList = [];

    q = "SELECT * FROM hotelstaff";
    const [allStaffList] = await mysqlConnection.execute(q, []);
    newStaff.forEach((eachStaff) => {
      allStaffList.forEach((staff) => {
        if (staff.id_users == eachStaff) {
          existingStaffList.push(staff);
        }
      });
    });

    if (existingStaffList.length) {
      let response = "";
      for (let i = 0; i < existingStaffList.length; i++) {
        response =
          response +
          `Staff with id ${existingStaffList[i].id_users} works in hotel which has id ${existingStaffList[i].id_hotels}. \n`;
      }
      return next(createError("fail", 400, response));
    }

    // check if hotel name already exist
    q = "SELECT * FROM hotels WHERE name = ?";
    const [hotelArr] = await mysqlConnection.execute(q, [name]);
    if (hotelArr.length > 0) {
      return next(createError("fail", 400, `Hotel name already exist`));
    }

    // add the new hotel to the database
    q =
      "INSERT INTO hotels (name, id_cities, id_hotelTypes, description, detailedDescription) VALUES (?, ?, ?, ?, ?)";
    const results = await mysqlConnection.execute(q, [
      name,
      city * 1,
      type * 1,
      description,
      detailedDescription,
    ]);

    insertedHotel = true;
    insertedHotel_id = results[0].insertId;

    // get the last inserted row
    let outputString =
      "hotels.id_hotels, cities.cityName, hoteltypes.hotelType, hotels.name, hotels.description, hotels.detailedDescription, " + 
      " hotels.photos, hotels.photo_id, hotels.numberOfRatings, hotels.ratingsAverage, hotels.cheapestPrice";

    q =
      "SELECT " +
      outputString +
      " FROM cities INNER JOIN hotels ON cities.id_cities = hotels.id_cities INNER JOIN hoteltypes ON hotels.id_hotelTypes = hoteltypes.id_hotelTypes WHERE hotels.id_hotels = ?";
    const [hotelArray] = await mysqlConnection.execute(q, [
      results[0].insertId,
    ]);
    const hotel = hotelArray[0];

    // build the query string for inserting the hotel staff
    let q2 = "(?, ?, ?), ";
    let values2 = [req.body.manager * 1, hotel.id_hotels, "manager"];
    hotelStaffList.push(req.body.manager * 1);
    deleteString = deleteString + " ?, ";

    if (newStaff.length > 1) {
      for (let i = 0; i < req.body.staff.length; i++) {
        q2 = q2 + "(?, ?, ?), ";
        deleteString = deleteString + " ?, ";
        hotelStaffList.push(req.body.staff[i] * 1);
        values2.push(req.body.staff[i] * 1);
        values2.push(hotel.id_hotels);
        values2.push("staff");
      }
    }

    // remove the last ,
    queryString2 = configureQueryStr(q2, ",");
    deleteString2 = configureQueryStr(deleteString, ",");

    // insert the hotel staff
    q =
      "INSERT INTO hotelstaff (id_users, id_hotels, staffRole) VALUES " +
      queryString2;
    const result2 = await mysqlConnection.execute(q, values2);

    insertedStaff = true;
    q =
      "SELECT users.name, users.id_users, users.userCode, hotelstaff.staffRole  " + 
      " FROM hotelstaff INNER JOIN users ON hotelstaff.id_users = users.id_users WHERE hotelstaff.id_hotels = ?";
    const [staffArray, fields4] = await mysqlConnection.execute(q, [
      results[0].insertId,
    ]);

    // build the response Object in the format required by the already existing front end
    let manager = {};
    let staff = [];
    let cityObj = {};
    let typeObj = {};

    staffArray.forEach((eachHotelStaff) => {
      if (eachHotelStaff.staffRole == "manager") {
        manager = { ...eachHotelStaff };
      } else {
        staff.push(eachHotelStaff);
      }
    });

    hotel.manager = manager;
    hotel.staff = staff;
    cityObj.cityName = hotel.cityName;
    typeObj.type = hotel.hotelType;
    hotel.city = cityObj;
    hotel.type = typeObj;

    res.status(201).json({
      data: hotel,
    });
  } catch (err) {
    const mysqlConnection = await db();
    // delete the already inserted hotel
    if (insertedHotel) {
      q = "DELETE FROM hotels WHERE id_hotels = ?";
      await mysqlConnection.execute(q, [insertedHotel_id]);
    }

    // delete the already inserted staff members
    if (insertedStaff) {
      q = "DELETE FROM hotelstaff WHERE id_users IN (" + deleteString2 + " )";
      await mysqlConnection.execute(q, hotelStaffList);
    }
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// get all hotels
const getAllHotels = async (req, res, next) => {
  const mysqlConnection = await db();
  try {
    let selections =
      "cities.cityName, cities.id_cities, hotels.id_hotels, hotels.name, hotels.description, hotels.detailedDescription, hotels.photos, " + 
      " hotels.photo_id, hotels.numberOfRatings, hotels.ratingsAverage, hotels.cheapestPrice, hoteltypes.hotelType, hoteltypes.id_hotelTypes ";

    let q =
      "SELECT " +
      selections +
      "FROM cities INNER JOIN hotels ON cities.id_cities = hotels.id_cities INNER JOIN hoteltypes ON hotels.id_hotelTypes = hoteltypes.id_hotelTypes";
    let values = [];
    let sort;
    let sort2;

    if (req.query.cityref) {
      q =
        "SELECT " +
        selections +
        " FROM cities INNER JOIN hotels ON cities.id_cities = hotels.id_cities INNER JOIN hoteltypes ON hotels.id_hotelTypes = hoteltypes.id_hotelTypes WHERE cities.id_cities = ?";
      values.push(req.query.cityref * 1);
    }

    if (req.query.city) {
      q =
        "SELECT " +
        selections +
        "FROM cities INNER JOIN hotels ON cities.id_cities = hotels.id_cities INNER JOIN hoteltypes ON hotels.id_hotelTypes = hoteltypes.id_hotelTypes WHERE cities.cityName = ?";
      values.push(req.query.city);
    }

    if (req.query.sort && req.query.limit) {
      sort = req.query.sort;
      if (sort.indexOf("-") == 0) {
        sort2 = sort.slice(1);
        q =
          "SELECT " +
          selections +
          "FROM cities INNER JOIN hotels ON cities.id_cities = hotels.id_cities INNER JOIN hoteltypes ON hotels.id_hotelTypes = hoteltypes.id_hotelTypes ORDER BY " +
          sort2 +
          " DESC";

      } else {
        q =
          "SELECT " +
          selections +
          "FROM cities INNER JOIN hotels ON cities.id_cities = hotels.id_cities INNER JOIN hoteltypes ON hotels.id_hotelTypes = hoteltypes.id_hotelTypes ORDER BY " +
          sort;

      }
      q = q + " LIMIT " + req.query.limit;
    } else if (req.query.sort) {
      sort = req.query.sort;
      if (sort.indexOf("-") == 0) {
        sort2 = sort.slice(1);
        q =
          "SELECT " +
          selections +
          " FROM cities INNER JOIN hotels ON cities.id_cities = hotels.id_cities INNER JOIN hoteltypes ON hotels.id_hotelTypes = hoteltypes.id_hotelTypes ORDER BY " +
          sort2 +
          " DESC";

      } else {
        q =
          "SELECT " +
          selections +
          " FROM cities INNER JOIN hotels ON cities.id_cities = hotels.id_cities INNER JOIN hoteltypes ON hotels.id_hotelTypes = hoteltypes.id_hotelTypes ORDER BY " +
          sort;

      }
    } else if (req.query.limit) {
      q =
        "SELECT " +
        selections +
        " FROM cities INNER JOIN hotels ON cities.id_cities = hotels.id_cities INNER JOIN hoteltypes ON hotels.id_hotelTypes = hoteltypes.id_hotelTypes LIMIT " +
        req.query.limit;
   
    }


    const [hotelsArray] = await mysqlConnection.execute(q, values);


    if (hotelsArray.length == 0)
      return next(
        createError("fail", 404, `Sorry, we have no property in the database`)
      );

    // get all hotel staff
    q =
      "SELECT users.name, users.id_users, users.userCode, hotelstaff.staffRole, hotelstaff.id_hotels  FROM hotelstaff INNER JOIN users ON hotelstaff.id_users = users.id_users";
    const [staffArray, fields2] = await mysqlConnection.execute(q, []);

    // get all room styles
    q =
      "SELECT * FROM roomstyledescription INNER JOIN roomstyles ON roomstyledescription.id_roomStyles = roomstyles.id_roomStyles";
    const [roomStylesArray, fields3] = await mysqlConnection.execute(q, []);

    // construct response in the format required by the already existing front end
    let hotels = [];
    hotelsArray.forEach((eachHotel, i) => {
      let cityObj = {};
      let hotelTypeObj = {};
      let hotelStaff = [];
      let room_ids = [];
      staffArray.forEach((eachStaff) => {
        if (eachHotel.id_hotels == eachStaff.id_hotels) {
          if (eachStaff.staffRole == "manager") {
            eachHotel.manager = eachStaff;
          } else {
            hotelStaff.push(eachStaff);
          }
        }
      });
      eachHotel.staff = hotelStaff;
      eachHotel.name = hotelsArray[i].name;
      cityObj.cityName = hotelsArray[i].cityName;
      hotelTypeObj.hotelType = hotelsArray[i].hotelType;
      eachHotel.type = hotelTypeObj;
      eachHotel.city = cityObj;

      roomStylesArray.forEach((eachRoomStyle) => {
        if (eachHotel.id_hotels == eachRoomStyle.id_hotels) {
          room_ids.push(eachRoomStyle);
        }
      });
      eachHotel.room_ids = room_ids;
      hotels.push(eachHotel);
    });

    res.status(200).json({
      number: hotels.length,
      data: hotels,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// List hotels within a price range
const getAllHotelsWithinPriceRange = async (req, res, next) => {
  const mysqlConnection = await db();
  try {

    const minPrice = req.query.min * 1 || 0;
    const maxPrice = req.query.max * 1 || 1000;
    let selections =
      "cities.cityName, cities.id_cities, hotels.id_hotels, hotels.name, hotels.description, hotels.detailedDescription, hotels.photos, " + 
      " hotels.photo_id, hotels.numberOfRatings, hotels.ratingsAverage, hotels.cheapestPrice, hoteltypes.hotelType, hoteltypes.id_hotelTypes ";

    let q =
      "SELECT " +
      selections +
      " FROM cities INNER JOIN hotels ON cities.id_cities = hotels.id_cities INNER JOIN hoteltypes ON hotels.id_hotelTypes = hoteltypes.id_hotelTypes WHERE cheapestPrice BETWEEN ? AND ?";
    let values = [];
    values.push(minPrice);
    values.push(maxPrice);

    if (req.query.city) {
      q =
        "SELECT " +
        selections +
        " FROM cities INNER JOIN hotels ON cities.id_cities = hotels.id_cities INNER JOIN hoteltypes ON hotels.id_hotelTypes = hoteltypes.id_hotelTypes WHERE cheapestPrice BETWEEN ? AND ? AND cityName = ?";
      values.push(req.query.city);
    }

    const [hotelsArray] = await mysqlConnection.execute(q, values);
    if (hotelsArray.length == 0)
      return next(
        createError(
          "fail",
          404,
          `Sorry, we have no property in the price range specified`
        )
      );

    // get all hotel staff
    q =
      "SELECT users.name, users.id_users, users.userCode, hotelstaff.staffRole, hotelstaff.id_hotels  FROM hotelstaff INNER JOIN users ON hotelstaff.id_users = users.id_users";
    const [staffArray] = await mysqlConnection.execute(q, []);

    // get all room styles
    q =
      "SELECT * FROM roomstyledescription INNER JOIN roomstyles ON roomstyledescription.id_roomStyles = roomstyles.id_roomStyles";
    const [roomStylesArray] = await mysqlConnection.execute(q, []);

    // construct response in the format required by the already existing front end
    let hotels = [];
    hotelsArray.forEach((eachHotel, i) => {
      let hotelStaff = [];
      let room_ids = [];
      staffArray.forEach((eachStaff) => {
        if (eachHotel.id_hotels == eachStaff.id_hotels) {
          if (eachStaff.staffRole == "manager") {
            eachHotel.manager = eachStaff;
          } else {
            hotelStaff.push(eachStaff);
          }
        }
      });
      eachHotel.staff = hotelStaff;
      eachHotel.name = hotelsArray[i].name;

      roomStylesArray.forEach((eachRoomStyle) => {
        if (eachHotel.id_hotels == eachRoomStyle.id_hotels) {
          room_ids.push(eachRoomStyle);
        }
      });
      eachHotel.room_ids = room_ids;
      hotels.push(eachHotel);
    });

    res.status(200).json({
      number: hotels.length,
      data: hotels,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// get a specific hotel
const getHotel = async (req, res, next) => {
  const mysqlConnection = await db();
  try {


    let selections =
      "cities.cityName, cities.id_cities, hotels.id_hotels, hotels.name, hotels.description, hotels.detailedDescription, hotels.photos, " + 
      " hotels.photo_id, hotels.numberOfRatings, hotels.ratingsAverage, hotels.cheapestPrice, hoteltypes.hotelType, hoteltypes.id_hotelTypes ";

    let q =
      "SELECT " +
      selections +
      " FROM cities INNER JOIN hotels ON cities.id_cities = hotels.id_cities INNER JOIN hoteltypes ON hotels.id_hotelTypes = hoteltypes.id_hotelTypes WHERE id_hotels = ?";
    const [hotelsArray] = await mysqlConnection.execute(q, [
      req.params.hotel_id,
    ]);
    if (hotelsArray.length == 0)
      return next(createError("fail", 404, "this hotel does not exist"));

    // get all hotel staff
    q =
      "SELECT users.name, users.id_users, users.userCode, hotelstaff.staffRole, hotelstaff.id_hotels  FROM hotelstaff INNER JOIN users ON hotelstaff.id_users = users.id_users";
    const [staffArray] = await mysqlConnection.execute(q, []);

    // get all room styles
    q =
      "SELECT * FROM roomstyledescription INNER JOIN roomstyles ON roomstyledescription.id_roomStyles = roomstyles.id_roomStyles";
    const [roomStylesArray] = await mysqlConnection.execute(q, []);

    // construct response in the format required by the already existing front end
    let hotels = [];
    hotelsArray.forEach((eachHotel, i) => {
      let hotelStaff = [];
      let room_ids = [];
      staffArray.forEach((eachStaff) => {
        if (eachHotel.id_hotels == eachStaff.id_hotels) {
          if (eachStaff.staffRole == "manager") {
            eachHotel.manager = eachStaff;
          } else {
            hotelStaff.push(eachStaff);
          }
        }
      });
      eachHotel.staff = hotelStaff;
      eachHotel.name = hotelsArray[i].name;
      eachHotel.id_hotels = hotelsArray[i].id_hotels;

      roomStylesArray.forEach((eachRoomStyle) => {
        if (eachHotel.id_hotels == eachRoomStyle.id_hotels) {
          room_ids.push(eachRoomStyle);
        }
      });
      eachHotel.room_ids = room_ids;
      hotels.push(eachHotel);
    });

    res.status(200).json({
      data: hotels[0],
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// update a specific hotel
const updateHotel = async (req, res, next) => {
  let queryString1 = "";
  let values1 = [];
  let queryString2 = "";
  const mysqlConnection = await db();

  try {
 

    // check if the hotel exist
    let q = "SELECT * FROM hotels WHERE id_hotels = ?";
    const [hotelArray] = await mysqlConnection.execute(q, [
      req.params.hotel_id,
    ]);
    if (hotelArray.length == 0)
      return next(createError("fail", 404, "This hotel does not exist"));

    // check if the given hotel name exist
    if (req.body.name) {
      q = "SELECT * FROM hotels WHERE id_hotels != ? AND name = ?";
      const [hotelArray2, fields2] = await mysqlConnection.execute(q, [
        req.params.hotel_id,
        req.body.name,
      ]);
      if (hotelArray2.length > 0)
        return next(
          createError("fail", 404, "This hotel name exists. Change hotel name")
        );

      queryString1 = queryString1 + " `name` = ?, ";
      values1.push(req.body.name);
    }

    if (req.body.manager) {
      // check if the manager is in the users table
      q = "SELECT * FROM users WHERE id_users = ?";
      const [managerArray] = await mysqlConnection.execute(q, [
        req.body.manager * 1,
      ]);
      if (managerArray.length == 0)
        return next(
          createError(
            "fail",
            404,
            "This manager's reference number is not in the database"
          )
        );

      // check if the manager to be added is in the hotelstaff table
      q = "SELECT * FROM hotelstaff WHERE id_users = ?";
      const [managerArray2] = await mysqlConnection.execute(q, [
        req.body.manager * 1,
      ]);

      if (managerArray2.length == 0) {
        q =
          "INSERT INTO hotelstaff (id_users, id_hotels, staffRole) VALUES (?, ?, ?)";
        const results3 = await mysqlConnection.execute(q, [
          req.body.manager * 1,
          req.params.hotel_id,
          "manager",
        ]);

      } else {
        q =
          "UPDATE hotelstaff SET `id_hotels` = ?, `staffRole` = ? WHERE id_users = ? ";
        const updateResult = await mysqlConnection.execute(q, [
          req.params.hotel_id,
          "manager",
          req.body.manager * 1,
        ]);

      }

      // delete the previous manager from the hotelstaff table
      q =
        "DELETE FROM hotelstaff WHERE id_users != ? AND staffRole = ? AND id_hotels = ?";
      const deleteResults = await mysqlConnection.execute(q, [
        req.body.manager * 1,
        "manager",
        req.params.hotel_id,
      ]);

    }

    if (req.body.addStaff) {
      // check if the staff is in the users table
      q = "SELECT * FROM users WHERE id_users = ?";
      const [staffArray] = await mysqlConnection.execute(q, [
        req.body.addStaff * 1,
      ]);
      if (staffArray.length == 0)
        return next(
          createError(
            "fail",
            404,
            "This staff's reference number you want to add is not in the database"
          )
        );

      // check if the staff to be added is in the hotelstaff table
      q = "SELECT * FROM hotelstaff WHERE id_users = ?";
      const [staffArray2, fields5] = await mysqlConnection.execute(q, [
        req.body.addStaff * 1,
      ]);


      if (staffArray2.length == 0) {
        q =
          "INSERT INTO hotelstaff (id_users, id_hotels, staffRole) VALUES (?, ?, ?)";
        const results3 = await mysqlConnection.execute(q, [
          req.body.addStaff * 1,
          req.params.hotel_id,
          "staff",
        ]);

      } else {
        q =
          "UPDATE hotelstaff SET `id_hotels` = ?, `staffRole` = ? WHERE id_users = ? ";
        const updateResult = await mysqlConnection.execute(q, [
          req.params.hotel_id,
          "staff",
          req.body.addStaff * 1,
        ]);

      }
    }

    // check if the staff to be removed is in the hotelstaff table
    if (req.body.removeStaff) {
      // check if the staff is in the users table
      q = "SELECT * FROM users WHERE id_users = ?";
      const [staffArray, fields4] = await mysqlConnection.execute(q, [
        req.body.removeStaff * 1,
      ]);
      if (staffArray.length == 0)
        return next(
          createError(
            "fail",
            404,
            "This staff's reference number you want to remove is not in the database"
          )
        );


      // check if the staff to be removed is in the hotelstaff table
      q = "SELECT * FROM hotelstaff WHERE id_users = ?";
      const [staffArray2, fields5] = await mysqlConnection.execute(q, [
        req.body.removeStaff * 1,
      ]);
      if (staffArray2.length == 0)
        return next(
          createError(
            "fail",
            404,
            "This staff's reference number you want to remove is not a staff member"
          )
        );

      q = "DELETE FROM hotelstaff WHERE id_users = ?";
      const [deletedStaff] = await mysqlConnection.execute(q, [
        req.body.removeStaff * 1,
      ]);

    }


    if (req.body.city || req.body.type || req.body.description) {
      if (req.body.city) {
        queryString1 = queryString1 + " `id_cities` = ?, ";
        values1.push(req.body.city * 1);

        // get the previous city
        city_id = hotelArray[0].id_cities;
      }
      if (req.body.type) {
        queryString1 = queryString1 + " `id_hotelTypes` = ?, ";
        values1.push(req.body.type * 1);

        // get the previous hotel type
        hotelType_id = hotelArray[0].id_hotelTypes;
      }

      if (req.body.description) {
        queryString1 = queryString1 + " `description` = ?, ";
        values1.push(req.body.description);
      }

      // remove the last ,
      queryString2 = configureQueryStr(queryString1, ",");

      // update hotels table
      q = "UPDATE hotels SET " + queryString2 + " WHERE id_hotels = ?";
      values1.push(req.params.hotel_id);
      const results1 = await mysqlConnection.execute(q, values1);
    }

    // console.log(14)
    res.status(200).json({ data: "Done" });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// delete a specific hotel
const deleteHotel = async (req, res, next) => {
  const mysqlConnection = await db();
  try {
   
    // check if the hotel exist
    let q = "SELECT * FROM hotels WHERE id_hotels = ?";
    const [hotelArray] = await mysqlConnection.execute(q, [
      req.params.hotel_id,
    ]);
    if (hotelArray.length == 0)
      return next(createError("fail", 404, "This hotel does not exist"));

    const hotel = hotelArray[0];

    // delete the hotel
    q = "DELETE FROM hotels WHERE id_hotels = ?";
    const results = await mysqlConnection.execute(q, [req.params.hotel_id]);

    // delete the hotel photo from Cloudinary
    if (hotelArray[0].photo_id) {
      await cloudinary.uploader.destroy(hotelArray[0].photo_id);
    }

    // // check if there is any hotel left in the city
    // q = "SELECT * FROM hotels WHERE id_cities = ?";
    // const [hotelsArray, fields2] = await mysqlConnection.execute(q, [
    //   hotel.id_cities,
    // ]);
    // if (hotelsArray.length == 0) {
    //   // delete the city from the database
    //   q = "DELETE FROM cities WHERE id_cities = ?";
    //   const results2 = await mysqlConnection.execute(q, [hotel.id_cities]);
    // }

    // // check if there is any hotel of this hotel type left in the database
    // q = "SELECT * FROM hotels WHERE id_hotelTypes = ?";
    // const [hotelTypeArray, fields3] = await mysqlConnection.execute(q, [
    //   hotel.id_hotelTypes,
    // ]);
    // if (hotelTypeArray.length == 0) {
    //   // delete the hotel type from the database
    //   q = "DELETE FROM hoteltypes WHERE id_hotelTypes = ?";
    //   const results2 = await mysqlConnection.execute(q, [hotel.id_hotelTypes]);
    // }

    res.status(204).json("Hotel has been deleted");
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};


// get hotels by city name
const countByCityNew = async (req, res, next) => {
  const mysqlConnection = await db();
  try {


    let q =
      "SELECT * FROM (SELECT id_cities, COUNT(id_cities) AS numberOfHotels FROM hotels GROUP BY id_cities) AS abcd INNER JOIN cities ON abcd.id_cities = cities.id_cities";

    const [hotelArray, fields] = await mysqlConnection.execute(q, []);


    res.status(200).json({ data: hotelArray });

  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};


// get hotels by type
const countByTypeNew = async (req, res, next) => {
  let hotelTypeData = [];
  const mysqlConnection = await db();
  try {

    let q =
      "SELECT * FROM (SELECT id_hotelTypes, COUNT(id_hotelTypes) AS numberOfHotels FROM hotels GROUP BY id_hotelTypes) AS abcd INNER JOIN hoteltypes ON abcd.id_hotelTypes = hoteltypes.id_hotelTypes";

    const [hotelArray] = await mysqlConnection.execute(q, []);

    res.status(200).json({
      data: hotelArray,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// get rooms in a specific hotel
const getHotelRooms = async (req, res, next) => {
  const mysqlConnection = await db();
  try {

    let q =
      "SELECT hotels.name, cities.id_cities, cities.cityName FROM cities INNER JOIN hotels ON cities.id_cities = hotels.id_cities WHERE hotels.id_hotels = ?";
    const [hotelArray] = await mysqlConnection.execute(q, [
      req.params.hotel_id,
    ]);
    // console.log("1b");
    if (hotelArray.length == 0)
      return next("fail", createError(400, "this hotel does not exist"));
    const givenHotel = hotelArray[0];


    // get all the room styles and rooms that belong to this hotel and their unavailable dates
    q =
      "SELECT * FROM roomnumbers INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription " + 
      " INNER JOIN roomstyles ON roomstyledescription.id_roomStyles = roomstyles.id_roomStyles WHERE roomstyledescription.id_hotels = ?";
    const [roomStylesDescArray] = await mysqlConnection.execute(q, [
      req.params.hotel_id,
    ]);
 
    // get all the different room styles in the hotel
    q =
      "SELECT roomstyledescription.id_roomStyles  FROM roomnumbers INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription " + 
      " WHERE roomstyledescription.id_hotels = ? GROUP BY roomstyledescription.id_roomStyles";
    const [roomStylesArray] = await mysqlConnection.execute(q, [
      req.params.hotel_id,
    ]);

    // get all the unavailable dates
    q =
      "SELECT * FROM roomstyledescription INNER JOIN roomnumbers ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription " + 
      " INNER JOIN unavailabledates ON roomnumbers.id_roomNumbers = unavailabledates.id_roomNumbers WHERE roomstyledescription.id_hotels = ?";
    const [unavailableDatesArray] = await mysqlConnection.execute(q, [
      req.params.hotel_id,
    ]);

    // get all the room style photos
    q =
      "SELECT * FROM roomstylesphotos INNER JOIN roomstyledescription ON roomstylesphotos.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription WHERE roomstyledescription.id_hotels = ?";
    const [roomStylePhotosArray] = await mysqlConnection.execute(q, [
      req.params.hotel_id,
    ]);

    // Build the response object in accordance to what is expected at the Front End
    // add the rooms
    let hotelRoomStyles = [];
   
    roomStylesArray.forEach((everyRoomStyle) => {
      let roomStyle = {};
      roomStyle.roomNumbers = [];
      let lastIndex;

      let datesArray = [];
      roomStylesDescArray.forEach((eachRoomStyle, index) => {
        let roomObj = {};
        if (everyRoomStyle.id_roomStyles == eachRoomStyle.id_roomStyles) {
          roomObj.number = eachRoomStyle.roomNumber;
          roomObj.unavailableDates = datesArray;
          roomStyle.roomNumbers.push(roomObj);
          lastIndex = index;
        }
      });

      let picArray = [];
      let pic_idArray = [];
      let givenHotelDetails = {};
      givenHotelDetails.name = givenHotel.name;
      givenHotelDetails.city = givenHotel.cityName;
      roomStylePhotosArray.forEach((eachPhoto) => {
        if (eachPhoto.id_roomStyles == everyRoomStyle.id_roomStyles) {
          picArray.push(eachPhoto.photos);
          pic_idArray.push(eachPhoto.photo_id);
        }
      });

      roomStyle.title = roomStylesDescArray[lastIndex].roomStylesNames;
      roomStyle.price = roomStylesDescArray[lastIndex].price;
      roomStyle.maxPeople = roomStylesDescArray[lastIndex].maxPeople;
      roomStyle.description = roomStylesDescArray[lastIndex].description;
      roomStyle.id_roomStyles = roomStylesDescArray[lastIndex].id_roomStyles;
      roomStyle.id_roomStyleDescription =
        roomStylesDescArray[lastIndex].id_roomStyleDescription;
      roomStyle.photos = picArray;
      roomStyle.photo_id = pic_idArray;
      roomStyle.hotel = givenHotelDetails;

      hotelRoomStyles.push(roomStyle);
    });


    // add the unavailable dates
    hotelRoomStyles.forEach((eachRoomStyle, i) => {
      eachRoomStyle.roomNumbers.forEach((room, index) => {
        unavailableDatesArray.forEach((eachReservation) => {
          if (eachReservation.roomNumber == room.number) {
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
        hotelRoomStyles[i].roomNumbers[index] = room;
      });
    });

    console.log("hotelRoomStyles: ", hotelRoomStyles)

    res.status(200).json({
      data: hotelRoomStyles,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};



// create hotel city
const createHotelCity = async (req, res, next) => {
  const mysqlConnection = await db();
  try {

    let q = "INSERT INTO cities (cityName) VALUES(?) ";
    const results = await mysqlConnection.execute(q, [req.body.cityName]);

    q = "SELECT * FROM cities WHERE id_cities = ?";
    const [hotelCityArray] = await mysqlConnection.execute(q, [
      results[0].insertId,
    ]);
    const hotelCity = hotelCityArray[0];

    res.status(201).json({
      data: hotelCity,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// create hotel type
const createHotelType = async (req, res, next) => {
  const mysqlConnection = await db();
  try {

    let q = "INSERT INTO hoteltypes (hotelType) VALUES(?) ";
    const results = await mysqlConnection.execute(q, [req.body.hotelType]);

    q = "SELECT * FROM hoteltypes WHERE id_hotelTypes = ?";
    const [hotelTypeArray, fields] = await mysqlConnection.execute(q, [
      results[0].insertId,
    ]);
    const hotelType = hotelTypeArray[0];

    res.status(201).json({
      data: hotelType,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// get all hotel cities references
const getAllHotelCityRefs = async (req, res, next) => {
  const mysqlConnection = await db();
  try {
 
    let q = "SELECT * FROM cities";
    const [citiesArray, fields] = await mysqlConnection.execute(q, []);
    res.status(200).json({
      data: citiesArray,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// get all hotel types references
const getAllHotelTypeRefs = async (req, res, next) => {
  const mysqlConnection = await db();
  try {

    let q = "SELECT * FROM hoteltypes";
    const [hotelTypeArray, fields] = await mysqlConnection.execute(q, []);
    res.status(200).json({
      data: hotelTypeArray,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

module.exports = {
  createHotel,
  getAllHotels,
  getAllHotelsWithinPriceRange,
  getHotel,
  updateHotel,
  deleteHotel,
  countByCityNew,
  countByTypeNew,
  getHotelRooms,
  createHotelCity,
  createHotelType,
  getAllHotelCityRefs,
  getAllHotelTypeRefs,
};
