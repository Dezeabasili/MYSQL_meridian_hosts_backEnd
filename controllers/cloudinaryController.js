// const User = require("../models/users");
const createError = require("../utils/error");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const generateSignature = async (req, res, next) => {
  const folder = req.body.folder;
  if (!folder) return next(createError("fail", 404, "folder name is required"));
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: folder,
      },
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({ timestamp: timestamp, signature: signature });
  } catch (err) {
    next(err);
  }
};

module.exports = generateSignature;
