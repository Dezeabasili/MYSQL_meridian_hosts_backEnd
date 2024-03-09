const mysql = require("mysql2")

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "19McC#74Ideo",
    database: "hotel_practice"
  })

  module.exports = db