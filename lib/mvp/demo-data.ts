import { levelFromXp } from "./scoring";
import type { LeaderboardEntry, MvpSnapshot, Reward } from "./types";

export const DEMO_USER_ID = "demo-user";

export const defaultRewards: Reward[] = [
  {
    id: "reward-fuel-100",
    title: "₹100 Fuel Voucher",
    description: "Simulated voucher for a future fuel-partner programme.",
    rewardType: "fuel",
    pointsCost: 1000,
    partnerName: "Demo Fuel Partner",
    simulated: true,
  },
  {
    id: "reward-fastag-150",
    title: "₹150 FASTag Cashback",
    description: "Simulated cashback reward for safe-trip consistency.",
    rewardType: "fastag",
    pointsCost: 1500,
    partnerName: "Demo Mobility Partner",
    simulated: true,
  },
  {
    id: "reward-ev-250",
    title: "₹250 EV Charging Credit",
    description: "Simulated charging credit for future EV partnerships.",
    rewardType: "ev",
    pointsCost: 2200,
    partnerName: "Demo Charging Network",
    simulated: true,
  },
];

export const seededLeaderboard: LeaderboardEntry[] = [
  { id: "seed-1", name: "Neha Shah", city: "Ahmedabad", totalXp: 2440, level: "Platinum", rank: 1 },
  { id: "seed-2", name: "Arjun Verma", city: "Vadodara", totalXp: 2180, level: "Platinum", rank: 2 },
  { id: "seed-3", name: "Riya Patel", city: "Gandhinagar", totalXp: 1940, level: "Gold", rank: 3 },
  { id: "seed-4", name: "Dev Mehta", city: "Surat", totalXp: 1710, level: "Gold", rank: 4 },
  { id: "seed-5", name: "Aanya Joshi", city: "Rajkot", totalXp: 1485, level: "Gold", rank: 5 },
];

export function createDefaultSnapshot(): MvpSnapshot {
  const profile = {
    id: DEMO_USER_ID,
    fullName: "Mohit Chaudhari",
    city: "Vadodara",
    totalXp: 825,
    rewardPoints: 825,
    level: levelFromXp(825),
    currentStreak: 4,
    bestStreak: 7,
    lastTripDate: null,
  } as const;

  const leaderboard = [...seededLeaderboard, {
    id: DEMO_USER_ID,
    name: profile.fullName,
    city: profile.city,
    totalXp: profile.totalXp,
    level: profile.level,
    rank: 0,
    isCurrentUser: true,
  }]
    .sort((a, b) => b.totalXp - a.totalXp)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return {
    profile,
    vehicles: [
      {
        id: "demo-vehicle",
        registrationNumber: "GJ 06 CS 2026",
        makeModel: "CrediSafe Demo Car",
        vehicleType: "car",
        isPrimary: true,
        verificationStatus: "simulated",
        createdAt: new Date().toISOString(),
      },
    ],
    trips: [],
    rewards: defaultRewards,
    claims: [],
    leaderboard,
    videoAnalyses: [],
    backendMode: "local-demo",
  };
}
