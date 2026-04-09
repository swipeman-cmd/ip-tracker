const express = require("express");
const fs = require("fs");
const axios = require("axios");
const UAParser = require("ua-parser-js");

const app = express();

// IMPORTANT for Render
app.set("trust proxy", true);

// Serve static files (audio)
app.use(express.static(__dirname));

app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (ip) ip = ip.split(",")[0].trim();
  if (ip === "::1") ip = "127.0.0.1";

  const userAgent = req.headers["user-agent"];
  const parser = new UAParser(userAgent);

  const browser = parser.getBrowser().name || "Unknown";
  const os = parser.getOS().name || "Unknown";
  const device = parser.getDevice().type || "Desktop";

  let city = "Unknown";
  let country = "Unknown";

  try {
    const response = await axios.get(`https://ipapi.co/${ip}/json/`);
    city = response.data.city || "Unknown";
    country = response.data.country_name || "Unknown";
  } catch (e) {}

  const log = `IP: ${ip} | ${city}, ${country} | ${browser} | ${os} | ${device} | ${new Date().toISOString()}\n`;

  fs.appendFileSync(__dirname + "/ips.txt", log);

  console.log(log);

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Visitor Logged</title>
  <style>
    body {
      margin: 0;
      font-family: Arial;
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

    .info {
      margin-top: 10px;
      color: #555;
    }

    .highlight {
      font-weight: bold;
      color: #667eea;
    }
  </style>
</head>

<body>

<audio id="sound" loop>
  <source src="/myinstants.mp3" type="audio/mpeg">
</audio>

<div class="card">
  <h2>Visitor Logged</h2>

  <div class="info">IP: <span class="highlight">${ip}</span></div>
  <div class="info">Location: <span class="highlight">${city}, ${country}</span></div>
  <div class="info">Browser: <span class="highlight">${browser}</span></div>
  <div class="info">OS: <span class="highlight">${os}</span></div>
  <div class="info">Device: <span class="highlight">${device}</span></div>
</div>

<script>
  const audio = document.getElementById("sound");

  const startAudio = () => {
    audio.play();

    // Remove listeners after first play
    document.removeEventListener("click", startAudio);
    document.removeEventListener("touchstart", startAudio);
  };

  document.addEventListener("click", startAudio);
  document.addEventListener("touchstart", startAudio);
</script>

</body>
</html>
  `);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});