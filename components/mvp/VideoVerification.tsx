"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  CarFront,
  CheckCircle2,
  Clock3,
  Eye,
  FileVideo2,
  Gauge,
  ScanLine,
  Server,
  ShieldCheck,
  Smartphone,
  TrafficCone,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { formatDate } from "./Formatters";
import { useMvp } from "./MvpProvider";
import type { VideoAnalysis, VideoResultState, VisionCheck } from "@/lib/mvp/types";

interface ServiceStatus {
  configured: boolean;
  available: boolean;
  message: string;
  health?: {
    version?: string;
    plate_locator?: string;
    ocr?: string;
    max_upload_mb?: number;
    behaviour_detection?: boolean;
    tesseract_available?: boolean;
    capabilities?: Record<string, any>;
  };
}

const stateCopy: Record<VideoResultState, { eyebrow: string; title: string; body: string }> = {
  matched: {
    eyebrow: "Vehicle matched",
    title: "Registered vehicle confirmed",
    body: "The selected registration number was read repeatedly from the uploaded footage.",
  },
  mismatch: {
    eyebrow: "Different plate detected",
    title: "Review the vehicle identity",
    body: "A readable registration plate was found, but it did not match the selected vehicle.",
  },
  plate_detected: {
    eyebrow: "Plate detected",
    title: "Vehicle evidence is available",
    body: "A valid registration number was read from the footage. Select a registered vehicle to verify a match.",
  },
  low_confidence: {
    eyebrow: "Low-confidence evidence",
    title: "A possible plate needs review",
    body: "OCR produced a possible registration number, but the evidence is not strong enough for verification.",
  },
  unreadable: {
    eyebrow: "Plate candidate found",
    title: "The registration number was not readable",
    body: "The system found plate-shaped regions, but motion, distance or blur prevented a confident OCR result.",
  },
  no_plate: {
    eyebrow: "No plate found",
    title: "Use a closer vehicle view",
    body: "No suitable registration-plate region was found in the sampled frames.",
  },
};

export function VideoVerification() {
  const { snapshot, analyzeVideo, busy } = useMvp();
  const [service, setService] = useState<ServiceStatus | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tripId, setTripId] = useState("");
  const [vehicleId, setVehicleId] = useState(snapshot.vehicles.find((item) => item.isPrimary)?.id ?? snapshot.vehicles[0]?.id ?? "");
  const [result, setResult] = useState<VideoAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTrip = useMemo(() => snapshot.trips.find((trip) => trip.id === tripId) ?? null, [snapshot.trips, tripId]);
  const selectedVehicle = useMemo(() => snapshot.vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null, [snapshot.vehicles, vehicleId]);
  const recentTrips = snapshot.trips.filter((trip) => trip.mode === "gps").slice(0, 12);
  const uploadLimit = service?.health?.max_upload_mb ?? 25;

  useEffect(() => {
    let active = true;
    fetch("/api/vision/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => { if (active) setService(body.data as ServiceStatus); })
      .catch((statusError) => { if (active) setService({ configured: true, available: false, message: statusError.message }); });
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function chooseFile(next: File | null) {
    setError(null);
    setResult(null);
    if (preview) URL.revokeObjectURL(preview);
    if (!next) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (next.size > uploadLimit * 1024 * 1024) {
      setError(`Use a short clip below ${uploadLimit} MB.`);
      return;
    }
    if (!next.type.startsWith("video/") && !/\.(mp4|mov|m4v|avi|webm|mkv)$/i.test(next.name)) {
      setError("Select a supported video file.");
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  async function submit() {
    if (!file) {
      setError("Choose a short road or vehicle clip first.");
      return;
    }
    if (!selectedVehicle) {
      setError("Add and select a vehicle before running verification.");
      return;
    }
    setError(null);
    try {
      const analysis = await analyzeVideo({ file, tripId: tripId || null, vehicleId: selectedVehicle.id });
      setResult(analysis);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Video analysis failed");
    }
  }

  return (
    <div className="mvp-vision-layout">
      <section className="mvp-vision-workspace">
        <div className="mvp-vision-status-row">
          <div className={`mvp-service-pill ${service?.available ? "ready" : "offline"}`}>
            <Server size={16} />
            <span>{service === null ? "Checking vision service…" : service.available ? "Vision service ready" : "Vision service offline"}</span>
          </div>
          {service?.health?.version && <small>Service v{service.health.version}</small>}
        </div>

        <div className="mvp-vision-heading">
          <span className="mvp-panel-kicker"><ScanLine size={16} /> GPS + video intelligence</span>
          <h2>Verify the vehicle and review visible road evidence.</h2>
          <p>CrediSafe combines registration-plate OCR, vehicle and road-object detection, evidence frames and an optional GPS trip. Observations remain reviewable and never create automatic penalties.</p>
        </div>

        <div className="mvp-vision-form-grid">
          <label>
            <span>Vehicle to verify</span>
            <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
              {snapshot.vehicles.length === 0 && <option value="">No vehicle added</option>}
              {snapshot.vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.registrationNumber} · {vehicle.makeModel}</option>)}
            </select>
          </label>
          <label>
            <span>Connect to GPS trip</span>
            <select value={tripId} onChange={(event) => {
              const nextTripId = event.target.value;
              setTripId(nextTripId);
              const trip = snapshot.trips.find((item) => item.id === nextTripId);
              if (trip?.vehicleId) setVehicleId(trip.vehicleId);
            }}>
              <option value="">Standalone vehicle verification</option>
              {recentTrips.map((trip) => <option value={trip.id} key={trip.id}>{formatDate(trip.endedAt)} · {trip.distanceKm.toFixed(1)} km · score {trip.safetyScore}</option>)}
            </select>
          </label>
        </div>

        {!file ? (
          <label className="mvp-video-dropzone">
            <input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,.mkv" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
            <div><Upload size={28} /></div>
            <strong>Choose a short road video</strong>
            <span>MP4, MOV, WebM, AVI or MKV · up to {uploadLimit} MB</span>
            <small>For plate matching, keep one vehicle close, steady and clearly visible. General road footage can still produce scene observations.</small>
          </label>
        ) : (
          <div className="mvp-video-preview-card">
            <video src={preview ?? undefined} controls muted playsInline />
            <div>
              <FileVideo2 size={19} />
              <span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></span>
              <button type="button" onClick={() => chooseFile(null)} aria-label="Remove selected video"><X size={17} /></button>
            </div>
          </div>
        )}

        {selectedTrip && (
          <div className="mvp-combined-trip-strip">
            <div><Gauge size={18} /><span><strong>{selectedTrip.safetyScore}/100</strong><small>GPS safety score</small></span></div>
            <div><Clock3 size={18} /><span><strong>{selectedTrip.distanceKm.toFixed(1)} km</strong><small>Recorded journey</small></span></div>
            <div><CarFront size={18} /><span><strong>{selectedVehicle?.registrationNumber ?? "Vehicle"}</strong><small>Expected plate</small></span></div>
          </div>
        )}

        <div className="mvp-vision-actions">
          <button className="mvp-button primary large" disabled={busy || !file || !selectedVehicle || service?.available === false} onClick={submit}>
            {busy ? <><ScanLine className="spin" size={18} /> Analysing video…</> : <><Camera size={18} /> Analyse video</>}
          </button>
          {!selectedVehicle && <Link className="mvp-button secondary large" href="/app/profile">Add vehicle</Link>}
        </div>

        {error && <div className="mvp-inline-error"><AlertTriangle size={18} /><span>{error}</span></div>}
        {service && !service.available && (
          <div className="mvp-vision-offline-help">
            <strong>Start the Python service in a second terminal:</strong>
            <code>npm run dev:vision</code>
            <span>{service.message}</span>
          </div>
        )}

        {result && <AnalysisResult analysis={result} tripScore={selectedTrip?.safetyScore ?? null} />}
      </section>

      <aside className="mvp-vision-sidebar">
        <div className="mvp-panel mvp-honesty-panel">
          <span className="mvp-panel-kicker"><ShieldCheck size={16} /> Analysis coverage</span>
          <h3>What this video layer can review</h3>
          <ul>
            <li>Indian registration plates and vehicle matching.</li>
            <li>Visible cars, motorcycles, people and road objects.</li>
            <li>Possible phone-object proximity for human review.</li>
            <li>Visible traffic-light state estimates.</li>
            <li>Optional helmet observations when a dedicated model is configured.</li>
          </ul>
          <div className="mvp-warning-note"><AlertTriangle size={17} /><span>Video observations never alter GPS score, XP or rewards automatically. Lane and signal violations require calibrated camera geometry.</span></div>
        </div>

        <div className="mvp-panel">
          <span className="mvp-panel-kicker">Recent evidence</span>
          <h3>{snapshot.videoAnalyses.length} saved analyses</h3>
          <div className="mvp-recent-analysis-list">
            {snapshot.videoAnalyses.length === 0 ? <p className="mvp-muted">No video has been analysed yet.</p> : snapshot.videoAnalyses.slice(0, 5).map((analysis) => (
              <div key={analysis.id}>
                <i className={analysis.matchedRegisteredPlate ? "matched" : "unmatched"}>{analysis.matchedRegisteredPlate ? <CheckCircle2 size={15} /> : <Camera size={15} />}</i>
                <span><strong>{analysis.matchedPlate ?? resultLabel(analysis.resultState)}</strong><small>{formatDate(analysis.createdAt)}</small></span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function AnalysisResult({ analysis, tripScore }: { analysis: VideoAnalysis; tripScore: number | null }) {
  const copy = stateCopy[analysis.resultState];
  const positive = analysis.resultState === "matched" || analysis.resultState === "plate_detected";
  const checks = [
    { key: "vehicle", icon: CarFront, title: "Vehicle presence", value: analysis.compliance.vehiclePresence },
    { key: "helmet", icon: BadgeCheck, title: "Helmet", value: analysis.compliance.helmet },
    { key: "phone", icon: Smartphone, title: "Phone interaction", value: analysis.compliance.phoneUse },
    { key: "signal", icon: TrafficCone, title: "Traffic signal", value: analysis.compliance.trafficSignal },
    { key: "lane", icon: Eye, title: "Lane discipline", value: analysis.compliance.laneDiscipline },
  ];

  return (
    <div className={`mvp-analysis-result ${positive ? "matched" : "unmatched"}`}>
      <div className="mvp-analysis-result-head">
        <div className="mvp-analysis-result-icon">{positive ? <CheckCircle2 size={28} /> : <AlertTriangle size={28} />}</div>
        <div>
          <span>{copy.eyebrow}</span>
          <h3>{analysis.matchedPlate ? formatPlate(analysis.matchedPlate) : copy.title}</h3>
          <p>{copy.body}</p>
        </div>
      </div>

      <div className="mvp-analysis-metrics">
        {tripScore !== null && <div><strong>{tripScore}/100</strong><span>GPS score</span></div>}
        <div><strong>{analysis.summary.vehicleDetections}</strong><span>Vehicle observations</span></div>
        <div><strong>{analysis.summary.sampledFrames}</strong><span>Frames sampled</span></div>
        <div><strong>{(analysis.summary.processingMs / 1000).toFixed(1)}s</strong><span>Processing time</span></div>
      </div>

      <div className="mvp-analysis-section">
        <div className="mvp-analysis-section-title"><span>Vehicle identity</span><small>{analysis.summary.uniquePlates} readable plate{analysis.summary.uniquePlates === 1 ? "" : "s"}</small></div>
        {analysis.detections.length > 0 ? (
          <div className="mvp-plate-detection-list">
            {analysis.detections.map((detection) => (
              <div className={detection.matchesExpectedPlate ? "matched" : ""} key={`${detection.plate}-${detection.firstSeenSec}`}>
                <span className="mvp-detected-plate">{formatPlate(detection.plate)}</span>
                <span>{Math.round(detection.confidence * 100)}% evidence confidence</span>
                <span>{detection.readCount} read{detection.readCount === 1 ? "" : "s"}</span>
                <span>{detection.firstSeenSec.toFixed(1)}s</span>
              </div>
            ))}
          </div>
        ) : <p className="mvp-analysis-empty">No valid registration number was read from this clip.</p>}
      </div>

      <div className="mvp-analysis-section">
        <div className="mvp-analysis-section-title"><span>Visible safety checks</span><small>Evidence-led, reviewable results</small></div>
        <div className="mvp-vision-check-grid">
          {checks.map(({ key, icon: Icon, title, value }) => <CheckCard key={key} icon={<Icon size={18} />} title={title} check={value} />)}
        </div>
      </div>

      {analysis.observations.length > 0 && (
        <div className="mvp-analysis-section">
          <div className="mvp-analysis-section-title"><span>Detected observations</span><small>{analysis.observations.length} grouped result{analysis.observations.length === 1 ? "" : "s"}</small></div>
          <div className="mvp-observation-list">
            {analysis.observations.map((observation) => (
              <div key={`${observation.type}-${observation.firstSeenSec}`}>
                <i className={observation.reviewRequired ? "review" : "observed"}>{observation.reviewRequired ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}</i>
                <span><strong>{observation.label}</strong><small>{observation.note}</small></span>
                <b>{Math.round(observation.confidence * 100)}%</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.evidenceFrames.length > 0 && (
        <div className="mvp-analysis-section">
          <div className="mvp-analysis-section-title"><span>Evidence frames</span><small>Captured from the uploaded video</small></div>
          <div className="mvp-evidence-grid">
            {analysis.evidenceFrames.map((frame, index) => (
              <figure key={`${frame.kind}-${frame.timestampSec}-${index}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={frame.imageDataUrl} alt={frame.title} />
                <figcaption><strong>{frame.title}</strong><span>{frame.timestampSec.toFixed(1)}s{frame.confidence > 0 ? ` · ${Math.round(frame.confidence * 100)}%` : ""}</span></figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      <div className="mvp-analysis-warning-list">
        {analysis.warnings.map((warning) => <span key={warning}><AlertTriangle size={14} /> {warning}</span>)}
      </div>
    </div>
  );
}

function CheckCard({ icon, title, check }: { icon: ReactNode; title: string; check: VisionCheck }) {
  return (
    <article className={`mvp-vision-check ${check.status}`}>
      <div>{icon}</div>
      <span><strong>{title}</strong><small>{statusLabel(check.status)}</small></span>
      <p>{check.note}</p>
    </article>
  );
}

function statusLabel(status: VisionCheck["status"]) {
  if (status === "observed") return "Observed";
  if (status === "review_required") return "Review required";
  if (status === "not_detected") return "Not detected";
  return "Not analysed";
}

function resultLabel(state: VideoResultState) {
  return stateCopy[state].eyebrow;
}

function formatPlate(value: string) {
  const plate = value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (plate.length < 8) return plate;
  return `${plate.slice(0, 2)} ${plate.slice(2, 4)} ${plate.slice(4, -4)} ${plate.slice(-4)}`.replace(/\s+/g, " ").trim();
}
