require("dotenv").config(); // For environment variables
const express = require("express");
const path = require("path");
const nodemailer = require("nodemailer");
const pool = require("./db");
const cookieParser = require("cookie-parser");
const transporter = require("./email.js");
const app = express();
const port = 3000;
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const authenticateToken = require("./authToken");
const userRoutes = require("./userRoutes");
app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "admin/dashboard"),
  path.join(__dirname, "admin/login"),
]);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from the "assets" directory
app.use("/assets", express.static(path.join(__dirname, "assets")));

// Default route (root)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Create Appointment Table (if it doesn't exist)
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS Appointments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    barber_name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    time VARCHAR(50) NOT NULL,
    message VARCHAR(500)
  );
`;

// create USer Table
const createUserTableQuery = `
  CREATE TABLE IF NOT EXISTS Users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email)
  );
`;

// Create Appointments Table
async function createAppointmentTable() {
  try {
    await pool.query(createTableQuery);
    console.log("Appointment table created successfully.");
  } catch (error) {
    console.error("Error creating Users table:", error);
  }
}
// Create Users Table
async function createUsersTable() {
  try {
    await pool.query(createUserTableQuery);
    console.log("Users table created successfully.");
  } catch (error) {
    console.error("Error creating Users table:", error);
  }
}

async function createDefaultUser() {
  const name = "Admin";
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASS; // Change to a secure password
  const hashedPassword = await bcrypt.hash(password, 10); // Hash the password

  const insertUserQuery = `
      INSERT INTO Users (name, email, password)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO NOTHING;
    `;

  try {
    await pool.query(insertUserQuery, [name, email, hashedPassword]);
    console.log("Default user created successfully.");
  } catch (error) {
    console.error("Error creating default user:", error);
  }
}
async function initialize() {
  await createUsersTable();
  await createDefaultUser();
  await createAppointmentTable();
}
initialize();
// Helper to validate appointment data
const validateAppointmentData = (data) => {
  const { name, email, phone, category, date, time } = data;
  if (!name || !email || !phone || !category || !date || !time) {
    return false;
  }
  return true;
};
async function addAppointment({
  name,
  email,
  phone,
  category,
  date,
  time,
  barberName,
  message,
}) {
  const insertQuery = `
      INSERT INTO Appointments (name, email, phone, category, date, time, barber_name, message)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
  const values = [
    name,
    email,
    phone,
    category,
    date,
    time,
    barberName,
    message,
  ];
  const result = await pool.query(insertQuery, values);
  return result.rows[0];
}

async function isTimeSlotAvailable(date, time) {
  try {
    // Fetch the total number of barbers (users)
    const barberCountResult = await pool.query("SELECT COUNT(*) FROM Users");
    const totalBarbers = parseInt(barberCountResult.rows[0].count, 10);

    // Count the number of appointments already booked for the given date and time
    const query = `
      SELECT COUNT(*) FROM Appointments
      WHERE date = $1 AND time = $2
    `;
    const result = await pool.query(query, [date, time]);
    const bookedAppointments = parseInt(result.rows[0].count, 10);

    // Check if the booked appointments are less than the total number of barbers
    return bookedAppointments < totalBarbers;
  } catch (error) {
    console.error("Error checking time slot availability:", error);
    throw new Error("Error checking time slot availability");
  }
}

app.post("/admin/dashboard/add-appointment", async (req, res) => {
  const userName = req.cookies.userName || "Guest"; // Get user's name from cookies
  try {
    const { name, email, phone, category, date, time, barberName, message } =
      req.body;

    if (!validateAppointmentData(req.body)) {
      return res
        .status(400)
        .json({ error: "Invalid or missing input fields." });
    }

    // Check if the time slot is available
    const isAvailable = await isTimeSlotAvailable(date, time);
    if (!isAvailable) {
      return res.status(400).json({
        error: `Het tijdslot op ${date} om ${time} is al geboekt.`,
      });
    }

    // Save the appointment
    const savedAppointment = await addAppointment({
      name,
      email,
      phone,
      category,
      date,
      time,
      barberName,
      message,
    });

    // Fetch updated appointments
    const result = await pool.query(
      "SELECT * FROM Appointments ORDER BY date, time"
    );
    const appointments = result.rows;

    // Re-render the dashboard with updated appointments
    // Send emails (omitted for brevity)
    // Email content
    const adminEmailContent = `
  <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
    <h1 style="color: #4b68ff;">Nieuwe Afspraak Gemaakt</h1>
    <p style="font-size: 16px;">Hier zijn de details van de nieuwe afspraak:</p>
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
      <tr>
        <td style="font-weight: bold; padding: 5px;">Naam:</td>
        <td style="padding: 5px;">${name}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">E-mail:</td>
        <td style="padding: 5px;">${email}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Telefoon:</td>
        <td style="padding: 5px;">${phone}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Categorie:</td>
        <td style="padding: 5px;">${category}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Datum:</td>
        <td style="padding: 5px;">${date}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Tijd:</td>
        <td style="padding: 5px;">${time}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Kapper:</td>
        <td style="padding: 5px;">${barberName}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Bericht:</td>
        <td style="padding: 5px;">${message || "Geen bericht opgegeven"}</td>
      </tr>
    </table>
  </div>
`;


const customerEmailContent = `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
  <h1 style="color: #4b68ff;">Afspraakbevestiging</h1>
  <p style="font-size: 16px;">Beste ${name},</p>
  <p style="font-size: 16px;">Bedankt voor het boeken van een afspraak bij ons. Hier zijn de details van uw afspraak:</p>
  <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
    <tr>
      <td style="font-weight: bold; padding: 5px;">Categorie:</td>
      <td style="padding: 5px;">${category}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; padding: 5px;">Datum:</td>
      <td style="padding: 5px;">${date}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; padding: 5px;">Tijd:</td>
      <td style="padding: 5px;">${time}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; padding: 5px;">Kapper:</td>
      <td style="padding: 5px;">${barberName}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; padding: 5px;">Bericht:</td>
      <td style="padding: 5px;">${message || "Geen bericht opgegeven"}</td>
    </tr>
  </table>
  <p style="margin-top: 20px; font-size: 16px;">We kijken ernaar uit om u te zien!</p>
</div>
`;


    // // Send emails
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL, // Admin email from environment variables
      subject: "Nieuwe afspraak geboekt",
      html: adminEmailContent,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email, // Customer's email
      subject: "Bevestiging van afspraak",
      html: customerEmailContent,
    });
    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("Error adding appointment:", error);
    res.status(500).send("Error adding appointment.");
  }
});

app.post("/book-appointment", async (req, res) => {
  try {
    const { name, email, phone, category, date, time, barberName, message } =
      req.body;

    if (!validateAppointmentData(req.body)) {
      return res
        .status(400)
        .json({ error: "Invalid or missing input fields." });
    }

    // Check if the time slot is available
    const isAvailable = await isTimeSlotAvailable(date, time);
    if (!isAvailable) {
      return res.status(400).json({
        error: `The time slot on ${date} at ${time} is already booked.`,
      });
    }

    // Save the appointment
    const insertQuery = `
      INSERT INTO Appointments (name, email, phone, category, date, time, barber_name, message)
      VALUES ($1, $2, $3, $4, $5, $6, $7 ,$8)
      RETURNING *;
    `;
    const values = [
      name,
      email,
      phone,
      category,
      date,
      time,
      barberName,
      message,
    ];
    const result = await pool.query(insertQuery, values);
    const savedAppointment = result.rows[0];

    // Send emails (omitted for brevity)
    // Email content
    const adminEmailContent = `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <h1 style="color: #4b68ff;">Nieuwe Afspraak Gemaakt</h1>
      <p style="font-size: 16px;">Hier zijn de details van de nieuwe afspraak:</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <tr>
          <td style="font-weight: bold; padding: 5px;">Naam:</td>
          <td style="padding: 5px;">${name}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; padding: 5px;">E-mail:</td>
          <td style="padding: 5px;">${email}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; padding: 5px;">Telefoon:</td>
          <td style="padding: 5px;">${phone}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; padding: 5px;">Categorie:</td>
          <td style="padding: 5px;">${category}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; padding: 5px;">Datum:</td>
          <td style="padding: 5px;">${date}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; padding: 5px;">Tijd:</td>
          <td style="padding: 5px;">${time}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; padding: 5px;">Kapper:</td>
          <td style="padding: 5px;">${barberName}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; padding: 5px;">Bericht:</td>
          <td style="padding: 5px;">${message || "Geen bericht opgegeven"}</td>
        </tr>
      </table>
    </div>
  `;
  

  const customerEmailContent = `
  <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
    <h1 style="color: #4b68ff;">Afspraakbevestiging</h1>
    <p style="font-size: 16px;">Beste ${name},</p>
    <p style="font-size: 16px;">Bedankt voor het boeken van een afspraak bij ons. Hier zijn de details van uw afspraak:</p>
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
      <tr>
        <td style="font-weight: bold; padding: 5px;">Categorie:</td>
        <td style="padding: 5px;">${category}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Datum:</td>
        <td style="padding: 5px;">${date}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Tijd:</td>
        <td style="padding: 5px;">${time}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Kapper:</td>
        <td style="padding: 5px;">${barberName}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Bericht:</td>
        <td style="padding: 5px;">${message || "Geen bericht opgegeven"}</td>
      </tr>
    </table>
    <p style="margin-top: 20px; font-size: 16px;">We kijken ernaar uit om u te zien!</p>
  </div>
`;


    // Send emails
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL, // Admin email from environment variables
      subject: "Nieuwe afspraak geboekt",
      html: adminEmailContent,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email, // Customer's email
      subject: "Bevestiging van afspraak",
      html: customerEmailContent,
    });

    res.status(200).json({ message: "Appointment booked successfully!" });
  } catch (error) {
    console.error("Error saving appointment:", error);
    res.status(500).json({ error: "Failed to save appointment." });
  }
});

const serviceDurations = {
  Knippen: 30,
  "Haar en Scheren": 45,
  "Baard Scheren": 15,
  "Kinderen tot 10 jaar": 30,
  Senioren: 30,
  "Studenten knippen": 30,
  "Volledige service": 60,
  Verven: 15,
};

app.get("/api/available-slots", async (req, res) => {
  const { date, category } = req.query;

  if (!date || !category) {
    return res.status(400).json({ error: "Date and category are required." });
  }

  try {
    const serviceDuration = serviceDurations[category];
    if (!serviceDuration) {
      return res.status(400).json({ error: "Invalid service category." });
    }

    // Fetch existing appointments for the given date
    const appointmentsResult = await pool.query(
      "SELECT time, barber_name FROM Appointments WHERE date = $1",
      [date]
    );

    const appointments = appointmentsResult.rows.map((row) => row.time);

    // Get all barbers
    const barbersResult = await pool.query("SELECT name FROM Users");
    const allBarbers = barbersResult.rows.map((row) => row.name);

    if (allBarbers.length === 0) {
      return res.status(400).json({ error: "No barbers available." });
    }

    // Create time slots
    const startTime = 10 * 60; // 11:00 AM in minutes
    const endTime = 20 * 60; // 8:00 PM in minutes
    const now = new Date();

    let currentMinutes = 0;
    if (date === now.toISOString().split("T")[0]) {
      currentMinutes = now.getHours() * 60 + now.getMinutes(); // Current time in minutes
    }

    const allSlots = [];
    for (let time = startTime; time < endTime; time += serviceDuration) {
      if (date === now.toISOString().split("T")[0] && time < currentMinutes) {
        continue; // Skip past time slots for today
      }

      const hours = Math.floor(time / 60)
        .toString()
        .padStart(2, "0");
      const minutes = (time % 60).toString().padStart(2, "0");
      allSlots.push(`${hours}:${minutes}`);
    }

    // Determine available slots
    const availableSlots = allSlots.filter((slot) => {
      const overlappingAppointments = appointments.filter(
        (appt) => appt === slot
      );
      return overlappingAppointments.length < allBarbers.length;
    });

    res.json({ availableSlots });
  } catch (error) {
    console.error("Error fetching available slots:", error);
    res.status(500).json({ error: "Failed to fetch available slots." });
  }
});

app.get("/api/available-barbers", async (req, res) => {
  const { date, time, category } = req.query;

  if (!date || !time || !category) {
    return res
      .status(400)
      .json({ error: "Date, time, and category are required." });
  }

  try {
    const serviceDuration = serviceDurations[category];
    if (!serviceDuration) {
      return res.status(400).json({ error: "Ongeldige servicecategorie." });
    }

    // Convert `time` to minutes since midnight
    const [hours, minutes] = time.split(":").map(Number);
    const timeInMinutes = hours * 60 + minutes;

    // Fetch all barbers
    const barbersResult = await pool.query("SELECT name FROM Users");
    const allBarbers = barbersResult.rows.map((row) => row.name);

    if (allBarbers.length === 0) {
      return res.status(400).json({ error: "Geen kappers beschikbaar" });
    }

    // Fetch barbers booked for the given date and overlapping time slot
    const bookedResult = await pool.query(
      `SELECT barber_name 
       FROM Appointments 
       WHERE date::text = $1  -- Ensure date comparison works
       AND (
         (CAST(substring(time, 1, 2) AS INT) * 60 + CAST(substring(time, 4, 2) AS INT)) BETWEEN $2 AND $3
         OR 
         (CAST(substring(time, 1, 2) AS INT) * 60 + CAST(substring(time, 4, 2) AS INT) + $4) > $2
       )`,
      [date, timeInMinutes, timeInMinutes + serviceDuration, serviceDuration]
    );
    

    const bookedBarbers = bookedResult.rows.map((row) => row.barber_name);

    // Determine available barbers
    const availableBarbers = allBarbers.filter(
      (barber) => !bookedBarbers.includes(barber)
    );

    res.json({ availableBarbers });
  } catch (error) {
    console.error("Error fetching available barbers:", error);
    res
      .status(500)
      .json({ error: "Het ophalen van beschikbare kappers is mislukt." });
  }
});

app.get("/api/fully-booked-dates", async (req, res) => {
  try {
    const query = `
      SELECT TO_CHAR(date, 'YYYY-MM-DD') AS formatted_date
      FROM Appointments
      GROUP BY date
      HAVING COUNT(time) >= $1
    `;

    const maxSlotsPerDay = 17; // Adjust as needed
    const result = await pool.query(query, [maxSlotsPerDay]);

    // Extract the formatted dates
    const fullyBookedDates = result.rows.map((row) => row.formatted_date);

    res.json({ fullyBookedDates });
  } catch (error) {
    console.error("Error fetching fully booked dates:", error);
    res.status(500).json({ error: "Failed to fetch fully booked dates." });
  }
});

app.get("/admin/dashboard", authenticateToken, async (req, res) => {
  const userName = req.cookies.userName || "Guest"; // Get user's name from cookies

  try {
    const users = await pool.query("SELECT id, name FROM Users");
    const barbers = users.rows;
    const result = await pool.query(`
            SELECT id, name, time, email, category, phone, message, barber_name, TO_CHAR(date, 'YYYY-MM-DD') AS date
            FROM Appointments
            ORDER BY date, time
          `);
    const appointments = result.rows;

    // Render the dashboard template with the appointments data
    res.render("dashboard", { barbers, appointments, userName });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).send("Error fetching appointments.");
  }
});

// edit data
app.get("/api/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, name, time, email, category, phone, message,barber_name, TO_CHAR(date, 'YYYY-MM-DD') AS date FROM Appointments WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Appointment not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching appointment:", error);
    res.status(500).json({ error: "Failed to fetch appointment." });
  }
});

app.put("/api/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, category, date, time, barberName, message } =
      req.body;

    const result = await pool.query(
      "UPDATE Appointments SET name = $1, email = $2, phone = $3, category = $4, date = $5, time = $6, barber_name= $7, message = $8 WHERE id = $9 RETURNING *",
      [name, email, phone, category, date, time, barberName, message, id]
    );

    // Send emails (omitted for brevity)
    // Email content
    const adminEmailContent = `
  <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
    <h1 style="color: #4b68ff;">Afspraak Gewijzigd</h1>
    <p style="font-size: 16px;">De volgende afspraak is bijgewerkt:</p>
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
      <tr>
        <td style="font-weight: bold; padding: 5px;">Naam:</td>
        <td style="padding: 5px;">${name}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">E-mail:</td>
        <td style="padding: 5px;">${email}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Telefoon:</td>
        <td style="padding: 5px;">${phone}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Categorie:</td>
        <td style="padding: 5px;">${category}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Nieuwe Datum:</td>
        <td style="padding: 5px;">${date}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Nieuwe Tijd:</td>
        <td style="padding: 5px;">${time}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Kapper:</td>
        <td style="padding: 5px;">${barberName}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Bericht:</td>
        <td style="padding: 5px;">${message || "Geen bericht opgegeven"}</td>
      </tr>
    </table>
  </div>
`;

    const customerEmailContent = `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
  <h1 style="color: #4b68ff;">Afspraakwijziging</h1>
  <p style="font-size: 16px;">Beste ${name},</p>
  <p style="font-size: 16px;">Uw afspraak is bijgewerkt. Hier zijn de nieuwe details:</p>
  <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
    <tr>
      <td style="font-weight: bold; padding: 5px;">Categorie:</td>
      <td style="padding: 5px;">${category}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; padding: 5px;">Nieuwe Datum:</td>
      <td style="padding: 5px;">${date}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; padding: 5px;">Nieuwe Tijd:</td>
      <td style="padding: 5px;">${time}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; padding: 5px;">Kapper:</td>
      <td style="padding: 5px;">${barberName}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; padding: 5px;">Bericht:</td>
      <td style="padding: 5px;">${message || "Geen bericht opgegeven"}</td>
    </tr>
  </table>
  <p style="margin-top: 20px; font-size: 16px;">
    Bedankt voor uw begrip. Neem contact met ons op als u nog vragen heeft.
  </p>
  <p style="font-size: 16px;">We kijken ernaar uit om u te zien!</p>
</div>
`;

    // Send emails
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL, // Admin email from environment variables
      subject: "Nieuwe afspraak geboekt",
      html: adminEmailContent,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email, // Customer's email
      subject: "Bevestiging van afspraak",
      html: customerEmailContent,
    });

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Appointment not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(500).json({ error: "Failed to update appointment." });
  }
});

// delete appointment
app.delete("/api/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Retrieve the appointment details before deletion
    const appointmentQuery = await pool.query(
      "SELECT * FROM Appointments WHERE id = $1",
      [id]
    );

    if (appointmentQuery.rowCount === 0) {
      return res.status(404).json({ error: "Appointment not found." });
    }

    const appointment = appointmentQuery.rows[0];

    // Delete the appointment
    const deleteResult = await pool.query(
      "DELETE FROM Appointments WHERE id = $1",
      [id]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(500).json({ error: "Failed to delete appointment." });
    }

    // Email content
    const adminEmailContent = `
  <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
    <h1 style="color: #4b68ff;">Afspraak Geannuleerd</h1>
    <p style="font-size: 16px;">De volgende afspraak is geannuleerd:</p>
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
      <tr>
        <td style="font-weight: bold; padding: 5px;">Naam:</td>
        <td style="padding: 5px;">${appointment.name}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">E-mail:</td>
        <td style="padding: 5px;">${appointment.email}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Telefoon:</td>
        <td style="padding: 5px;">${appointment.phone}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Categorie:</td>
        <td style="padding: 5px;">${appointment.category}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Datum:</td>
        <td style="padding: 5px;">${appointment.date}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Tijd:</td>
        <td style="padding: 5px;">${appointment.time}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Kapper:</td>
        <td style="padding: 5px;">${appointment.barber_name}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 5px;">Bericht:</td>
        <td style="padding: 5px;">${
          appointment.message || "Geen bericht opgegeven"
        }</td>
      </tr>
    </table>
  </div>
`;

    const customerEmailContent = `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
  <h1 style="color: #4b68ff;">Afspraak Geannuleerd</h1>
  <p style="font-size: 16px;">Beste ${appointment.name},</p>
  <p style="font-size: 16px;">Uw afspraak is geannuleerd. Hier zijn de details van de geannuleerde afspraak:</p>
  <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
    <tr>
      <td style="font-weight: bold; padding: 5px;">Categorie:</td>
      <td style="padding: 5px;">${appointment.category}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; padding: 5px;">Datum:</td>
      <td style="padding: 5px;">${appointment.date}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; padding: 5px;">Tijd:</td>
      <td style="padding: 5px;">${appointment.time}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; padding: 5px;">Kapper:</td>
      <td style="padding: 5px;">${appointment.barber_name}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; padding: 5px;">Bericht:</td>
      <td style="padding: 5px;">${
        appointment.message || "Geen bericht opgegeven"
      }</td>
    </tr>
  </table>
  <p style="margin-top: 20px; font-size: 16px;">
    We vinden het jammer dat de afspraak is geannuleerd. Neem gerust contact met ons op als u een nieuwe afspraak wilt maken of vragen heeft.
  </p>
  <p style="font-size: 16px;">We hopen u in de toekomst te mogen verwelkomen!</p>
</div>
`;

    // Send emails
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: "Afspraak geannuleerd",
      html: adminEmailContent,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: appointment.email,
      subject: "Afspraak geannuleerd",
      html: customerEmailContent,
    });

    res.json({ message: "Appointment deleted successfully and emails sent." });
  } catch (error) {
    console.error("Error deleting appointment:", error);
    res.status(500).json({ error: "Failed to delete appointment." });
  }
});

app.get("/admin/login", (req, res) => {
  res.render("login", { error: null }); // Render login.ejs in admin/login folder
});

app.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Fetch user by email
    const result = await pool.query("SELECT * FROM Users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];

    // If user not found or password doesn't match
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res
        .status(401)
        .render("login", { error: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id }, // Payload
      process.env.JWT_SECRET, // Secret key
      { expiresIn: "1h" } // Token expiry
    );

    // Send the token in cookies
    res.cookie("token", token, { httpOnly: true, maxAge: 3600000 }); // 1 hour
    res.cookie("userName", user.name, { maxAge: 3600000 }); // Store user name in cookies for 1 hour
    res.redirect("/admin/dashboard"); // Redirect to dashboard
  } catch (error) {
    console.error("Error during login:", error);
    res
      .status(500)
      .render("login", { error: "An error occurred. Please try again." });
  }
});

app.get("/api/barbers", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name FROM Users");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching barbers:", error);
    res.status(500).json({ error: "Failed to fetch barbers." });
  }
});

app.get(
  "/admin/dashboard/appointments",
  authenticateToken,
  async (req, res) => {
    const { filter } = req.query;

    console.log("Filter received:", filter); // Debug filter received

    const today = new Date();
    let query = `
    SELECT id, name, time, email, category, phone, message, barber_name, TO_CHAR(date, 'YYYY-MM-DD') AS date
    FROM Appointments
  `;
    let params = [];

    if (filter === "previous") {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1); // Yesterday's date
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30); // 30 days before today
      query += ` WHERE date >= $1 AND date <= $2`;
      params = [
        thirtyDaysAgo.toISOString().split("T")[0],
        yesterday.toISOString().split("T")[0],
      ];
    } else if (filter === "today") {
      const todayDate = today.toISOString().split("T")[0]; // Today's date
      query += ` WHERE date = $1`;
      params = [todayDate];
    } else if (filter === "upcoming") {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1); // Tomorrow's date
      const fourteenDaysAhead = new Date(today);
      fourteenDaysAhead.setDate(today.getDate() + 14); // 14 days ahead
      query += ` WHERE date >= $1 AND date <= $2`;
      params = [
        tomorrow.toISOString().split("T")[0],
        fourteenDaysAhead.toISOString().split("T")[0],
      ];
    }

    query += ` ORDER BY date, time`;

    console.log("Constructed Query:", query); // Log the query
    console.log("Query Params:", params); // Log the parameters

    try {
      const result = await pool.query(query, params);
      console.log("Query Result:", result.rows); // Log the result
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ error: "Error fetching appointments." });
    }
  }
);

app.get("/admin/logout", (req, res) => {
  res.clearCookie("token"); // Clear the token cookie
  res.redirect("/admin/login"); // Redirect to login page
});

// users
app.use("/admin/users", userRoutes);

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
