const axios = require("axios");
const { knapsackSolver } = require("./knapsack");
require("dotenv").config();

const TOKEN = process.env.ACCESS_TOKEN;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function getData() {
  try {
    if (!TOKEN) {
      throw new Error("ACCESS_TOKEN not found in .env file");
    }

    console.log("Token loaded successfully");
    console.log("Token length:", TOKEN.length);

    console.log("Fetching depots...");
    const depots = await axios.get(
      "http://4.224.186.213/evaluation-service/depots",
      { headers }
    );

    console.log("Depots fetched successfully");

    console.log("Fetching vehicles...");
    const vehicles = await axios.get(
      "http://4.224.186.213/evaluation-service/vehicles",
      { headers }
    );

    console.log("Vehicles fetched successfully");

    console.log("Starting optimization...");

    for (const depot of depots.data.depots) {
      const result = knapsackSolver(
        vehicles.data.vehicles,
        depot.MechanicHours
      );

      console.log("\n====================");
      console.log(`Depot: ${depot.ID}`);
      console.log(`Mechanic Hours: ${depot.MechanicHours}`);
      console.log(`Total Impact: ${result.totalImpact}`);
      console.log(`Total Duration: ${result.totalDuration}`);
      console.log(`Tasks Selected: ${result.selectedTasks.length}`);
    }
  } catch (error) {
    console.error("Status:", error.response?.status);
    console.error(
      "Response:",
      error.response?.data || error.message
    );
  }
}

getData();