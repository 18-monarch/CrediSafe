"use client";

import { FormEvent, useEffect, useState } from "react";
import { CarFront, CheckCircle2, RotateCcw, Save, UserRound } from "lucide-react";
import { useMvp } from "@/components/mvp/MvpProvider";
import { LoadingState, PageHeader } from "@/components/mvp/UI";

export default function ProfilePage() {
  const { snapshot, ready, busy, addVehicle, updateProfile, resetDemo } = useMvp();
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [vehicleType, setVehicleType] = useState<"car" | "bike" | "scooter" | "other">("car");

  useEffect(() => {
    setFullName(snapshot.profile.fullName);
    setCity(snapshot.profile.city);
  }, [snapshot.profile.fullName, snapshot.profile.city]);

  if (!ready) return <LoadingState />;

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    await updateProfile({ fullName, city }).catch(() => undefined);
  }

  async function saveVehicle(event: FormEvent) {
    event.preventDefault();
    await addVehicle({ registrationNumber, makeModel, vehicleType, isPrimary: true }).catch(() => undefined);
    setRegistrationNumber("");
    setMakeModel("");
  }

  return (
    <>
      <PageHeader eyebrow="Driver and vehicle" title="Keep your driver profile clear and useful." description="Manage the information required to identify a driver, attach a vehicle and save meaningful trip results." />

      <div className="mvp-profile-grid">
        <form className="mvp-panel mvp-form" onSubmit={saveProfile}>
          <div className="mvp-panel-title"><div><span>Driver profile</span><h3>Personal details</h3></div><UserRound size={22} /></div>
          <label><span>Full name</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} required /></label>
          <label><span>City / community</span><input value={city} onChange={(event) => setCity(event.target.value)} minLength={2} required /></label>
          <button className="mvp-button primary" disabled={busy}><Save size={17} /> Save profile</button>
        </form>

        <form className="mvp-panel mvp-form" onSubmit={saveVehicle}>
          <div className="mvp-panel-title"><div><span>Vehicle setup</span><h3>Add primary vehicle</h3></div><CarFront size={22} /></div>
          <label><span>Registration number</span><input value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} placeholder="GJ 06 AB 1234" minLength={4} required /></label>
          <label><span>Make and model</span><input value={makeModel} onChange={(event) => setMakeModel(event.target.value)} placeholder="Example: Tata Nexon" minLength={2} required /></label>
          <label><span>Vehicle type</span><select value={vehicleType} onChange={(event) => setVehicleType(event.target.value as typeof vehicleType)}><option value="car">Car</option><option value="bike">Bike</option><option value="scooter">Scooter</option><option value="other">Other</option></select></label>
          <button className="mvp-button primary" disabled={busy}><CarFront size={17} /> Add vehicle</button>
          <small className="mvp-form-note">Verification is marked simulated until an official vehicle-data integration exists.</small>
        </form>
      </div>

      <section className="mvp-panel mvp-vehicles-panel">
        <div className="mvp-section-heading"><div><span>Registered vehicles</span><h2>{snapshot.vehicles.length} vehicle{snapshot.vehicles.length === 1 ? "" : "s"}</h2></div></div>
        <div className="mvp-vehicle-list">
          {snapshot.vehicles.map((vehicle) => (
            <div key={vehicle.id}>
              <CarFront size={22} />
              <div><strong>{vehicle.makeModel}</strong><span>{vehicle.registrationNumber} · {vehicle.vehicleType}</span></div>
              <span className="mvp-verification"><CheckCircle2 size={15} /> {vehicle.verificationStatus === "video_matched" ? "video matched" : vehicle.verificationStatus}</span>
              {vehicle.isPrimary && <b>Primary</b>}
            </div>
          ))}
        </div>
      </section>

      {snapshot.backendMode === "local-demo" && (
        <section className="mvp-panel mvp-reset-panel">
          <div><span>Local data controls</span><h3>Reset local data</h3><p>Clears local trips, claims and profile changes, then restores the starting local profile.</p></div>
          <button className="mvp-button secondary" onClick={resetDemo}><RotateCcw size={17} /> Reset local demo</button>
        </section>
      )}
    </>
  );
}
