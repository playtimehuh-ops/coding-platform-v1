export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    runs: 20,
    contextFiles: 12
  },
  builder: {
    id: "builder",
    name: "Builder",
    price: 12,
    runs: 500,
    contextFiles: 40
  },
  team: {
    id: "team",
    name: "Team",
    price: 29,
    runs: 2000,
    contextFiles: 80
  }
};

export function publicPlans() {
  return Object.values(PLANS);
}
