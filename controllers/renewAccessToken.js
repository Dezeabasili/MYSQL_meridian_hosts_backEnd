const jwt = require('jsonwebtoken')
const createError = require('../utils/error')
const User = require('./../models/users')
const db = require("./../utils/mysqlConnectionWithPromise");

const renewAccessToken = async (req, res, next) => {
    const mysqlConnection = await db();
    try {
        // get refresh token from cookie
    const refreshToken = req.cookies?.jwt
    if (!refreshToken) return res.sendStatus(401) // unauthorized
    let user_id;

    // verify the refresh token
    jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN,
        (error, userInfo) => {
            if (error) return res.sendStatus(403) // Forbidden

            // userInfo has the user id and assigned roles
            user_id = userInfo.id
        }
    )
    // check if user still exists
    let q = "SELECT * FROM users WHERE id_users = ?"
    const [userArray, fields] = await mysqlConnection.execute(q, [user_id])
    
    if (userArray.length == 0) return res.sendStatus(401) // unauthorized
    const user = userArray[0]
    
    console.log("user: ", user)

    // generate new access token
    const accessToken = jwt.sign({ id: user.id_users, assignedRoles: user.userCode }, process.env.ACCESS_TOKEN, { expiresIn: '900s' })

    res.json({ accessToken, assignedRoles: user.userCode })

    } catch (err) {
        next(error)
    } finally {
        await mysqlConnection.end()
    }
    
}

module.exports = renewAccessToken