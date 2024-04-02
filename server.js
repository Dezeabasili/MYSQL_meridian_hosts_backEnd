const express = require("express");
// const dotenv = require("dotenv").config();
const dotenv = require("dotenv").config({ path: './.env' });
// const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const corsConfiguration = require("./utils/corsConfiguration")
// const fileUpload = require('express-fileupload')
const path = require("path");
const stripe = require("stripe")(
  process.env.STRIPE_SECRET_KEY
);
const expressRateLimit = require("express-rate-limit");
const helmet = require("helmet");
const expressMongoSanitize = require("express-mongo-sanitize");
const xssClean = require("xss-clean");
const hpp = require("hpp");
const bodyparser = require("body-parser");
const trimRequestBody = require("trim-request-body");
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const hotelsRouter = require("./routes/hotels");
const roomsRouter = require("./routes/rooms");
const reviewsRouter = require("./routes/reviews");
const stripeRouter = require("./routes/stripe");
const bookingsRouter = require("./routes/bookings");
// const picturesRouter = require("./routes/pictures");
const createError = require("./utils/error");
const schedule = require("node-schedule")
const sendMorningReport = require('./utils/morningReports')
const app = express();
const PORT = process.env.PORT || 4000

// globally handle uncaught exceptions from synchronous processes. Errors that occur outside express
process.on("uncaughtException", (err) => {
  console.log("uncaught exception, shutting down");
  console.log(err.name, err.message);
  process.exit(1);
});

// app.use(helmet())

// limit the number of requests from a particular IP address
const rateLimiter = expressRateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: "You have made too many requests. Please try again after an hour",
});
// app.use('/api', rateLimiter)

app.use(
  cors(corsConfiguration)
);
app.use(cookieParser());

app.use((req, res, next) => {
  if (req.originalUrl === "/api/v1/stripe/stripe-webhook") {
    console.log("req.originalUrl: ", req.originalUrl);
    next();
  } else {
    express.json()(req, res, next);
  }
});

 // `body-parser` middleware should be loaded before `trim-request-body`
app.use(bodyparser.urlencoded({ extended: false }));

// Trim the parsed request body.
app.use(trimRequestBody);

// add JSON data into req.body
// app.use(express.json({ limit: '10kb' }))

// serving static files
app.use(express.static(path.join(__dirname, "public")));
// app.use('/hotel-cities/', express.static(path.join(__dirname, "hotel-cities")));
// app.use('/hotel-types/', express.static(path.join(__dirname, "hotel-types")));
// app.use('/hotelsPictures/', express.static(path.join(__dirname, "hotelsPictures")));
// app.use('/roomsPictures/', express.static(path.join(__dirname, "roomsPictures")));
// app.use('/profilePic/', express.static(path.join(__dirname, "profilePic")));
// app.use(express.static("public"));
// app.use('/api/v1/pictures', express.static("public"));

// data sanitization against NoSQL query injection
// app.use(expressMongoSanitize())

// data sanitization against cross site scripting (XSS) attacks
// app.use(xssClean())

// prevent http parameter pollution. Cleans the query string and parameter
// create the white list if required
// app.use(hpp())

// static files
// app.use(express.static(`${__dirname}/public`));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/hotels", hotelsRouter);
app.use("/api/v1/rooms", roomsRouter);
app.use("/api/v1/reviews", reviewsRouter);
app.use("/api/v1/stripe", stripeRouter);
app.use("/api/v1/bookings", bookingsRouter);


app.all("*", (req, res, next) => {
  next(createError("fail", 404, `cannot find ${req.originalUrl}`));
});

app.use((err, req, res, next) => {
  // console.error('ERROR ', err)
  let error;
  if (err.name === "CastError") {
    error = { ...err };
    error.message = `Invalid ${err.path}: ${err.value}`;
    error.statusCode = 400;
    error.status = "fail";
    return res.status(error.statusCode).json({
      status: error.status,
      message: error.message,
    });
  }

  if (err.name === "JsonWebTokenError") {
    error = { ...err };
    error.message = "Your access token has been tampered with";
    error.statusCode = 401;
    error.status = "fail";
    return res.status(error.statusCode).json({
      status: error.status,
      message: error.message,
    });
  }

  if (err.name === "TokenExpiredError") {
    error = { ...err };
    error.message = "Your access token has expired";
    error.statusCode = 403;
    error.status = "fail";
    return res.status(error.statusCode).json({
      status: error.status,
      message: error.message,
    });
  }

  if (err.name === "ValidationError") {
    error = { ...err };
    // get all the errors from the error object
    const validationErrorsArray = Object.values(error.errors);

    // map through the validationErrorsArray to retrieve all the error messages
    const errorMessages = validationErrorsArray.map((vError) => vError.message);

    // join all the messages together
    const combinedMessage = errorMessages.join(". ");
    error.message = combinedMessage;
    error.statusCode = 400;
    error.status = "fail";
    return res.status(error.statusCode).json({
      status: error.status,
      message: error.message,
    });
  }

  if (err.code === 11000) {
    error = { ...err };
    error.message = `You tried to use a duplicate value, ${JSON.stringify(
      err.keyValue
    )}. Please provide a different value`;
    error.statusCode = 400;
    error.status = "fail";
    console.log(error);
    return res.status(error.statusCode).json({
      status: error.status,
      message: error.message,
    });
  }

  const errorStatus = err.status || "error";
  const errorStatusCode = err.statusCode || 500;
  const errorMessage = err.message || "Something went wrong !!";

  res.status(errorStatusCode).json({
    status: errorStatus,
    message: errorMessage,
    error: err,
  });
});

// repeat task
schedule.scheduleJob('0 0 8 * * *', async () => {
  await sendMorningReport()
})

const server = app.listen(PORT, () => {
  // connect();
  console.log("listening on port 4000");
});

// globally handle rejected promises from asynchronous processes. Errors that occur outside express
process.on("unhandledRejection", (err) => {
  console.log("unhandled rejection, shutting down");
  console.log(err.name, err.message);
  // allow the server to shut down gracefully before exiting the process. Shutting the down the node process is optional
  server.close(() => {
    process.exit(1);
  });
});
