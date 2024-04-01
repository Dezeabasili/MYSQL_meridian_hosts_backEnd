const crypto = require("crypto");
const bcrypt = require("bcrypt");
const path = require("path");
const createError = require("../utils/error");
const sendMail = require("../utils/handleEmail");
const User = require("./../models/users");
const Booking = require("./../models/bookings");
const Hotel = require("./../models/hotels");
const Review = require("./../models/reviews");
const sendOutMail = require("../utils/handleSubscriptionEmail");
const cloudinary = require("cloudinary").v2;
const db = require("./../utils/mysqlConnectionWithPromise");
const { format } = require("date-fns");
const configureQueryStr = require('./../utils/configureQueryString')
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// get all users
const getAllUsers = async (req, res, next) => {
  const mysqlConnection = await db();
  try {
    
    const q = "SELECT * FROM users";
    const [users, fields] = await mysqlConnection.execute(q, []);

    res.status(200).json({
      number: users.length,
      data: users,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// get a specific user
const getUser = async (req, res, next) => {
  const mysqlConnection = await db();
  try {

    const q = "SELECT * FROM users WHERE id_users = ?";
    const [userArray, fields] = await mysqlConnection.execute(q, [
      req.params.user_id,
    ]);
    if (userArray.length == 0)
      return next(createError("fail", 401, "This user does not exist"));
    const user = userArray[0];
    // if (!user)
    //   return next(createError("fail", 404, "this user does not exist"));
    res.status(200).json({
      data: user,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// get a specific user by user email
const findUser = async (req, res, next) => {
  const mysqlConnection = await db();
  try {
    const q = "SELECT * FROM users WHERE email = ?";
    const [userArray, fields] = await mysqlConnection.execute(q, [
      req.body.email,
    ]);
    if (userArray.length == 0)
      return next(createError("fail", 401, "This user does not exist"));
    const user = userArray[0];
    // const user = await User.findOne({ email: req.body.email });
    // if (!user)
    //   return next(createError("fail", 404, "this user does not exist"));
    res.status(200).json({
      data: user,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// update a specific user
const updateUser = async (req, res, next) => {
  const mysqlConnection = await db();
  try {
    let queryString = "";
    let queryString2; 
    let values = [];
    let Obj = {};

     // check if the user exist
     let q = "SELECT * FROM users WHERE email = ?" 
     const [userArr, usersField] = await mysqlConnection.execute(q, [req.body.email])
     if (userArr.length == 0) {
      return next(
        createError("fail", 404, "The user does not exist")
      );
     }

    if (req.body.roles) {
      if (
        req.body.roles * 1 != 2010 &&
        req.body.roles * 1 != 2020 &&
        req.body.roles * 1 != 2030
      )
        return next(
          createError("fail", 404, "user's role can only be 2010, 2020 or 2030")
        );

       

      // Obj.roles = req.body.roles * 1;
      queryString = queryString + " `userCode` = ?, ";
      values.push(req.body.roles * 1);
    }

    if (req.body.active) {
      queryString = queryString + " `active` = ?, ";
      if (req.body.active.toLowerCase() === "yes") {
        values.push(1);
        // Obj.active = true;
      } else if (req.body.active.toLowerCase() === "no") {
        values.push(0);
        // Obj.active = false;
      }
    }


    queryString2 = configureQueryStr(queryString, ",")
    // console.log('queryString2: ', queryString2)

     q = "UPDATE users SET " + queryString2 + " WHERE email = ?";
    values.push(req.body.email);
    const results = await mysqlConnection.execute(q, values);
    // console.log("results: ", results);
    // console.log("ResultSetHeader.changedRows: ", results[0].affectedRows);
    if (results[0].affectedRows == 0)
      return next(createError("fail", 401, "This user does not exist"));
    let data = {}
    data.matchedCount = 1

    res.status(200).json({data: data});
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// Admin deletes a specific user
const deleteUser = async (req, res, next) => {
  const mysqlConnection = await db();
  try {
    // check if the user exists
    let q = "SELECT * FROM users WHERE id_users = ?";
    const [userArray, fields] = await mysqlConnection.execute(q, [
      req.params.user_id,
    ]);
    if (userArray.length == 0)
      return next(createError("fail", 401, "This user does not exist"));
    const user = userArray[0];

    q = "DELETE FROM users WHERE id_users = ?";
    const results = await mysqlConnection.execute(q, [user.id_users]);
    // console.log("results: ", results);

      // delete the user photo from Cloudinary 
      if (userArray[0].photo_id) {
        await cloudinary.uploader.destroy(userArray[0].photo_id);
      }

    res.status(204).json("User has been deleted");
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// get user categories
// const usersByCategories = async (req, res, next) => {
//   try {
//     const userCategories = await User.aggregate([
//       {
//         $unwind: "$roles",
//       },
//       {
//         $group: {
//           _id: "$roles",
//           numInCategory: { $sum: 1 },
//           personsInCategory: { $push: "$username" },
//         },
//       },
//       {
//         $addFields: { role: "$_id" },
//       },
//       {
//         $project: { _id: 0 },
//       },
//       {
//         $sort: { numInCategory: -1 },
//       },
//     ]);
//     res.status(200).json({
//       data: userCategories,
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// the request handler below is for a logged in user who wants to change his/her data in the database
const updateMyAccount = async (req, res, next) => {
  const mysqlConnection = await db();
  try {
    // get user with the user id
    let q = "SELECT * FROM users WHERE id_users = ?";
    const [userArray, fields] = await mysqlConnection.execute(q, [
      req.userInfo.id
    ]);
    if (userArray.length == 0)
      return next(createError("fail", 404, "This user no longer exists"));
    // const loggedInUser = await User.findById(req.userInfo.id);
    // if (!loggedInUser)
    //   return next(createError("fail", 404, "This user no longer exists"));

    // check if user provided any information to update
    if (!req.body.email && !req.body.username && !req.body.name)
      return next(
        createError(
          "fail",
          400,
          "You did not provide any information to update"
        )
      );

    // get user information to update
    let queryString = "";
    let queryString2;
    let values = [];
    if (req.body.email) {
      // check if email already exist
      q = "SELECT * FROM users WHERE email = ?";
      const [alreadyExist2, fields2] = await mysqlConnection.execute(q, [
        req.body.email
      ]);
      if (alreadyExist2.length)
        return next(
          createError(
            "fail",
            409,
            "The email already exist. Choose another email"
          )
        );
      queryString = queryString + "`email` = ?, ";
      values.push(req.body.email);
      // const duplicateEmail = await User.findOne({ email: req.body.email });
      // if (duplicateEmail) {
      //   return next(createError("fail", 400, "email already exist"));
      // }
      // loggedInUser.email = req.body.email;
    }
    if (req.body.username) {
      // check if username already exist
      q = "SELECT * FROM users WHERE username = ?";
  const [alreadyExist, fields] = await mysqlConnection.execute(q, [req.body.username])
  if (alreadyExist.length) return next(createError('fail', 409, "The username already exist. Choose another username"))
  queryString = queryString + "`username` = ?, "
values.push(req.body.username)
      // const duplicateUsername = await User.findOne({
      //   username: req.body.username,
      // });
      // if (duplicateUsername) {
      //   return next(createError("fail", 400, "username already exist"));
      // }
      // loggedInUser.username = req.body.username;
    }
    if (req.body.name) {
      queryString = queryString + "`name` = ?, "
      values.push(req.body.name)
      // loggedInUser.name = req.body.name;
    }

    queryString2 = configureQueryStr(queryString, ",")
    
    // update user information
    q = "UPDATE users SET " + queryString2 + " WHERE id_users = ?"
    values.push(req.userInfo.id)
    const results = await mysqlConnection.execute(q, values)
    // await loggedInUser.save();

    res.status(200).json("Your information has been updated");
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// the request handler below is for a logged in user who wants to delete his/her account
const deleteMyAccount = async (req, res, next) => {
  const mysqlConnection = await db()
  try {
    // get user with the user id
    let q = "SELECT * FROM users WHERE id_users = ?"
    const [userArray, fields] = await mysqlConnection.execute(q, [req.userInfo.id])
    if (userArray.length == 0) return next(createError("fail", 401, "This user no longer exists"))
    // const loggedInUser = await User.findById(req.userInfo.id).select("+active");
    // if (!loggedInUser)
    //   return next(createError("fail", 404, "This user no longer exists"));

    // deactivate user
    q = "UPDATE users SET `active` = ? WHERE id_users = ?"
    const results = await mysqlConnection.execute(q, [0, req.userInfo.id])
    // loggedInUser.active = false;

    // update user information
    // await loggedInUser.save();

    // there is a query middleware in the user Schema that includes only users with active: true
    // before any query beginning with 'find' is executed.

    res.status(204).json("Sorry to see you leave");
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// the request handler below is for a logged in user who wants to see his/her account information
const seeMyAccount = async (req, res, next) => {
  const mysqlConnection = await db()
  try {

    //get user with the user id
    let q = "SELECT * FROM users WHERE id_users = ?"
    const [userArray, fields] = await mysqlConnection.execute(q, [req.userInfo.id])
    if (userArray.length == 0) return next(createError("fail", 404, "This user no longer exists"));
    const loggedInUser = userArray[0]
    // const loggedInUser = await User.findById(req.userInfo.id);
    // if (!loggedInUser)
    //   return next(createError("fail", 404, "This user no longer exists"));

    res.status(200).json({
      data: loggedInUser,
    });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// the request handler below is for updating the user's profile photo
const seeMyPhoto = async (req, res, next) => {
  const mysqlConnection = await db()
  try {

    //get user with the user id
    let q = "SELECT * FROM users WHERE id_users = ?"
    const [userArray, fields] = await mysqlConnection.execute(q, [req.userInfo.id])
    if (userArray.length == 0) return next(createError("fail", 404, "This user no longer exists"));
    const loggedInUser = userArray[0]
    // const loggedInUser = await User.findById(req.userInfo.id);
    // if (!loggedInUser)
    //   return next(createError("fail", 404, "This user no longer exists"));

    return res.status(200).json({ data: loggedInUser.photo });
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

// the request handler below is for deleting the user's profile photo
const deleteMyPhoto = async (req, res, next) => {
  const mysqlConnection = await db()
  try {

    //get user with the user id
    let q = "SELECT * FROM users WHERE id_users = ?"
    const [userArray, fields] = await mysqlConnection.execute(q, [req.userInfo.id])
    if (userArray.length == 0) return next(createError("fail", 404, "This user no longer exists"));
    const loggedInUser = userArray[0]
    // const loggedInUser = await User.findById(req.userInfo.id);
    // if (!loggedInUser)
    //   return next(createError("fail", 404, "This user no longer exists"));
    const publicId = loggedInUser.photo_id;
    const defaultPhoto = "https://res.cloudinary.com/dmth3elzl/image/upload/v1705633392/profilephotos/edeo8b4vzeppeovxny9c.png";
    q = "UPDATE users SET `photo` = ?, `photo_id` = ? WHERE id_users = ?"
    const results = await mysqlConnection.execute(q, [defaultPhoto, null, req.userInfo.id])
    // loggedInUser.photo = 
    //   "https://res.cloudinary.com/dmth3elzl/image/upload/v1705633392/profilephotos/edeo8b4vzeppeovxny9c.png";
    // loggedInUser.photo_id = undefined;

    // await loggedInUser.save();
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }

    return res.status(204).json("profile photo changed successfully");
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

const handleSubscription = async (req, res, next) => {
  const mysqlConnection = await db()
  try {

    //get user with the user id
    let q = "SELECT * FROM users WHERE email = ?"
    const [userArray, fields] = await mysqlConnection.execute(q, [req.body.email.toLowerCase()])
    if (userArray.length == 0) return next(createError("fail", 404, "This user no longer exists"));
    const loggedInUser = userArray[0]
    // const user = await User.findOne({ email: req.body.email.toLowerCase() });
    // if (!user)
    //   return next(createError("fail", 404, "This user does not exist"));

    // user.password = undefined;

    await sendOutMail(loggedInUser);

    res.status(200).json("Thank you for subscribing to our news letters");
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
};

const createRoles = async (req, res, next) => {
  const mysqlConnection = await db()
  try {

    let q = "INSERT INTO staff_roles (id_staff_roles, staffRoles) VALUES (?, ?)";
    // const values = [req.body.roles_id, req.body.staffRole];
    const results = await mysqlConnection.execute(q, [req.body.roles_id, req.body.staffRole])
    if (results[0].affectedRows == 0)
      return next(createError("fail", 401, "This role already exist"));
      q = "SELECT * FROM staff_roles WHERE id_staff = ?"
      // q = "SELECT LAST_INSERT_ID()"
      const hotelArray = await mysqlConnection.execute(q, [results[0].insertId])
      // console.log("last row: ", hotelArray)
      return res.status(201).json("role created")
  } catch (err) {
    next(err);
  } finally {
    await mysqlConnection.end()
}
  
  
};

module.exports = {
  getAllUsers,
  getUser,
  findUser,
  updateUser,
  deleteUser,
  // usersByCategories,
  updateMyAccount,
  deleteMyAccount,
  seeMyAccount,
  seeMyPhoto,
  deleteMyPhoto,
  handleSubscription,
  createRoles,
};
