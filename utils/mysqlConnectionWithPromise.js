const mysql = require("mysql2/promise")
const dotenv = require("dotenv").config();
const fs = require("fs");

const db =  async () => {
  const conn = await mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    port: process.env.PORT,
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync("./ca.pem").toString(),
    },

  })

  // const conn = await mysql.createConnection(process.env.DATABASE_URL)

      return conn
}


  module.exports = db

