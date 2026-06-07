const Log = require("../logging_middleware/logger");

 
function knapsackSolver(tasks, budget) {
  Log(
  "backend",
  "info",
  "service",
  `Starting knapsack solver. Tasks=${tasks.length}, Budget=${budget}`
);
const n = tasks.length;
const W = budget;

  // dp[i][w] = best impact using first i tasks with capacity w
  const dp = Array.from({ length: n + 1 }, () => new Array(W + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { Duration: d, Impact: v } = tasks[i - 1];
    for (let w = 0; w <= W; w++) {
      dp[i][w] = dp[i - 1][w]; // don't pick
      if (d <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - d] + v); // pick
      }
    }
  }

  // Traceback to find which tasks were selected
  const selectedTasks = [];
  let w = W;
  for (let i = n; i >= 1; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selectedTasks.push(tasks[i - 1]);
      w -= tasks[i - 1].Duration;
    }
  }

  const totalImpact = dp[n][W];
  const totalDuration = selectedTasks.reduce((acc, t) => acc + t.Duration, 0);

  Log(
  "backend",
  "info",
  "service",
  `Starting knapsack solver. Tasks=${tasks.length}, Budget=${budget}`
);
selectedTasks.reverse();
  return { selectedTasks, totalImpact, totalDuration };
}

module.exports = { knapsackSolver };
async function getData() {
  try {
    const depots = await axios.get(
      "http://4.224.186.213/evaluation-service/depots",
      { headers }
    );

    const vehicles = await axios.get(
      "http://4.224.186.213/evaluation-service/vehicles",
      { headers }
    );

    // 👇 INSERT THE LOOP HERE
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
    console.error(
      error.response?.data || error.message
    );
  }
}

getData();