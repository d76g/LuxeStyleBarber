require("dotenv").config(); // For environment variables
const nodemailer = require("nodemailer");

// Step 1: Create a transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Rep
    pass: process.env.EMAIL_PASS, // Replace with your Google App Password
  },
});

module.exports = transporter;
