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
  let region = "Unknown";
  let country = "Unknown";
  let lat = 0;
  let lon = 0;
  let isp = "Unknown";
  let org = "Unknown";
  let timezone = "Unknown";
  let zip = "Unknown";

  try {
    const response = await axios.get(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,isp,org,timezone,zip`
    );

    if (response.data.status === "success") {
      city = response.data.city || "Unknown";
      region = response.data.regionName || "Unknown";
      country = response.data.country || "Unknown";
      lat = response.data.lat || 0;
      lon = response.data.lon || 0;
      isp = response.data.isp || "Unknown";
      org = response.data.org || "Unknown";
      timezone = response.data.timezone || "Unknown";
      zip = response.data.zip || "Unknown";
    }
  } catch (e) {}

  const time = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata"
  });

  const baseLog = `${ip}|${city}, ${region}, ${country}|${browser}|${os}|${device}|${isp} (${org})|${referrer}|${time}`;

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Visitor Tracker</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
  <style>
    body { font-family: Arial; text-align: center; background: #f4f6f9; margin:0; }

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

    /* START SCREEN */
    #startScreen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      cursor: pointer;
    }

    .start-box {
      text-align: center;
      color: white;
      animation: pulse 1.5s infinite;
    }

    .start-box h1 {
      font-size: 32px;
      margin-bottom: 10px;
    }

    .start-box p {
      font-size: 16px;
      opacity: 0.8;
    }

    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.08); }
      100% { transform: scale(1); }
    }
  </style>
</head>

<body>

<!-- START SCREEN -->
<div id="startScreen">
  <div class="start-box">
    <h1>🔊 Tap to Continue</h1>
    <p>Click anywhere to proceed</p>
  </div>
</div>

<!-- MAIN CONTENT -->
<div id="mainContent" style="display:none;">

<audio id="sound" loop playsinline>
  <source src="/myinstants.mp3" type="audio/mpeg">
</audio>

<div class="card">
  <h2>Visitor Info</h2>
  <div>IP: <span class="highlight">${ip}</span></div>
  <div>Location: <span class="highlight">${city}, ${region}, ${country}</span></div>
  <div>ZIP: <span class="highlight">${zip}</span></div>
  <div>Timezone: <span class="highlight">${timezone}</span></div>
  <div>Org: <span class="highlight">${org}</span></div>
  <div>Browser: <span class="highlight">${browser}</span></div>
  <div>OS: <span class="highlight">${os}</span></div>
  <div>Device: <span class="highlight">${device}</span></div>
  <div>ISP: <span class="highlight">${isp}</span></div>
  <div>Referrer: <span class="highlight">${referrer}</span></div>
</div>

<div id="map"></div>

</div>

<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

<script>
  // START SCREEN LOGIC
  const audio = document.getElementById("sound");
  const startScreen = document.getElementById("startScreen");
  const mainContent = document.getElementById("mainContent");

  function startExperience() {
    audio.play().catch(()=>{});
    startScreen.style.display = "none";
    mainContent.style.display = "block";
  }

  ["click","touchstart","keydown"].forEach(e => {
    document.addEventListener(e, startExperience, { once: true });
  });

  // MAP
  var map = L.map('map').setView([${lat}, ${lon}], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  L.marker([${lat}, ${lon}]).addTo(map).bindPopup("Visitor").openPopup();

  // SCREEN + CPU
  const screenSize = screen.width + "x" + screen.height;
  const cpu = navigator.hardwareConcurrency || "Unknown";

  fetch("/log-extra", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      log: "${baseLog}",
      screen: screenSize,
      cpu: cpu
    })
  });

  // AUDIO DEVICES
  async function detectAudioDevices() {
    let mic = "Not allowed";
    let speakers = "Unknown";

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();

      mic = devices.some(d => d.kind === "audioinput") ? "Yes" : "No";
      speakers = devices.some(d => d.kind === "audiooutput") ? "Yes" : "No";

    } catch (err) {
      mic = "Denied";
      speakers = "Unknown";
    }

    fetch("/log-audio", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ mic, speakers })
    });
  }

  document.addEventListener("click", detectAudioDevices, { once: true });

  // BATTERY
  async function getBatteryInfo() {
    let level = "Not supported";
    let charging = "Unknown";

    try {
      if (navigator.getBattery) {
        const battery = await navigator.getBattery();
        level = Math.round(battery.level * 100) + "%";
        charging = battery.charging ? "Yes" : "No";
      }
    } catch (e) {
      level = "Error";
    }

    fetch("/log-battery", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ level, charging })
    });
  }

  document.addEventListener("click", getBatteryInfo, { once: true });
</script>

</body>
</html>
  `);
});

// ================= LOG EXTRA =================
app.post("/log-extra", (req, res) => {
  const { log, screen, cpu } = req.body;
  fs.appendFileSync(__dirname + "/ips.txt", `${log}|${screen}|CPU:${cpu}\n`);
  res.sendStatus(200);
});

// ================= AUDIO LOG =================
app.post("/log-audio", (req, res) => {
  const { mic, speakers } = req.body;
  fs.appendFileSync(__dirname + "/ips.txt", `Audio | Mic:${mic} | Speakers:${speakers}\n`);
  res.sendStatus(200);
});

// ================= BATTERY LOG =================
app.post("/log-battery", (req, res) => {
  const { level, charging } = req.body;
  fs.appendFileSync(__dirname + "/ips.txt", `Battery | ${level} | Charging:${charging}\n`);
  res.sendStatus(200);
});

// ================= DASHBOARD =================
app.get("/dashboard", (req, res) => {
  let rows = "";

  try {
    const data = fs.readFileSync(__dirname + "/ips.txt", "utf-8");
    const lines = data.trim().split("\n").reverse();

    lines.forEach(line => {
      if (
        line.includes("127.0.0.1") ||
        line.includes("undefined") ||
        !line.includes("|")
      ) return;

      const parts = line.split("|");

      if (parts.length >= 10) {
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
          <td>${parts[9]}</td>
        </tr>`;
      }
    });

  } catch (e) {
    rows = "<tr><td colspan='10'>No data yet</td></tr>";
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
    <h2>Visitor Dashboard</h2>
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
        <th>CPU</th>
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