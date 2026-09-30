export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    interval: "month",
    runs: 20,
    contextFiles: 12,
    privateRepos: 1,
    models: ["auto:coding", "auto", "auto:fast"]
  },
  builder: {
    id: "builder",
    name: "Builder",
    price: 12,
    interval: "month",
    runs: 500,
    contextFiles: 40,
    privateRepos: 10,
    models: ["auto:coding", "auto", "auto:smart", "auto:fast"]
  },
  team: {
    id: "team",
    name: "Team",
    price: 29,
    interval: "month",
    runs: 2000,
    contextFiles: 80,
    privateRepos: 50,
    models: ["auto:coding", "auto", "auto:smart", "auto:fast"]
  }
};

export function publicPlans() {
  return Object.values(PLANS);
}