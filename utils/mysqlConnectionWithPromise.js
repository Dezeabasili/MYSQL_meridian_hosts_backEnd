const mysql = require("mysql2/promise")
const dotenv = require("dotenv").config();
const fs = require("fs");
const path = require("path")

const db =  async () => {
  // const conn = await mysql.createConnection({
  //   host: process.env.AIVEN_HOST,
  //   user: process.env.AIVEN_USER,
  //   password: process.env.AIVEN_PASSWORD,
  //   database: process.env.AIVEN_DATABASE,
  //   port: process.env.AIVEN_PORT,
  //   ssl: {
  //     rejectUnauthorized: true,
  //     // ca: fs.readFileSync("./ca.pem").toString(),
  //     ca: fs.readFileSync("./ca.pem").toString(),
  //   },

  // })

  const conn = await mysql.createConnection(process.env.DATABASE_URL)

      return conn
}


  module.exports = db

