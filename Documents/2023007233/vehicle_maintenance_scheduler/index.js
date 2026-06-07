const axios = require("axios");
const { knapsackSolver } = require("./knapsack");

// Paste your latest access token here
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJubWtAZ2l0YW0uaW4iLCJleHAiOjE3ODA4MTgxMzksImlhdCI6MTc4MDgxNzIzOSwiaXNzIjoiQWZmb3JkIE1lZGljYWwgVGVjaG5vbG9naWVzIFByaXZhdGUgTGltaXRlZCIsImp0aSI6IjI0ZWUzZmZhLWYzMjktNGNkNC1iOTI5LTVlNjg4MTFhNGNiYSIsImxvY2FsZSI6ImVuLUlOIiwibmFtZSI6Im5lZXRodXNocmVlX21rIiwic3ViIjoiODk3OWFjYTItYzlhYS00OWMxLWEyOGUtYWNhZGRiYzlmYzljIn0sImVtYWlsIjoibm1rQGdpdGFtLmluIiwibmFtZSI6Im5lZXRodXNocmVlX21rIiwicm9sbE5vIjoiMjAyMzAwNzIzMyIsImFjY2Vzc0NvZGUiOiJ3Z0t0Z1oiLCJjbGllbnRJRCI6Ijg5NzlhY2EyLWM5YWEtNDljMS1hMjhlLWFjYWRkYmM5ZmM5YyIsImNsaWVudFNlY3JldCI6Im5weHNjZE16S0RNS0FXRWgifQ.QLv_o3c9qiFFAVGKM5LAJyWF-SIrPoLSN1Kx0R-ZeqE";

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function getData() {
  try {
    console.log("Token length:", TOKEN.length);

    console.log("Fetching depots...");
    const depots = await axios.get(
      "http://4.224.186.213/evaluation-service/depots",
      { headers }
    );

    console.log("Depots fetched successfully");
    console.log(JSON.stringify(depots.data, null, 2));

    console.log("Fetching vehicles...");
    const vehicles = await axios.get(
      "http://4.224.186.213/evaluation-service/vehicles",
      { headers }
    );

    console.log("Vehicles fetched successfully");
    console.log(JSON.stringify(vehicles.data, null, 2));
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
} } catch (error) {
    console.error(
      "Status:",
      error.response?.status
    );
    console.error(
      "Response:",
      error.response?.data || error.message
    );
  }
}

getData();