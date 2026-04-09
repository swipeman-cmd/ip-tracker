const express = require("express");
const fs = require("fs");
const axios = require("axios");

const app = express();

app.use(express.urlencoded({ extended: true }));

// Consent page
app.get("/", (req, res) => {
  res.send(`
    <h2>Consent Required</h2>
    <p>We log your IP address and approximate location for demonstration purposes.</p>
    <form method="POST" action="/accept">
      <button type="submit">I Agree</button>
    </form>
  `);
});

// Handle consent + log IP + location
app.post("/accept", async (req, res) => {
  let ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  // Clean IP (sometimes comes as multiple)
  if (ip.includes(",")) {
    ip = ip.split(",")[0];
  }

  try {
    const response = await axios.get(`https://ipapi.co/${ip}/json/`);
    const data = response.data;

    const city = data.city || "Unknown";
    const country = data.country_name || "Unknown";

    const log = `IP: ${ip} | ${city}, ${country} | ${new Date().toISOString()}\n`;

    fs.appendFileSync(__dirname + "/ips.txt", log);

    console.log(log);

  } catch (error) {
    console.log("Error fetching location:", error.message);
  }

  res.send("<h3>Thanks! Your IP and location have been logged.</h3>");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});