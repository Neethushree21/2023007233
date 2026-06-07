const notifications = [
  {
    ID: "7d188d51-b20e-4ecd-b51c-5e0b2116eee5",
    Type: "Placement",
    Message: "Advanced Micro Devices Inc. hiring",
    Timestamp: "2026-06-06 19:55:16"
  },
  {
    ID: "2f0ae624-0b00-4a1a-9bce-ff6dfb72ba63",
    Type: "Placement",
    Message: "Apple Inc. hiring",
    Timestamp: "2026-06-06 12:25:01"
  },
  {
    ID: "1f468a19-66af-4e02-9f44-913019756939",
    Type: "Placement",
    Message: "Nvidia Corporation hiring",
    Timestamp: "2026-06-06 16:54:46"
  },
  {
    ID: "fba595f9-5582-473d-bfba-4c4b54e04861",
    Type: "Result",
    Message: "mid-sem",
    Timestamp: "2026-06-06 15:23:46"
  },
  {
    ID: "16a89206-11c8-4b2f-89e0-fdebd321f4be",
    Type: "Event",
    Message: "tech-fest",
    Timestamp: "2026-06-07 04:23:16"
  }
];

const weights = {
  Placement: 3,
  Result: 2,
  Event: 1
};

const ranked = notifications.map((n) => ({
  ...n,
  score:
    weights[n.Type] * 1000000000 +
    new Date(n.Timestamp).getTime()
}));

ranked.sort((a, b) => b.score - a.score);

console.log("TOP PRIORITY NOTIFICATIONS");
console.table(ranked);