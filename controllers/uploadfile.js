const path = require("path");
const fsPromises = require("fs").promises;
const fs = require("fs");
const sharp = require("sharp");
const User = require("./../models/users");
const createError = require("../utils/error");
const Hotel = require("../models/hotels");
const Room = require("../models/rooms");
const City = require("./../models/cities");
const HotelType = require("./../models/hotelTypes");
const db = require("./../utils/mysqlConnectionWithPromise");
const configureQueryStr = require("./../utils/configureQueryString");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const upload_file = async (req, res, next) => {
  const mysqlConnection = await db();
  try {
  
    // get the user
    let q = "SELECT * FROM users WHERE id_users = ?";
    const [userArray, fields] = await mysqlConnection.execute(q, [
      req.userInfo.id,
    ]);
    if (userArray.length == 0)
      return next(createError("fail", 404, "This user no longer exists"));
    const user = userArray[0];
    // const user = await User.findById(req.userInfo.id);
    // if (!user)
    //   return next(createError("fail", 404, "this user does not exist"));

    if (req.body.urlArray.length == 0)
      return next(createError("fail", 404, "no secure URL from cloudinary"));

    if (req.body.fileCode == "profilephoto") {
      const photoId = user.photo_id;
      q = "UPDATE users SET `photo` = ?, `photo_id` = ? WHERE id_users = ?";
      await mysqlConnection.execute(q, [
        req.body.urlArray[0],
        req.body.public_idArray[0],
        req.userInfo.id,
      ]);
      // user.photo = req.body.urlArray[0];
      // user.photo_id = req.body.public_idArray[0];
      // await user.save();
      if (photoId) {
        await cloudinary.uploader.destroy(photoId);
      }
    } else if (req.body.fileCode == "hotelphoto") {
      q = "SELECT * FROM hotels WHERE id_hotels = ?";
      const [hotelArray, fields] = await mysqlConnection.execute(q, [
        req.body.id,
      ]);
      if (hotelArray.length == 0)
        return next(createError("fail", 401, "This hotel does not exist"));
      const hotel = hotelArray[0];
      // const hotel = await Hotel.findById(req.body.id);
      // if (!hotel)
      //   return next(createError("fail", 404, "this hotel does not exist"));
      const photoId = hotel.photo_id;
      q = "UPDATE hotels SET `photos` = ?, `photo_id` = ? WHERE id_hotels = ?";
      await mysqlConnection.execute(q, [
        req.body.urlArray[0],
        req.body.public_idArray[0],
        req.body.id,
      ]);
      // hotel.photos = req.body.urlArray[0];
      // hotel.photo_id = req.body.public_idArray[0];
      // await hotel.save();
      if (photoId) {
        await cloudinary.uploader.destroy(photoId);
      }
    } else if (req.body.fileCode == "roomphoto") {
      // get the hotel id and the room style id
      q =
        "SELECT * FROM roomstyledescription WHERE id_roomStyleDescription = ?";
      const [roomStyleDescriptionArray, fields4] =
        await mysqlConnection.execute(q, [req.body.id * 1]);
      const roomStyle = roomStyleDescriptionArray[0];
      // get the list of the photos to be deleted
      let idArray = [];
      q =
        "SELECT * FROM roomstylesphotos INNER JOIN roomstyledescription ON roomstylesphotos.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription WHERE roomstyledescription.id_hotels = ? AND roomstyledescription.id_roomStyles = ?";
      const [photo_idArrays, fields3] = await mysqlConnection.execute(q, [
        roomStyle.id_hotels,
        roomStyle.id_roomStyles,
      ]);
      photo_idArrays.forEach((data) => {
        idArray.push(data.photo_id);
      });

      // delete the previous photos
      q = "DELETE FROM roomstylesphotos WHERE id_roomStyleDescription = ? ";
      await mysqlConnection.execute(q, [roomStyle.id_roomStyleDescription]);

      // build the query string
      let q2 = "";
      let values2 = [];

      for (let i = 0; i < req.body.urlArray.length; i++) {
        q2 = q2 + "(?, ?, ?), ";
        values2.push(roomStyle.id_roomStyleDescription);
        // values2.push(roomStyle.id_roomStyles)
        values2.push(req.body.urlArray[i]);
        values2.push(req.body.public_idArray[i]);
      }

      // remove the last ,
      queryString2 = configureQueryStr(q2, ",");

      // save the new photos
      q =
        "INSERT INTO roomstylesphotos (id_roomStyleDescription, photos, photo_id) VALUES " +
        queryString2;
      await mysqlConnection.execute(q, values2);

      if (idArray.length) {
        for (let i = 0; i < idArray.length; i++) {
          await cloudinary.uploader.destroy(idArray[i]);
        }
      }
    } else if (req.body.fileCode == "cityphoto") {
      q = "SELECT * FROM cities WHERE id_cities = ?";
      const [cityArray, fields] = await mysqlConnection.execute(q, [
        req.body.id,
      ]);
      if (cityArray.length == 0)
        return next(createError("fail", 401, "This city does not exist"));
      const city = cityArray[0];
      // console.log(1);
     
      const photoId = city.photo_id;
      q = "UPDATE cities SET `photo` = ?, `photo_id` = ? WHERE id_cities = ?";
      // q = "UPDATE cities SET cities.photo = " +  req.body.urlArray[0] + ", cities.photo_id = " + req.body.public_idArray[0] +   " WHERE cities.id_cities = " + req.body.id * 1
      // console.log(2);
      // console.log("req.body.id: ", req.body.id);

      // console.log("q: ", q);

      await mysqlConnection.execute(q, [
        req.body.urlArray[0],
        req.body.public_idArray[0],
        req.body.id * 1,
      ]);
      // await mysqlConnection.execute(q, [])
      // console.log(3);
      // city.photo = req.body.urlArray[0];
      // city.photo_id = req.body.public_idArray[0];
      // await city.save();
      if (photoId) {
        await cloudinary.uploader.destroy(photoId);
      }
    } else if (req.body.fileCode == "hoteltypephoto") {
      q = "SELECT * FROM hoteltypes WHERE id_hotelTypes = ?";
      const [hotelTypeArray, fields] = await mysqlConnection.execute(q, [
        req.body.id,
      ]);
      if (hotelTypeArray.length == 0)
        return next(createError("fail", 401, "This hotelType does not exist"));
      const hotelType = hotelTypeArray[0];
      // const hotelType = await HotelType.findById(req.body.id);
      // if (!hotelType)
      //   return next(createError("fail", 404, "this hotelType does not exist"));
      const photoId = hotelType.photo_id;
      q =
        "UPDATE hoteltypes SET `photo` = ?, `photo_id` = ? WHERE id_hotelTypes = ?";
      await mysqlConnection.execute(q, [
        req.body.urlArray[0],
        req.body.public_idArray[0],
        req.body.id,
      ]);
      // hotelType.photo = req.body.urlArray[0];
      // hotelType.photo_id = req.body.public_idArray[0];
      // await hotelType.save();
      if (photoId) {
        await cloudinary.uploader.destroy(photoId);
      }
    }

    res.status(200).json("file(s) uploaded successfully");
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

module.exports = upload_file;
