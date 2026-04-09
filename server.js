const express = require("express");
const fs = require("fs");
const axios = require("axios");
const UAParser = require("ua-parser-js");

const app = express();

app.set("trust proxy", true);
app.use(express.static(__dirname));
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (ip) ip = ip.split(",")[0].trim();
  if (ip === "::1") ip = "127.0.0.1";

  const parser = new UAParser(req.headers["user-agent"]);

  const browser = parser.getBrowser().name || "Unknown";
  const os = parser.getOS().name || "Unknown";
  const device = parser.getDevice().type || "Desktop";

  let city = "Unknown";
  let country = "Unknown";
  let lat = 0;
  let lon = 0;

  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);

    if (response.data.status === "success") {
      city = response.data.city;
      country = response.data.country;
      lat = response.data.lat;
      lon = response.data.lon;
    }
  } catch (e) {
    console.log("Location error:", e.message);
  }

  const log = `IP: ${ip} | ${city}, ${country} | ${browser} | ${os} | ${device} | ${new Date().toISOString()}\n`;
  fs.appendFileSync(__dirname + "/ips.txt", log);

  console.log(log);

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Visitor Map</title>

  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>

  <style>
    body {
      margin: 0;
      font-family: Arial;
      background: #f4f6f9;
      text-align: center;
    }

    .card {
      margin: 20px auto;
      padding: 20px;
      width: 400px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }

    #map {
      height: 400px;
      margin: 20px;
      border-radius: 10px;
    }

    .info {
      margin-top: 10px;
    }

    .highlight {
      color: #667eea;
      font-weight: bold;
    }
  </style>
</head>

<body>

<audio id="sound" loop playsinline>
  <source src="/myinstants.mp3" type="audio/mpeg">
</audio>

<div class="card">
  <h2>Visitor Info</h2>

  <div class="info">IP: <span class="highlight">${ip}</span></div>
  <div class="info">Location: <span class="highlight">${city}, ${country}</span></div>
  <div class="info">Browser: <span class="highlight">${browser}</span></div>
  <div class="info">OS: <span class="highlight">${os}</span></div>
  <div class="info">Device: <span class="highlight">${device}</span></div>
</div>

<div id="map"></div>

<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

<script>
  // MAP
  var map = L.map('map').setView([${lat}, ${lon}], 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);

  L.marker([${lat}, ${lon}]).addTo(map)
    .bindPopup("Visitor Location")
    .openPopup();

  // AUDIO (NO BUTTON, WORKS ON ANY INTERACTION)
  const audio = document.getElementById("sound");

  const unlockAudio = () => {
    audio.play().then(() => {
      console.log("Audio started");
    }).catch(err => {
      console.log("Blocked:", err);
    });

    events.forEach(event => {
      document.removeEventListener(event, unlockAudio);
    });
  };

  const events = [
    "click",
    "touchstart",
    "pointerdown",
    "keydown",
    "scroll"
  ];

  events.forEach(event => {
    document.addEventListener(event, unlockAudio, { once: true });
  });
</script>

</body>
</html>
  `);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});