export const metadata = {
  title: "Offline — CrediSafe",
  description: "CrediSafe offline fallback page."
};

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <section className="offline-card" aria-labelledby="offline-title">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/credisafe-logo.png" alt="CrediSafe" className="offline-logo" />
        <p className="offline-kicker">Offline mode</p>
        <h1 id="offline-title">CrediSafe is waiting for your connection.</h1>
        <p>
          Your dashboard, GPS trips and video verification need a secure network connection.
          Reconnect and continue from where you left off.
        </p>
        <a href="/app/dashboard" className="primary-button offline-action">
          Retry dashboard
        </a>
      </section>
    </main>
  );
}
