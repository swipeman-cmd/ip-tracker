const express = require("express");
const fs = require("fs");
const axios = require("axios");

const app = express();

// VERY IMPORTANT for Render (fix IP issue)
app.set("trust proxy", true);

app.use(express.urlencoded({ extended: true }));

// Main route - Logs IP + Location
app.get("/", async (req, res) => {
  // Get real IP
  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (ip) {
    ip = ip.split(",")[0].trim();
  }

  // Fix localhost
  if (ip === "::1") ip = "127.0.0.1";

  let city = "Unknown";
  let country = "Unknown";

  try {
    const response = await axios.get(`https://ipapi.co/${ip}/json/`);
    const data = response.data;

    city = data.city || "Unknown";
    country = data.country_name || "Unknown";

  } catch (error) {
    console.log("Location error:", error.message);
  }

  const log = `IP: ${ip} | ${city}, ${country} | ${new Date().toISOString()}\n`;

  fs.appendFileSync(__dirname + "/ips.txt", log);

  console.log(log);

  res.send(`
    <h2>Thank You!</h2>
    <p>Your IP and approximate location have been logged.</p>
    <p><strong>IP:</strong> ${ip}</p>
    <p><strong>Location:</strong> ${city}, ${country}</p>
  `);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});