import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download CrediSafe Android Beta 3",
  description: "Download the official signed CrediSafe v2.7.0-beta.3 Android APK directly.",
};

const APK_URL =
  "https://github.com/18-monarch/CrediSafeAndroid/releases/download/v2.7.0-beta.3/CrediSafe-2.7.0-beta.3.apk";
const RELEASE_URL =
  "https://github.com/18-monarch/CrediSafeAndroid/releases/tag/v2.7.0-beta.3";
const VERIFIED_RUN =
  "https://github.com/18-monarch/CrediSafeAndroid/actions/runs/40104272704";

export default function AndroidDownloadPage() {
  return (
    <main className="min-h-screen bg-[#080d15] px-5 py-12 text-white sm:px-8 lg:py-20">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white">
          <span aria-hidden="true">←</span> Back to CrediSafe
        </a>

        <div className="mt-16 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold tracking-wide text-emerald-200">
          CrediSafe Android · Public beta
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
          Drive smarter with <span className="text-emerald-300">Beta 3.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
          CrediSafe v2.7.0-beta.3 improves session recovery, live telemetry
          reliability and offline trip synchronization.
        </p>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.05] p-6 sm:p-8" aria-labelledby="download-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="download-heading" className="text-xl font-semibold">Android app · v2.7.0-beta.3</h2>
            <span className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs text-emerald-200">
              Signed APK · versionCode 27
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Download the official signed Android APK directly. No ZIP, GitHub
            Actions login or extraction is required.
          </p>
          <a
            href={APK_URL}
            className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-400 px-6 py-3 text-center text-sm font-bold text-slate-950 transition hover:bg-emerald-300 sm:w-auto"
            aria-label="Download CrediSafe v2.7.0-beta.3 signed APK"
          >
            Download Beta 3 APK
          </a>
          <p className="mt-5 text-xs text-slate-400">
            Hosted on the official CrediSafe GitHub Releases page ·
            <a className="ml-1 underline underline-offset-4 hover:text-white" href={RELEASE_URL} target="_blank" rel="noopener noreferrer">
              Release details and checksums
            </a>
          </p>
        </section>

        <section className="mt-10 grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold">Already using Beta 2?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Install the new APK over your existing app. Do not uninstall
              Beta 2 or clear its storage; that could remove local journeys.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold">Verify the update</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Confirm login, Backend Connected, GPS and sensor samples,
              CLOUD LIVE and trip sync on your Android device.
            </p>
          </div>
        </section>

        <p className="mt-10 text-sm text-slate-400">
          Verified signed build:{" "}
          <a href={VERIFIED_RUN} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-white">
            GitHub Actions #40104272704
          </a>
          . Beta software is for testing and may contain bugs.
        </p>
      </div>
    </main>
  );
}
