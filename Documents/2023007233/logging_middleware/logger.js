const axios = require("axios");

async function Log(stack, level, packageName, message, token) {
  try {
    const response = await axios.post(
      "http://4.224.186.213/evaluation-service/logs",
      {
        stack,
        level,
        package: packageName,
        message,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Log created:", response.data);
  } catch (error) {
    console.error("Log failed:", error.response?.data || error.message);
  }
}

module.exports = Log;