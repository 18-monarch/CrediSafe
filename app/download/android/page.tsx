import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Download CrediSafe Android Beta 3",
  description: "Get CrediSafe v2.7.0-beta.3 for Android, with secure signing and install guidance.",
};

const RELEASE_API =
  "https://api.github.com/repos/18-monarch/CrediSafeAndroid/releases/tags/v2.7.0-beta.3";
const APK_NAME = "CrediSafe-2.7.0-beta.3.apk";
const TEST_BUILD =
  "https://github.com/18-monarch/CrediSafeAndroid/actions/runs/40104272704/artifacts/12564396375";
const VERIFIED_RUN =
  "https://github.com/18-monarch/CrediSafeAndroid/actions/runs/40104272704";

type ReleaseResponse = {
  draft?: boolean;
  assets?: { name?: string; browser_download_url?: string }[];
};

async function publishedApk(): Promise<string | null> {
  try {
    const response = await fetch(RELEASE_API, {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;

    const release = (await response.json()) as ReleaseResponse;
    if (release.draft) return null;
    const asset = release.assets?.find((item) => item.name === APK_NAME);
    const url = asset?.browser_download_url;
    // Only redirect visitors to the expected asset in our official repository.
    return url?.startsWith(
      "https://github.com/18-monarch/CrediSafeAndroid/releases/download/v2.7.0-beta.3/"
    )
      ? url
      : null;
  } catch {
    // GitHub API can be rate-limited or temporarily unavailable.
    // Keep the verified beta.3 Actions artifact accessible as a fallback.
    return null;
  }
}

export default async function AndroidDownloadPage() {
  const publicApk = await publishedApk();
  const actionUrl = publicApk ?? TEST_BUILD;

  return (
    <main className="min-h-screen bg-[#080d15] px-5 py-12 text-white sm:px-8 lg:py-20">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white">
          <span aria-hidden="true">←</span> Back to CrediSafe
        </a>

        <div className="mt-16 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold tracking-wide text-emerald-200">
          CrediSafe Android · Beta release
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
          Drive smarter with <span className="text-emerald-300">Beta 3.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
          CrediSafe v2.7.0-beta.3 brings improved session recovery, more
          reliable live telemetry and safer trip synchronization.
        </p>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.05] p-6 sm:p-8" aria-labelledby="download-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="download-heading" className="text-xl font-semibold">Android app · v2.7.0-beta.3</h2>
            <span className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs text-emerald-200">
              Signed · Build passed
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {publicApk
              ? "The APK is published on GitHub Releases and available for direct download."
              : "The signed APK is available now as a verified GitHub Actions testing artifact. GitHub sign-in may be required, and the artifact is temporary until the public prerelease is published."}
          </p>
          <a
            href={actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-400 px-6 py-3 text-center text-sm font-bold text-slate-950 transition hover:bg-emerald-300 sm:w-auto"
          >
            {publicApk ? "Download Beta 3 APK" : "Get Beta 3 test APK on GitHub ↗"}
          </a>
          {!publicApk && (
            <p className="mt-3 text-xs leading-5 text-slate-400">
              On GitHub, sign in if prompted, then download the
              CrediSafe-2.7.0-beta.3 artifact ZIP and extract the APK.
              Public one-click downloads will become available here automatically
              when the matching GitHub prerelease is published.
            </p>
          )}
          <p className="mt-5 text-xs text-slate-400">
            Android versionCode 27 · Signed with the existing CrediSafe beta certificate
          </p>
        </section>

        <section className="mt-10 grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold">Already using Beta 2?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Install the new APK over your existing app. Do not uninstall
              the old version or clear storage; that could remove local journeys.
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
          Source and verified build:{" "}
          <a href={VERIFIED_RUN} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-white">
            GitHub Actions run #40104272704
          </a>
          . Beta software may contain bugs; use it for testing.
        </p>
      </div>
    </main>
  );
}
