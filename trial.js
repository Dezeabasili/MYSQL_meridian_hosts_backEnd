const schedule = require("node-schedule")

// do task at a date/time
// const date = new Date('2024-03-15 12:37:00')
// schedule.scheduleJob(date, function() {
//     console.log("Task complete")
// })

// repeat task
schedule.scheduleJob('*/10 * * * * *', async () => {
    console.log("Task complete")
})

console.log("Once again")



// const date = new Date()

// console.log(
//     new Intl.DateTimeFormat('en-US', {
//       dateStyle: 'full',
//       timeStyle: 'long',
//       timeZone: 'America/Los_Angeles',
//     }).format(date),
//   );

//   const options = { calendar: "chinese", numberingSystem: "arab" };
// const dateFormat = new Intl.DateTimeFormat(undefined, options);
// const usedOptions = dateFormat.resolvedOptions();

// console.log(usedOptions.calendar);
// // "chinese"

// console.log(usedOptions.numberingSystem);
// // "arab"

// console.log(usedOptions.timeZone);
// // "America/New_York" (the users default timezone)

