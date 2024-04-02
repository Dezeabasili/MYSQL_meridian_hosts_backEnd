const createError = require('./../utils/error')
const User = require('./../models/users')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const passwordResetMail = require('../utils/passwordResetEmail')
const sendOutMail = require('../utils/handleEmail3')
const db = require("./../utils/mysqlConnectionWithPromise");
const {format} = require("date-fns")

const login = async (req, res, next) => {
    const pwd = req.body.password
    const username = req.body.username.toLowerCase()
    const mysqlConnection = await db()
    try {
        // check if user forgot to provide username or password
        if (!pwd || !username) return next(createError('fail', 400, "forgot to type in your password or username"))
   
        //check if user exist
        const q = "SELECT * FROM users WHERE username = ?";
        const [userArray] = await mysqlConnection.execute(q, [username])
        if (userArray.length == 0) return next(createError('fail', 401, "no user matches the provided information"))
        const user = userArray[0]

        // verify jwt
        const pwdCorrect = await bcrypt.compare(pwd, user.password)
        if (!pwdCorrect) return next(createError('fail', 401, 'Sorry, cannot log you in'))

        // generate access and refresh tokens
        const accessToken = jwt.sign({ id: user.id_users, assignedRoles: user.userCode }, process.env.ACCESS_TOKEN, { expiresIn: '900s' })
        const refreshToken = jwt.sign({ id: user.id_users, assignedRoles: user.userCode }, process.env.REFRESH_TOKEN, { expiresIn: '1d' })

        // Creates Secure Cookie with refresh token
        res.cookie('jwt', refreshToken, { httpOnly: true, secure: true, sameSite: 'None', maxAge: 24 * 60 * 60 * 1000 });

        const assignedRoles = user.userCode
        const profilePhoto = user.photo

        res.status(200).json({
            accessToken,
            assignedRoles,
            profilePhoto
        })

    } catch (err) {
        next(err)
    } finally {
        await mysqlConnection.end()
    }
}


// the following two request handlers are for users who forgot their passwords.
// such users should be able to remember their registered emails.
const forgotPassword = async (req, res, next) => {
    const mysqlConnection = await db()
    
    try {
        // get the user with the provided email 
        let q = "SELECT * FROM users WHERE email = ?"
        const [userArray] = await mysqlConnection.execute(q, [req.body.email])
        if (userArray.length == 0) return next(createError("fail", 401, "This user does not exist"))

        // generate a random rest token
        const randomToken = crypto.randomBytes(32).toString('hex')
        const token = await bcrypt.hash(randomToken, 12)

        // update the user information   
        const user = userArray[0]
        const passwordResetToken = token
        const passwordTokenExpiration = format(Date.now() + 10 * 60 * 1000, "yyyy-MM-dd HH:mm:ss") //expires after 10 min
        q = "UPDATE users SET `passwordResetToken` = ?, `passwordTokenExpiration` = ? WHERE id_users = ?"
        const results = await mysqlConnection.execute(q, [passwordResetToken, passwordTokenExpiration, user.id_users])
        if (results[0].affectedRows == 0) return next(createError("fail", 401, "This user does not exist"))

        // send the generated token to the user's email
        const passwordResetURL = `${process.env.CLIENT_URL}/resetpassword/${randomToken}/${user.id_users}`
        try {
            await passwordResetMail(user, passwordResetURL)

            res.status(200).json('Token sent to your email')
        } catch (err) {
            // if the email fails, reset passwordResetToken and passwordTokenExpiration to null values
            q = "UPDATE users SET `passwordResetToken` = ?, `passwordTokenExpiration` = ? WHERE id_users = ?"
            const results = await mysqlConnection.execute(q, [null, null, user.id_users])
            return next(createError('fail', 500, 'Email was not sent. Please try again'))
        }

    } catch (err) {
        next(err)
    } finally {
        await mysqlConnection.end()
    }
}

const resetPassword = async (req, res, next) => {
    const mysqlConnection = await db()
    try {
        // get the user that owns the reset token
        let q = "SELECT * FROM users WHERE id_users = ?"
        const [userArray] = await mysqlConnection.execute(q, [req.params.user_id])
        if (userArray.length == 0) return next(createError("fail", 401, "This user does not exist"))
        const user = userArray[0]
        const token = req.params.resettoken

        // confirm the reset token
        const pwdCorrect = await bcrypt.compare(token, user.passwordResetToken)
        if (!pwdCorrect) return next(createError('fail', 401, 'Token has been tampered with. Please request for another password reset'))

        // confirm reset token has not expired
        const notExpired = Date.now() < new Date(user.passwordTokenExpiration).getTime()
        if (!notExpired) return next(createError('fail', 401, 'Token has expired. Please request for another password reset'))

        // encrypt new password and save to database
        const pwd = req.body.password
        if (!pwd) return next(createError('fail', 400, "forgot to provide your new password"))
        const encryptedPassword = await bcrypt.hash(pwd, 12)
        const passwordResetTime = format(new Date(), "yyyy-MM-dd HH:mm:ss")
        const passwordTokenExpiration = null
        const passwordResetToken = null

        q = "UPDATE users SET `password` = ?, `passwordResetTime` = ?, `passwordResetToken` = ?, `passwordTokenExpiration` = ? WHERE id_users = ?"
        const results = await mysqlConnection.execute(q, [encryptedPassword, passwordResetTime, passwordResetToken, passwordTokenExpiration, user.id_users])
        if (results[0].affectedRows == 0) return next(createError("fail", 401, "This user does not exist"))
        res.status(200).json("Password reset was successful. Please sign in with your new password ")
    } catch (err) {
        next(err)
    } finally {
        await mysqlConnection.end()
    }

}

// the request handler below is for a logged in user who wants to change his/her password
// the user is required to know his/her current password
const changePassword = async (req, res, next) => {
    const mysqlConnection = await db()
    try {
        // get the user with the user id        
        let q = "SELECT * FROM users WHERE id_users = ?"
        const [userArray] = await mysqlConnection.execute(q, [req.userInfo.id])
        if (userArray.length == 0) return next(createError("fail", 401, "This user no longer exists"))
        const user = userArray[0]

        // compare the provided password with the password in the database
        const pwdCorrect = await bcrypt.compare(req.body.currentPassword, user.password)
        if (!pwdCorrect) return next(createError('fail', 401, 'Your password is incorrect. Please provide the correct password'))

        // encrypt the new password and save to database
        const encryptedPassword = await bcrypt.hash(req.body.password, 12)
        const passwordResetTime = format(new Date(), "yyyy-MM-dd HH:mm:ss")
        q = "UPDATE users SET `password` = ?, `passwordResetTime` = ? WHERE id_users = ?"
        const results = await mysqlConnection.execute(q, [encryptedPassword, passwordResetTime, user.id_users])
        if (results[0].affectedRows == 0) return next(createError("fail", 401, "This user does not exist"))
       
        res.status(200).json("Password reset was successful. Please sign in with your new password ")
    } catch (err) {
        next(err)
    } finally {
        await mysqlConnection.end()
    }
}

module.exports = {
    login,
    forgotPassword,
    resetPassword,
    changePassword
}