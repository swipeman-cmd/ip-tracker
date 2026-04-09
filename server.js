const express = require("express");
const fs = require("fs");
const axios = require("axios");
const UAParser = require("ua-parser-js");

const app = express();

app.set("trust proxy", true);
app.use(express.static(__dirname));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// TEMP STORAGE (per request simulation)
let tempStore = {};

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

  const baseLog = `${ip}|${city}, ${country}|${browser}|${os}|${device}|${isp}|${referrer}|${time}`;

  // store temporarily
  tempStore[ip] = { baseLog };

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Visitor Tracker</title>
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

  // AUDIO PLAY
  const audio = document.getElementById("sound");
  const unlock = () => {
    audio.play().catch(()=>{});
    events.forEach(e=>document.removeEventListener(e, unlock));
  };
  const events = ["click","touchstart","scroll","keydown"];
  events.forEach(e=>document.addEventListener(e, unlock, {once:true}));

  const screenSize = screen.width + "x" + screen.height;
  const cpu = navigator.hardwareConcurrency || "Unknown";

  fetch("/log-extra", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      ip: "${ip}",
      screen: screenSize,
      cpu: cpu
    })
  });

  async function detectAudio() {
    let mic = "Denied";
    let speakers = "Unknown";

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();

      mic = devices.some(d => d.kind === "audioinput") ? "Yes" : "No";
      speakers = devices.some(d => d.kind === "audiooutput") ? "Yes" : "No";
    } catch {}

    fetch("/log-audio", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ ip: "${ip}", mic, speakers })
    });
  }

  async function detectBattery() {
    let level = "Not supported";
    let charging = "Unknown";

    try {
      if (navigator.getBattery) {
        const b = await navigator.getBattery();
        level = Math.round(b.level * 100) + "%";
        charging = b.charging ? "Yes" : "No";
      }
    } catch {}

    fetch("/log-battery", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ ip: "${ip}", level, charging })
    });
  }

  document.addEventListener("click", () => {
    detectAudio();
    detectBattery();
  }, { once: true });
</script>

</body>
</html>
  `);
});

// ================= EXTRA =================
app.post("/log-extra", (req, res) => {
  const { ip, screen, cpu } = req.body;

  tempStore[ip].screen = screen;
  tempStore[ip].cpu = cpu;

  res.sendStatus(200);
});

// ================= AUDIO =================
app.post("/log-audio", (req, res) => {
  const { ip, mic, speakers } = req.body;

  tempStore[ip].audio = `Mic:${mic}, Speakers:${speakers}`;

  res.sendStatus(200);
});

// ================= BATTERY =================
app.post("/log-battery", (req, res) => {
  const { ip, level, charging } = req.body;

  const data = tempStore[ip];

  const finalLog = `${data.baseLog}|${data.screen}|CPU:${data.cpu}|${data.audio}|Battery:${level}, Charging:${charging}\n`;

  fs.appendFileSync(__dirname + "/ips.txt", finalLog);

  delete tempStore[ip];

  res.sendStatus(200);
});

// ================= DASHBOARD =================
app.get("/dashboard", (req, res) => {
  let rows = "";

  try {
    const lines = fs.readFileSync("ips.txt", "utf-8").split("\n").reverse();

    lines.forEach(line => {
      if (!line.includes("|")) return;

      const p = line.split("|");

      if (p.length >= 12) {
        rows += `
        <tr>
          <td>${p[0]}</td>
          <td>${p[1]}</td>
          <td>${p[2]}</td>
          <td>${p[3]}</td>
          <td>${p[4]}</td>
          <td>${p[5]}</td>
          <td>${p[6]}</td>
          <td>${p[7]}</td>
          <td>${p[8]}</td>
          <td>${p[9]}</td>
          <td>${p[10]}</td>
          <td>${p[11]}</td>
        </tr>`;
      }
    });

  } catch {}

  res.send(`
  <html>
  <body style="font-family:Arial;padding:20px">
    <h2>Visitor Dashboard</h2>
    <table border="1" cellpadding="10">
      <tr>
        <th>IP</th><th>Location</th><th>Browser</th><th>OS</th>
        <th>Device</th><th>ISP</th><th>Referrer</th><th>Time</th>
        <th>Screen</th><th>CPU</th><th>Audio</th><th>Battery</th>
      </tr>
      ${rows}
    </table>
  </body>
  </html>
  `);
});

app.listen(process.env.PORT || 3000);