const express = require("express");
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(express.urlencoded({ extended: true }));

// Main route - Logs IP + Location immediately when page is opened
app.get("/", async (req, res) => {
  // Get IP address
  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  // Clean IP (in case of multiple IPs like from proxies)
  if (ip && ip.includes(",")) {
    ip = ip.split(",")[0].trim();
  }

  // Fix localhost IPv6
  if (ip === "::1") ip = "127.0.0.1";

  let city = "Unknown";
  let country = "Unknown";

  try {
    const response = await axios.get(`https://ipapi.co/${ip}/json/`);
    const data = response.data;

    city = data.city || "Unknown";
    country = data.country_name || "Unknown";

    // Log to file
    const log = `IP: ${ip} | ${city}, ${country} | ${new Date().toISOString()}\n`;
    fs.appendFileSync(__dirname + "/ips.txt", log);

    console.log(log);
  } catch (error) {
    console.log("Error fetching location:", error.message);

    // Still log the IP even if location fails
    const log = `IP: ${ip} | Location fetch failed | ${new Date().toISOString()}\n`;
    fs.appendFileSync(__dirname + "/ips.txt", log);
  }

  // Show result to the user
  res.send(`
    <h2>Thank You!</h2>
    <p>Your IP and approximate location have been logged for demonstration purposes.</p>
    <p><strong>IP:</strong> ${ip}</p>
    <p><strong>Location:</strong> ${city}, ${country}</p>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});