export type TripMode = "simulation" | "gps";
export type DriverLevel = "Bronze" | "Silver" | "Gold" | "Platinum" | "Elite" | "Legend";

export type XpBreakdownCode =
  | "completion"
  | "safety"
  | "distance"
  | "clean_trip"
  | "gps_quality"
  | "streak"
  | "cap"
  | "eligibility";

export interface XpBreakdownItem {
  code: XpBreakdownCode;
  label: string;
  points: number;
  detail: string;
}

export interface XpBreakdown {
  version: string;
  eligible: boolean;
  rewardEligible: boolean;
  subtotal: number;
  cap: number;
  total: number;
  items: XpBreakdownItem[];
  note: string;
}

export interface DriverProfile {
  id: string;
  fullName: string;
  city: string;
  totalXp: number;
  rewardPoints: number;
  level: DriverLevel;
  currentStreak: number;
  bestStreak: number;
  lastTripDate: string | null;
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  makeModel: string;
  vehicleType: "car" | "bike" | "scooter" | "other";
  isPrimary: boolean;
  verificationStatus: "simulated" | "pending" | "video_matched" | "verified";
  createdAt: string;
}

export interface GpsPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
}

export interface SafetyEvent {
  type: "minor_overspeed" | "major_overspeed" | "gps_quality";
  severity: "low" | "medium" | "high";
  penalty: number;
  atSeconds: number;
  detail: string;
}

export interface Trip {
  id: string;
  mode: TripMode;
  vehicleId: string | null;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  durationSeconds: number;
  averageSpeedKmh: number;
  maximumSpeedKmh: number;
  overspeedEvents: number;
  majorOverspeedEvents: number;
  gpsQuality: number;
  safetyScore: number;
  xpEarned: number;
  rewardPointsEarned: number;
  xpBreakdown: XpBreakdown;
  events: SafetyEvent[];
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  rewardType: "fuel" | "fastag" | "ev" | "insurance";
  pointsCost: number;
  partnerName: string;
  simulated: boolean;
}

export interface RewardClaim {
  id: string;
  rewardId: string;
  rewardTitle: string;
  pointsSpent: number;
  voucherCode: string;
  status: "claimed" | "redeemed" | "expired";
  createdAt: string;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  city: string;
  totalXp: number;
  level: DriverLevel;
  rank: number;
  isCurrentUser?: boolean;
}


export interface PlateDetection {
  plate: string;
  stateCode: string;
  firstSeenSec: number;
  lastSeenSec: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  readCount: number;
  ocrConfidence: number;
  confidence: number;
  matchesExpectedPlate: boolean;
  evidenceImage?: string | null;
}

export type VideoResultState =
  | "matched"
  | "mismatch"
  | "plate_detected"
  | "low_confidence"
  | "unreadable"
  | "no_plate";

export interface VisionObservation {
  type: string;
  label: string;
  status: "observed" | "review_required" | "not_detected" | "not_analyzed";
  confidence: number;
  firstSeenSec: number;
  lastSeenSec: number;
  occurrences: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  source: string;
  reviewRequired: boolean;
  note: string;
}

export interface VisionEvidenceFrame {
  kind: "plate" | "plate_candidate" | "phone" | "traffic_light" | "scene";
  title: string;
  timestampSec: number;
  confidence: number;
  imageDataUrl: string;
}

export interface VisionCheck {
  status: "observed" | "review_required" | "not_detected" | "not_analyzed";
  confidence?: number;
  note: string;
}

export interface VideoAnalysis {
  id: string;
  tripId: string | null;
  vehicleId: string | null;
  originalFilename: string;
  status: "completed" | "failed";
  analysisVersion: string;
  resultState: VideoResultState;
  detector: {
    plateLocator: string;
    ocr: string;
    behaviourModel: string | null;
    helmetModel: string | null;
  };
  expectedPlate: string | null;
  matchedRegisteredPlate: boolean;
  matchedPlate: string | null;
  detections: PlateDetection[];
  observations: VisionObservation[];
  evidenceFrames: VisionEvidenceFrame[];
  compliance: {
    vehiclePresence: VisionCheck;
    helmet: VisionCheck;
    phoneUse: VisionCheck;
    trafficSignal: VisionCheck;
    laneDiscipline: VisionCheck;
  };
  capabilities: Record<string, unknown>;
  summary: {
    uniquePlates: number;
    rawOcrReads: number;
    processingMs: number;
    sampledFrames: number;
    sharpFrames: number;
    candidateRegions: number;
    durationSeconds: number;
    objectsDetected: number;
    vehicleDetections: number;
    personDetections: number;
    phoneDetections: number;
    trafficLightDetections: number;
    helmetDetections: number;
  };
  warnings: string[];
  createdAt: string;
}

export interface MvpSnapshot {
  profile: DriverProfile;
  vehicles: Vehicle[];
  trips: Trip[];
  rewards: Reward[];
  claims: RewardClaim[];
  leaderboard: LeaderboardEntry[];
  videoAnalyses: VideoAnalysis[];
  backendMode: "supabase" | "local-demo";
}

export interface TripResultInput {
  mode: TripMode;
  vehicleId?: string | null;
  startedAt: string;
  endedAt: string;
  points?: GpsPoint[];
  simulationPreset?: "safe_city" | "mixed_city";
  streakDays?: number;
  firstTripOfDay?: boolean;
}
