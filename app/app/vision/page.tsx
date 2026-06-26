"use client";

import { VideoVerification } from "@/components/mvp/VideoVerification";
import { useMvp } from "@/components/mvp/MvpProvider";
import { LoadingState, PageHeader } from "@/components/mvp/UI";

export default function VisionPage() {
  const { ready } = useMvp();
  if (!ready) return <LoadingState />;
  return (
    <>
      <PageHeader
        eyebrow="Combined intelligence layer"
        title="Connect GPS results with real video evidence."
        description="The GPS engine measures the journey. The Python vision service verifies visible registration plates and links the evidence to the same trip—without inventing behaviour detections."
      />
      <VideoVerification />
    </>
  );
}
