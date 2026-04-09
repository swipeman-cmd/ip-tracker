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

  let city = "Loading...";
  let region = "";
  let country = "";
  let lat = 20;
  let lon = 78;
  let isp = "Loading...";
  let org = "";
  let timezone = "";
  let zip = "";

  // FAST API CALL (non-blocking)
  axios.get(`http://ip-api.com/json/${ip}`)
    .then(r => {
      if (r.data.status === "success") {
        city = r.data.city;
        region = r.data.regionName;
        country = r.data.country;
        lat = r.data.lat;
        lon = r.data.lon;
        isp = r.data.isp;
        org = r.data.org;
        timezone = r.data.timezone;
        zip = r.data.zip;
      }
    })
    .catch(()=>{});

  const time = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata"
  });

  const baseLog = `${ip}|${city}, ${region}, ${country}|${browser}|${os}|${device}|${isp}|${referrer}|${time}`;

  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Visitor Tracker</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>

<style>
body {
  margin:0;
  font-family: Arial;
  background:#f4f6f9;
  text-align:center;
}

.card {
  width:400px;
  margin:30px auto;
  padding:20px;
  background:white;
  border-radius:12px;
  box-shadow:0 5px 20px rgba(0,0,0,0.1);
}

#map {
  width:400px;
  height:300px;
  margin:auto;
  border-radius:10px;
}

.highlight {
  color:#667eea;
  font-weight:bold;
}

/* START SCREEN */
#startScreen {
  position:fixed;
  width:100%;
  height:100%;
  background:linear-gradient(135deg,#667eea,#764ba2);
  display:flex;
  justify-content:center;
  align-items:center;
  z-index:9999;
  cursor:pointer;
}

.start-box {
  color:white;
  text-align:center;
  animation:pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform:scale(1); }
  50% { transform:scale(1.1); }
  100% { transform:scale(1); }
}
</style>
</head>

<body>

<!-- START SCREEN -->
<div id="startScreen">
  <div class="start-box">
    <h1>Tap to Continue</h1>
    <p>Click anywhere</p>
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
  <div id="location">Location: Loading...</div>
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
const audio = document.getElementById("sound");
const startScreen = document.getElementById("startScreen");
const mainContent = document.getElementById("mainContent");

function startExperience() {
  audio.volume = 1.0; // MAX allowed by browser

  audio.play().catch(()=>{});

  startScreen.style.display = "none";
  mainContent.style.display = "block";

  setTimeout(() => {
    var map = L.map('map').setView([${lat}, ${lon}], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
      .addTo(map);

    L.marker([${lat}, ${lon}])
      .addTo(map)
      .bindPopup("Visitor")
      .openPopup();

    map.invalidateSize();
  }, 100);

  setTimeout(() => {
    document.getElementById("location").innerText =
      "Location: ${city}, ${region}, ${country}";
  }, 500);
}

// MULTI DEVICE SUPPORT
["click","touchstart","keydown"].forEach(e => {
  document.addEventListener(e, startExperience, { once: true });
});

// EXTRA DATA LOG
const screenSize = screen.width + "x" + screen.height;
const cpu = navigator.hardwareConcurrency || "Unknown";

fetch("/log-extra", {
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body: JSON.stringify({
    log: "${baseLog}",
    screen: screenSize,
    cpu: cpu
  })
});
</script>

</body>
</html>
  `);
});

// ================= LOG =================
app.post("/log-extra", (req, res) => {
  const { log, screen, cpu } = req.body;
  fs.appendFileSync(__dirname + "/ips.txt", `${log}|${screen}|CPU:${cpu}\n`);
  res.sendStatus(200);
});

// ================= DASHBOARD =================
app.get("/dashboard", (req, res) => {
  let rows = "";

  try {
    const data = fs.readFileSync(__dirname + "/ips.txt", "utf-8");
    const lines = data.trim().split("\n").reverse();

    lines.forEach(line => {
      const p = line.split("|");

      if (p.length >= 10) {
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
        </tr>`;
      }
    });
  } catch {}

  res.send(`
  <html>
  <body style="font-family:Arial;padding:20px;background:#f4f6f9;">
    <h2>Visitor Dashboard</h2>
    <table border="1" cellpadding="10" style="width:100%;background:white;">
      <tr>
        <th>IP</th><th>Location</th><th>Browser</th><th>OS</th>
        <th>Device</th><th>ISP</th><th>Referrer</th>
        <th>Time</th><th>Screen</th><th>CPU</th>
      </tr>
      ${rows}
    </table>
  </body>
  </html>
  `);
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running...");
});