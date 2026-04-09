const express = require("express");
const fs = require("fs");
const axios = require("axios");
const UAParser = require("ua-parser-js");

const app = express();

app.set("trust proxy", true);
app.use(express.static(__dirname));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= MAIN PAGE =================
app.get("/", async (req, res) => {
  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (ip) ip = ip.split(",")[0].trim();
  if (ip === "::1") ip = "127.0.0.1";

  const referrer = req.headers.referer || "Direct";

  const parser = new UAParser(req.headers["user-agent"]);

  const browser = parser.getBrowser().name || "Unknown";
  const os = parser.getOS().name || "Unknown";
  const device = parser.getDevice().type || "Desktop";

  let city = "Unknown";
  let country = "Unknown";
  let lat = 0;
  let lon = 0;
  let isp = "Unknown";

  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);

    if (response.data.status === "success") {
      city = response.data.city;
      country = response.data.country;
      lat = response.data.lat;
      lon = response.data.lon;
      isp = response.data.isp || "Unknown";
    }
  } catch (e) {}

  const time = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata"
  });

  // TEMP log (without screen yet)
  const baseLog = `${ip}|${city}, ${country}|${browser}|${os}|${device}|${isp}|${referrer}|${time}`;

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Visitor Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
  <style>
    body { font-family: Arial; text-align: center; background: #f4f6f9; }
    .card {
      width: 400px;
      margin: 30px auto;
      padding: 20px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }
    #map {
      width: 400px;
      height: 300px;
      margin: auto;
      border-radius: 10px;
    }
    .highlight { color: #667eea; font-weight: bold; }
  </style>
</head>

<body>

<audio id="sound" loop playsinline>
  <source src="/myinstants.mp3" type="audio/mpeg">
</audio>

<div class="card">
  <h2>Visitor Info</h2>
  <div>IP: <span class="highlight">${ip}</span></div>
  <div>Location: <span class="highlight">${city}, ${country}</span></div>
  <div>Browser: <span class="highlight">${browser}</span></div>
  <div>OS: <span class="highlight">${os}</span></div>
  <div>Device: <span class="highlight">${device}</span></div>
  <div>ISP: <span class="highlight">${isp}</span></div>
  <div>Referrer: <span class="highlight">${referrer}</span></div>
</div>

<div id="map"></div>

<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

<script>
  // MAP
  var map = L.map('map').setView([${lat}, ${lon}], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  L.marker([${lat}, ${lon}]).addTo(map).bindPopup("Visitor").openPopup();

  // SCREEN DATA
  const screenWidth = screen.width;
  const screenHeight = screen.height;

  fetch("/log-screen", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      log: "${baseLog}",
      screen: screenWidth + "x" + screenHeight
    })
  });

  // AUDIO
  const audio = document.getElementById("sound");
  const unlock = () => {
    audio.play().catch(()=>{});
    events.forEach(e=>document.removeEventListener(e, unlock));
  };
  const events = ["click","touchstart","scroll","keydown"];
  events.forEach(e=>document.addEventListener(e, unlock, {once:true}));
</script>

</body>
</html>
  `);
});

// ================= RECEIVE SCREEN DATA =================
app.post("/log-screen", (req, res) => {
  const { log, screen } = req.body;

  const finalLog = `${log}|${screen}\n`;

  fs.appendFileSync(__dirname + "/ips.txt", finalLog);

  res.sendStatus(200);
});

// ================= DASHBOARD =================
app.get("/dashboard", (req, res) => {
  let rows = "";

  try {
    const data = fs.readFileSync(__dirname + "/ips.txt", "utf-8");
    const lines = data.trim().split("\n").reverse();

    lines.forEach(line => {
      const parts = line.split("|");

      rows += `
        <tr>
          <td>${parts[0]}</td>
          <td>${parts[1]}</td>
          <td>${parts[2]}</td>
          <td>${parts[3]}</td>
          <td>${parts[4]}</td>
          <td>${parts[5]}</td>
          <td>${parts[6]}</td>
          <td>${parts[7]}</td>
          <td>${parts[8]}</td>
        </tr>
      `;
    });

  } catch (e) {
    rows = "<tr><td colspan='9'>No data yet</td></tr>";
  }

  res.send(`
  <html>
  <head>
    <title>Dashboard</title>
    <style>
      body { font-family: Arial; background:#f4f6f9; padding:20px; }
      table { width:100%; border-collapse: collapse; background:white; }
      th, td { padding:10px; border:1px solid #ddd; }
      th { background:#667eea; color:white; }
    </style>
  </head>

  <body>
    <h2>Visitor Dashboard (with Screen Size)</h2>

    <table>
      <tr>
        <th>IP</th>
        <th>Location</th>
        <th>Browser</th>
        <th>OS</th>
        <th>Device</th>
        <th>ISP</th>
        <th>Referrer</th>
        <th>Time</th>
        <th>Screen</th>
      </tr>
      ${rows}
    </table>
  </body>
  </html>
  `);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});