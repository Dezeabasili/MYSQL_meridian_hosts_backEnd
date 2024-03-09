const mysql = require("mysql2/promise")
const dotenv = require("dotenv").config();

const db =  async () => {
    // const conn = await mysql.createConnection({
    //     host: "localhost",
    //     user: "root",
    //     password: "19McC#74Ideo",
    //     database: "hotel_practice"
    //   })

  const conn = await mysql.createConnection(process.env.DATABASE_URL)

      return conn
}


  module.exports = db

