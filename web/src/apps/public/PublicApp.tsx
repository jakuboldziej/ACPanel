import { useEffect, useState } from "react";
import { getStatus, type PublicStatus, type SessionType } from "@/apps/public/api";

const SESSION_LABEL: Record<SessionType, string> = {
  booking: "Booking",
  practice: "Practice",
  qualify: "Qualifying",
  race: "Race",
};

function formatTimeLeft(seconds: number | null): string | null {
  if (seconds === null || seconds < 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min left` : `${m} min left`;
}

export function PublicApp() {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getStatus()
        .then((s) => {
          if (!alive) return;
          setStatus(s);
          setError(false);
          if (s.name) document.title = s.name;
        })
        .catch(() => alive && setError(true));
    void load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!status) return <div className="pub">{error ? <p className="muted">Server status is unavailable.</p> : null}</div>;

  const { track, session, players } = status;
  const timeLeft = formatTimeLeft(session?.timeLeftSeconds ?? null);

  return (
    <div className="pub">
      <header className="pub-hero card">
        <div className="pub-title">
          <span className={`dot ${status.online ? "on" : "off"}`} />
          <h1>{status.name ?? "Assetto Corsa Server"}</h1>
        </div>
        {(status.description || status.location) && (
          <p className="muted">{[status.description, status.location].filter(Boolean).join(" · ")}</p>
        )}
        <div className="pub-facts">
          <div>
            <div className="label">Status</div>
            <div className="value">{status.online ? "Online" : "Offline"}</div>
          </div>
          {status.online && (
            <div>
              <div className="label">Players</div>
              <div className="value">
                {players.count} / {players.max}
              </div>
            </div>
          )}
          {track && (
            <div>
              <div className="label">Track</div>
              <div className="value">{track.name}</div>
            </div>
          )}
          {session && (
            <div>
              <div className="label">Session</div>
              <div className="value">
                {SESSION_LABEL[session.type]}
                {timeLeft && <span className="muted"> · {timeLeft}</span>}
              </div>
            </div>
          )}
          {status.weather && (
            <div>
              <div className="label">Air / road</div>
              <div className="value">
                {status.weather.ambient}°C / {status.weather.road}°C
              </div>
            </div>
          )}
        </div>
        {status.joinUrl && (
          <div className="pub-join">
            <a className="button primary" href={status.joinUrl} target="_blank" rel="noreferrer">
              Join with Content Manager
            </a>
            {status.passwordProtected && <span className="muted">Password protected, ask the admin for the password.</span>}
          </div>
        )}
      </header>

      {status.online && (
        <section className="card pub-section">
          <h2>Online now</h2>
          {players.list.length === 0 ? (
            <p className="muted">Nobody is driving right now.</p>
          ) : (
            <ul className="pub-players">
              {players.list.map((p, i) => (
                <li key={`${p.name}-${i}`}>
                  <span className="name">{p.name}</span>
                  <span className="muted">{p.carName}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
