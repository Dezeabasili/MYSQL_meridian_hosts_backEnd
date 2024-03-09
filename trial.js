const { format } = require("date-fns");

let examp = new Date().toLocaleString()
let examp2 = format(new Date(), "yyyy-MM-dd")
let examp3 = format(new Date().toLocaleString(), "yyyy-MM-dd hh-mm-ss bbb")

console.log(examp, examp2, examp3)