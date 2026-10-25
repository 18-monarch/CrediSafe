import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, Compass, Globe, MapPin, ShieldCheck, Smartphone } from "lucide-react";

export const metadata: Metadata = {
  title: "CrediSafe for iPhone | Web Companion",
  description: "Use the CrediSafe web companion in Safari while our native iOS app is in development. Foreground GPS trips and transparent preview scoring.",
};

export default function IosCompanionPage() {
  return (
    <main className="min-h-screen bg-[#07131a] text-white">
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-8">
        <nav className="flex items-center justify-between border-b border-white/10 pb-7">
          <Link href="/" className="text-lg font-black tracking-tight">CrediSafe<span className="text-emerald-400">.</span></Link>
          <Link href="/download/android" className="text-sm text-slate-400 hover:text-white">Using Android? Download APK</Link>
        </nav>
        <section className="grid items-center gap-14 py-16 md:grid-cols-[1.1fr_.9fr] md:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold tracking-wide text-emerald-300">
              <Globe size={15}/> IPHONE · SAFARI WEB COMPANION
            </div>
            <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              CrediSafe for iPhone, <span className="text-emerald-400">right in your browser.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-slate-300">
              Our native iOS app is in development. You can already explore CrediSafe, record GPS journeys while Safari stays open, and review your web trip history.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/app/trip" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-400 px-6 font-bold text-[#092018] hover:bg-emerald-300">
                Open iPhone companion <ArrowRight size={17}/>
              </Link>
              <Link href="/app/dashboard" className="inline-flex min-h-12 items-center rounded-xl border border-white/20 px-6 font-semibold text-white hover:bg-white/10">
                View web dashboard
              </Link>
            </div>
          </div>
          <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-[#12382c] via-[#102e2f] to-[#152130] p-7 shadow-2xl">
            <div className="mb-7 flex items-center justify-between">
              <div className="flex items-center gap-3"><Smartphone className="text-emerald-400" size={28}/><strong>Web Journey</strong></div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">Foreground only</span>
            </div>
            <div className="space-y-4">
              {[
                {icon:MapPin,title:"Location",subtitle:"GPS while the page stays visible"},
                {icon:Compass,title:"Trip recording",subtitle:"Distance, duration and speed preview"},
                {icon:ShieldCheck,title:"Honest scoring",subtitle:"Web records are not Android Rules Engine v2 confirmations"},
              ].map((item)=>{
                const Icon=item.icon;
                return <div className="flex gap-4 rounded-xl border border-white/10 bg-black/15 p-4" key={item.title}>
                  <Icon className="mt-1 shrink-0 text-emerald-400" size={20}/>
                  <div><strong className="text-sm">{item.title}</strong><p className="mt-1 text-xs leading-6 text-slate-400">{item.subtitle}</p></div>
                </div>;
              })}
            </div>
          </div>
        </section>
        <section className="grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/[.04] p-7">
            <h2 className="text-xl font-bold">Add CrediSafe to your Home Screen</h2>
            <ol className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
              <li>1. Open this website in <strong className="text-white">Safari</strong> on your iPhone.</li>
              <li>2. Tap <strong className="text-white">Share</strong> and choose <strong className="text-white">Add to Home Screen</strong>.</li>
              <li>3. Open CrediSafe from its icon and allow location access when recording a trip.</li>
            </ol>
          </article>
          <article className="rounded-2xl border border-amber-400/30 bg-amber-400/[.05] p-7">
            <div className="flex items-center gap-2 text-amber-200"><CircleAlert size={21}/><h2 className="text-xl font-bold">Important limitations</h2></div>
            <p className="mt-5 text-sm leading-7 text-slate-300">Safari cannot promise continuous GPS recording while the phone is locked or the app is backgrounded. Keep the page visible during a web trip. Browser trips do not use the Android accelerometer-based driving rules or receive cloud-confirmed Android safety rewards.</p>
          </article>
        </section>
        <div className="mt-8 flex items-center gap-3 text-sm text-slate-400"><CheckCircle2 size={18} className="text-emerald-400"/> One website, two experiences: Android telemetry app and iPhone web companion.</div>
      </div>
    </main>
  );
}
