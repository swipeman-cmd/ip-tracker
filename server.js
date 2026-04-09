const express = require("express");
const fs = require("fs");
const app = express();

app.use(express.urlencoded({ extended: true }));

// Consent page
app.get("/", (req, res) => {
  res.send(`
    <h2>Consent Required</h2>
    <p>We log your IP address for demonstration purposes.</p>
    <form method="POST" action="/accept">
      <button type="submit">I Agree</button>
    </form>
  `);
});

// Handle consent + log IP
app.post("/accept", (req, res) => {
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  const log = `IP: ${ip} - ${new Date().toISOString()}\n`;

  fs.appendFileSync("ips.txt", log);

  console.log(log);

  res.send("<h3>Thanks! Your IP has been logged.</h3>");
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log("Server running at http://localhost:3000");
});