"use client";

import { TripRecorder } from "@/components/mvp/TripRecorder";
import { useMvp } from "@/components/mvp/MvpProvider";
import { LoadingState, PageHeader } from "@/components/mvp/UI";

export default function TripPage() {
  const { ready } = useMvp();
  if (!ready) return <LoadingState />;
  return (
    <>
      <PageHeader eyebrow="Trip intelligence" title="Start, record, score and reward one trip." description="Use guided simulation or record a live browser-GPS journey on a phone." />
      <TripRecorder />
    </>
  );
}
