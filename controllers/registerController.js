const User = require("./../models/users");
const bcrypt = require("bcrypt");
const createError = require("./../utils/error");
const sendOutMail = require("../utils/handleEmail");
// const db = require("./../utils/mysqlConnection");
const db = require("./../utils/mysqlConnectionWithPromise");

const register = async (req, res, next) => {
  const mysqlConnection = await db()

  try {
    const { password, email, username, name } = req.body
        if (!password || !email || !username || !name) return next(createError('fail', 400, "forgot to type in your password or username or email"))

  // check if username already exist
  const q = "SELECT * FROM users WHERE username = ?";
  const [alreadyExist, fields] = await mysqlConnection.execute(q, [req.body.username])
  if (alreadyExist.length) return next(createError('fail', 409, "The username already exist. Choose another username"))

  // check if email already exist
  const q2 = "SELECT * FROM users WHERE email = ?";
  const [alreadyExist2, fields2] = await mysqlConnection.execute(q2, [req.body.email])
  if (alreadyExist2.length) return next(createError('fail', 409, "The email already exist. Choose another email"))

  // encrypt password
  const encryptedPassword = await bcrypt.hash(password, 12)

  // insert user into database
  const q3 = "INSERT INTO users (`password`, `email`, `username`, `name`) VALUES (?, ?, ?, ?)"
  const results = await mysqlConnection.execute(q3, [encryptedPassword, email.toLowerCase(), username.toLowerCase(), name.toLowerCase()])

  // send out welcome mail to the new user
  const newUser = {email, name}
  // await sendOutMail(newUser)

  // console.log('results: ', results)
  res.status(201).json("New user has been created")
  } catch (err) {
    next(err)
  } finally {
    await mysqlConnection.end()
}
};

module.exports = { register };
