"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type DemoState = {
  totalXp: number;
  rewardPoints: number;
  rewardProgress: number;
  rank: number;
  score: number;
  lastTripXp: number;
  trips: number;
  streak: number;
};

type DemoContextValue = DemoState & {
  hydrated: boolean;
  runTrip: () => void;
  reset: () => void;
};

const STORAGE_KEY = "credisafe-cinematic-demo-v2";

const initial: DemoState = {
  totalXp: 1980,
  rewardPoints: 1280,
  rewardProgress: 64,
  rank: 12,
  score: 94,
  lastTripXp: 0,
  trips: 24,
  streak: 18,
};

const DemoContext = createContext<DemoContextValue | null>(null);

function isStoredState(value: unknown): value is Partial<DemoState> {
  return Boolean(value && typeof value === "object");
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isStoredState(parsed)) setState({ ...initial, ...parsed });
      }
    } catch {
      // Private browsing and malformed values should never break the demo.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable in strict privacy modes.
    }
  }, [hydrated, state]);

  const value = useMemo<DemoContextValue>(
    () => ({
      ...state,
      hydrated,
      runTrip: () =>
        setState((current) => {
          const rewardPoints = current.rewardPoints + 93;
          return {
            totalXp: current.totalXp + 186,
            rewardPoints,
            rewardProgress: Math.min(100, Math.round((rewardPoints / 2000) * 100)),
            rank: Math.max(1, current.rank - 2),
            score: 97,
            lastTripXp: 186,
            trips: current.trips + 1,
            streak: current.streak + 1,
          };
        }),
      reset: () => setState(initial),
    }),
    [hydrated, state],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemo must be used inside DemoProvider");
  return context;
}
