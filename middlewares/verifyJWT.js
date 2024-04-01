const jwt = require('jsonwebtoken')
const createError = require('../utils/error')
const db = require("./../utils/mysqlConnectionWithPromise");
// const User = require('./../models/users')

const verifyAccessToken = async (req, res, next) => {
    const mysqlConnection = await db()
    try {
        
        
        // check if req has the authorization header
        const authorizationHeader = req.headers?.authorization
        if (!authorizationHeader) return next(createError('fail', 401, 'You are not authenticated_1. Please log in'))

        // check if authorizationHeader starts with 'Bearer '
        if (!authorizationHeader.startsWith('Bearer ')) return next(createError('fail', 401, 'You are not authenticated_2. Please log in'))

        // retrieve the access token
        const accessToken = authorizationHeader.split(' ')[1]

        // verify if access token has been tampered with or expired
        const userInfo = await jwt.verify(accessToken, process.env.ACCESS_TOKEN)
        // if (!userInfo) return next(createError('fail', 401, 'Your access token has expired or has been tampered with'))
        // console.log(userInfo)


        // check if user still exists
        let q = "SELECT * FROM users WHERE id_users = ?"
        const [userArray, fields] = await mysqlConnection.execute(q, [userInfo.id])
        if (userArray.length == 0) return next(createError('fail', 401, 'You are not authenticated_3. Please log in'))
        const loggedInUser = userArray[0]
    // console.log('loggedInUser: ', loggedInUser)
        // const loggedInUser = await User.findById(userInfo.id) 
        // if (!loggedInUser) return next(createError('fail', 401, 'You are not authenticated_3. Please log in'))

        // check if user changed password after the token was issued
        const checkTimeDifference = new Date(loggedInUser.passwordResetTime).getTime() < userInfo.iat * 1000

        if (!checkTimeDifference) return next(createError('fail', 401, 'Please log in again to get a new access token'))
        // console.log(userInfo)
        req.userInfo = userInfo
        next()

    } catch (err) {
        next(err)
    } finally {
        await mysqlConnection.end()
    }
}

module.exports = verifyAccessToken