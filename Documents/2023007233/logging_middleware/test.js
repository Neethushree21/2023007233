require("dotenv").config();

const Log = require("./logger");

const TOKEN = process.env.ACCESS_TOKEN;

Log(
  "backend",
  "info",
  "middleware",
  "Logger test successful",
  TOKEN
);