const sendOutMail = require("./handleEmail3");
const db = require("./mysqlConnectionWithPromise");
const schedule = require("node-schedule")

// function to format date
const formatDate = (value) => {
    let date = new Date(value);
    const day = date.toLocaleString('default', { day: '2-digit' });
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.toLocaleString('default', { year: 'numeric' });
    return day + '-' + month + '-' + year;
  }

const sendMorningReport = async () => {
    const mysqlConnection = await db();

    let q =   "SELECT * FROM " + 
          " (SELECT users.email, users.name AS customer, users.id_users AS userId, bookings.id_bookings AS id_bookings, bookings.createdAt AS createdAt, " + 
          " hotels.name, hotels.id_hotels, cities.cityName FROM users INNER JOIN bookings ON users.id_users = bookings.id_users " + 
          " INNER JOIN hotels ON bookings.id_hotels = hotels.id_hotels " +
          " INNER JOIN cities ON hotels.id_cities = cities.id_cities) AS cte1 " +
          " INNER JOIN " +
          " (SELECT unavailabledates.check_in_date, unavailabledates.check_out_date, DATEDIFF(unavailabledates.check_out_date, unavailabledates.check_in_date) AS number_of_nights, " + 
          " unavailabledates.id_bookings AS id_bookings, roomnumbers.roomNumber, roomstyledescription.price, roomstyledescription.id_roomStyleDescription, roomstyles.roomStylesNames " +
          " FROM unavailabledates INNER JOIN roomnumbers ON unavailabledates.id_roomNumbers = roomnumbers.id_roomNumbers " +
          " INNER JOIN roomstyledescription ON roomnumbers.id_roomStyleDescription = roomstyledescription.id_roomStyleDescription " +
          " INNER JOIN roomstyles ON roomstyles.id_roomStyles = roomstyledescription.id_roomStyles) AS cte2 " +
          " WHERE cte1.id_bookings = cte2.id_bookings"

          const [bookingsArray] = await mysqlConnection.execute(q, []);      

           // Build the response object in accordance to what is expected at the Front End

           let customerDetails = {}
           customerDetails.name = "Don Eze";
           customerDetails.email = "ezeabasili@yahoo.co.uk"
      // get all the booking references
    let responseArray = [];
    const allBookings = [];
    const bookingRef = [];
    bookingsArray.forEach((eachRoom) => {
      let newBooking = {};
      let userObj = {};
      let hotelObj = {};
      if (!bookingRef.includes(eachRoom.id_bookings)) {
        userObj.name = eachRoom.customer;
        hotelObj.name = eachRoom.name;
        newBooking.createdAt = eachRoom.createdAt;
        newBooking.user = userObj;
        newBooking.hotel = hotelObj;
        newBooking.id_bookings = eachRoom.id_bookings;
        newBooking.bookingDetails = [];
        allBookings.push(newBooking);
        bookingRef.push(eachRoom.id_bookings);
      }
    });

    allBookings.forEach((selectedRef) => {
      bookingsArray.forEach((roomType) => {

        if (roomType.id_bookings == selectedRef.id_bookings) {
          let roomDetails = {};
          roomDetails.roomType_id = roomType.id_roomStyleDescription;
          roomDetails.roomNumber = roomType.roomNumber;
          roomDetails.checkin_date = roomType.check_in_date;
          roomDetails.checkout_date = roomType.check_out_date;
          roomDetails.price_per_night = roomType.price;
          roomDetails.number_of_nights = roomType.number_of_nights;
          roomDetails.room_type = roomType.roomStylesNames;

          selectedRef.bookingDetails.push(roomDetails);

        }
      });
      responseArray.push({ ...selectedRef });
    });

    let htmlReceipt = `<h4>Total number of bookings: ${responseArray.length}</h4><br/><br/>`
    responseArray.forEach(newBooking => {
        const bookingDate = new Intl.DateTimeFormat('en-US', {
            dateStyle: 'full',
            timeStyle: 'long',
            timeZone: 'CST',
          }).format(newBooking.createdAt)


          htmlReceipt = htmlReceipt + `<p>Booking reference: ${newBooking.id_bookings}</p>`
          htmlReceipt = htmlReceipt + `<p style="text-transform: capitalize">Customer name: ${newBooking.user.name}</p>`
          htmlReceipt = htmlReceipt + `<p style="text-transform: capitalize">Hotel name: <strong>${newBooking.hotel.name}</strong></p>`
          htmlReceipt = htmlReceipt + `<p>Booking date: ${bookingDate}</p><br/>`
          newBooking.bookingDetails.forEach(detail => {
            htmlReceipt = htmlReceipt + `<p style="text-transform: capitalize">Room type: ${detail.room_type}</p>`
            htmlReceipt = htmlReceipt + `<p>Price per night: $${detail.price_per_night}</p>`
            htmlReceipt = htmlReceipt + `<p>Room number: ${detail.roomNumber}</p>`
            htmlReceipt = htmlReceipt + `<p>Check-in date: ${formatDate(detail.checkin_date)}</p>`
            htmlReceipt = htmlReceipt + `<p>Check-out date: ${formatDate(detail.checkout_date)}</p>`
            htmlReceipt = htmlReceipt + `<p>Number of nights: ${detail.number_of_nights}</p><br/>`
          })

          htmlReceipt = htmlReceipt + `<br/><br/>`
    })

   

    await sendOutMail(customerDetails, htmlReceipt);
        
}

module.exports = sendMorningReport
