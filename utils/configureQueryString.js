const configureQueryStr = (str1, str) => {
    let str2 = str1.lastIndexOf(str)
    return str1.substring(0, str2)
}

module.exports = configureQueryStr