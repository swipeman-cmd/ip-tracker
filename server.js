const express = require("express");
const fs = require("fs");
const axios = require("axios");
const UAParser = require("ua-parser-js");

const app = express();

// VERY IMPORTANT for Render
app.set("trust proxy", true);

app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
  // Get real IP
  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (ip) {
    ip = ip.split(",")[0].trim();
  }

  if (ip === "::1") ip = "127.0.0.1";

  // Get browser info
  const userAgent = req.headers["user-agent"];
  const parser = new UAParser(userAgent);

  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  const browserName = browser.name || "Unknown";
  const osName = os.name || "Unknown";
  const deviceType = device.type || "Desktop";

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

  const log = `IP: ${ip} | ${city}, ${country} | Browser: ${browserName} | OS: ${osName} | Device: ${deviceType} | ${new Date().toISOString()}\n`;

  fs.appendFileSync(__dirname + "/ips.txt", log);

  console.log(log);

  // UI Response
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Visitor Info</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: linear-gradient(135deg, #667eea, #764ba2);
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .card {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      text-align: center;
      width: 400px;
    }

    h2 {
      margin-bottom: 10px;
    }

    .info {
      margin-top: 10px;
      font-size: 15px;
      color: #555;
    }

    .highlight {
      font-weight: bold;
      color: #667eea;
    }
  </style>
</head>

<body>
  <div class="card">
    <h2>Visitor Logged</h2>

    <div class="info">
      IP: <span class="highlight">${ip}</span>
    </div>

    <div class="info">
      Location: <span class="highlight">${city}, ${country}</span>
    </div>

    <div class="info">
      Browser: <span class="highlight">${browserName}</span>
    </div>

    <div class="info">
      OS: <span class="highlight">${osName}</span>
    </div>

    <div class="info">
      Device: <span class="highlight">${deviceType}</span>
    </div>
  </div>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});