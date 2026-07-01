import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { getAlbumsWithVersions } from "./lib/albums";
import { getOwnedVersionIds, setOwned } from "./lib/collection";

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CompletionRing({ pct }) {
  const radius = 19;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="ring">
      <circle cx="24" cy="24" r={radius} className="ring-track" />
      <circle
        cx="24"
        cy="24"
        r={radius}
        className="ring-progress"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
      <text x="24" y="28" textAnchor="middle" className="ring-label">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

function AlbumCard({ album, isOpen, onToggleOpen, onToggleVersion, canEdit }) {
  const total = album.versions.length;
  const ownedCount = album.versions.filter((v) => v.owned).length;
  const pct = total === 0 ? 0 : (ownedCount / total) * 100;

  return (
    <div className={`card ${isOpen ? "card-open" : ""}`}>
      <button className="card-head" onClick={() => onToggleOpen(album.id)} aria-expanded={isOpen}>
        <CompletionRing pct={pct} />
        <div className="card-head-text">
          <span className="card-era">{album.era}</span>
          <h3 className="card-title">{album.title}</h3>
          <span className="card-count">
            {ownedCount} / {total} versiones
          </span>
        </div>
        <span className="card-chevron">
          <ChevronIcon open={isOpen} />
        </span>
      </button>

      {isOpen && (
        <div className="versions">
          {total === 0 && (
            <p className="versions-empty">Todavía no hay versiones cargadas para este álbum.</p>
          )}
          {album.versions.map((v) => (
            <div key={v.id} className="version-row">
              <span className="version-name">{v.name}</span>
              <button
                className={`pill ${v.owned ? "pill-owned" : "pill-missing"}`}
                onClick={() => onToggleVersion(album.id, v.id, v.owned)}
                title={canEdit ? undefined : "Iniciá sesión para marcar tu colección"}
              >
                {v.owned ? (
                  <>
                    <CheckIcon /> Tengo
                  </>
                ) : (
                  "Me falta"
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();

  const [rawAlbums, setRawAlbums] = useState([]);
  const [ownedIds, setOwnedIds] = useState(new Set());
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [albumsError, setAlbumsError] = useState(null);
  const [toggleError, setToggleError] = useState(null);

  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);

  // Catálogo público: álbumes y versiones, no depende del login
  useEffect(() => {
    let cancelled = false;
    setAlbumsLoading(true);
    getAlbumsWithVersions()
      .then((data) => {
        if (!cancelled) setRawAlbums(data);
      })
      .catch((err) => {
        if (!cancelled) setAlbumsError(err.message);
      })
      .finally(() => {
        if (!cancelled) setAlbumsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Colección personal: depende de quién está logueado
  useEffect(() => {
    if (!user) {
      setOwnedIds(new Set());
      return;
    }
    let cancelled = false;
    getOwnedVersionIds(user.id)
      .then((ids) => {
        if (!cancelled) setOwnedIds(ids);
      })
      .catch((err) => {
        if (!cancelled) setToggleError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const albums = useMemo(
    () =>
      rawAlbums.map((album) => ({
        ...album,
        versions: album.versions.map((v) => ({ ...v, owned: ownedIds.has(v.id) })),
      })),
    [rawAlbums, ownedIds]
  );

  const handleToggleVersion = async (albumId, versionId, currentlyOwned) => {
    if (!user) {
      signInWithGoogle();
      return;
    }
    setToggleError(null);

    // actualización optimista
    setOwnedIds((prev) => {
      const next = new Set(prev);
      currentlyOwned ? next.delete(versionId) : next.add(versionId);
      return next;
    });

    try {
      await setOwned(user.id, versionId, !currentlyOwned);
    } catch (err) {
      // revertir si falla el guardado
      setOwnedIds((prev) => {
        const next = new Set(prev);
        currentlyOwned ? next.add(versionId) : next.delete(versionId);
        return next;
      });
      setToggleError("No pudimos guardar ese cambio. Probá de nuevo.");
    }
  };

  const toggleOpen = (albumId) => setOpenId((prev) => (prev === albumId ? null : albumId));

  const query = search.trim().toLowerCase();
  const filtered = albums.filter(
    (a) => a.title.toLowerCase().includes(query) || String(a.era).includes(query)
  );

  const totalOwned = albums.reduce((sum, a) => sum + a.versions.filter((v) => v.owned).length, 0);
  const totalVersions = albums.reduce((sum, a) => sum + a.versions.length, 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;900&family=Inter:wght@400;500;600&display=swap');

        :root {
          --bg: #0a0818;
          --glow-1: #2d1b69;
          --glow-2: #6e2350;
          --surface: rgba(255,255,255,0.04);
          --surface-hover: rgba(255,255,255,0.07);
          --border-soft: rgba(255,255,255,0.09);
          --text: #f3f0ff;
          --text-dim: #a39bc9;
          --accent: #9b6bff;
          --accent-2: #ff5fa8;
          --success: #3ddc97;
          --success-dim: rgba(61,220,151,0.14);
          --missing: #2d2750;
          --danger: #ff6b6b;
          --danger-dim: rgba(255,107,107,0.12);
        }

        * { box-sizing: border-box; }

        .app {
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', sans-serif;
          position: relative;
          overflow-x: hidden;
          padding: 2rem 1.5rem 5rem;
        }

        .bg-glow {
          position: fixed;
          inset: 0;
          background:
            radial-gradient(circle at 15% 10%, var(--glow-1) 0%, transparent 45%),
            radial-gradient(circle at 85% 25%, var(--glow-2) 0%, transparent 40%);
          opacity: 0.55;
          pointer-events: none;
          z-index: 0;
        }

        .topbar {
          position: relative;
          z-index: 1;
          max-width: 920px;
          margin: 0 auto 1.5rem;
          display: flex;
          justify-content: flex-end;
        }

        .auth-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 999px;
          border: 1px solid var(--border-soft);
          background: var(--surface);
          color: var(--text);
          font-size: 0.85rem;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
        }

        .auth-btn:hover { background: var(--surface-hover); }
        .auth-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

        .avatar {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
        }

        .hero {
          position: relative;
          z-index: 1;
          max-width: 720px;
          margin: 0 auto 2.5rem;
          text-align: center;
        }

        .eyebrow {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--accent-2);
          margin-bottom: 1rem;
        }

        .title {
          font-family: 'Unbounded', sans-serif;
          font-weight: 900;
          font-size: clamp(2rem, 6vw, 3.4rem);
          line-height: 1.05;
          margin: 0 0 0.75rem;
          letter-spacing: -0.01em;
        }

        .title .x-mark {
          display: inline-block;
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          transform: rotate(-6deg) scale(1.15);
          margin: 0 0.05em;
        }

        .subtitle { font-size: 0.98rem; color: var(--text-dim); margin: 0; }

        .search-wrap {
          position: relative;
          z-index: 1;
          max-width: 480px;
          margin: 0 auto 1.25rem;
        }

        .search-wrap svg {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-dim);
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: 0.85rem 1rem 0.85rem 2.7rem;
          border-radius: 999px;
          border: 1px solid var(--border-soft);
          background: var(--surface);
          color: var(--text);
          font-size: 0.95rem;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.2s ease, background 0.2s ease;
        }

        .search-input::placeholder { color: var(--text-dim); }
        .search-input:focus-visible { border-color: var(--accent); background: var(--surface-hover); }

        .stats-line {
          position: relative;
          z-index: 1;
          text-align: center;
          font-size: 0.82rem;
          color: var(--text-dim);
          margin-bottom: 1rem;
        }

        .stats-line strong { color: var(--text); font-weight: 600; }

        .hint-line {
          position: relative;
          z-index: 1;
          text-align: center;
          font-size: 0.8rem;
          color: var(--text-dim);
          margin-bottom: 2rem;
        }

        .banner {
          position: relative;
          z-index: 1;
          max-width: 560px;
          margin: 0 auto 1.5rem;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          font-size: 0.85rem;
          text-align: center;
        }

        .banner-error { background: var(--danger-dim); color: var(--danger); border: 1px solid rgba(255,107,107,0.3); }

        .grid {
          position: relative;
          z-index: 1;
          max-width: 920px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
          gap: 1rem;
        }

        .card {
          background: var(--surface);
          border: 1px solid var(--border-soft);
          border-radius: 18px;
          overflow: hidden;
          transition: border-color 0.2s ease, background 0.2s ease;
        }

        .card-open { border-color: rgba(155,107,255,0.45); background: var(--surface-hover); }

        .card-head {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.9rem;
          padding: 1rem 1.1rem;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          color: var(--text);
          font-family: inherit;
        }

        .card-head:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

        .card-head-text { flex: 1; min-width: 0; }

        .card-era {
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: var(--accent-2);
          text-transform: uppercase;
        }

        .card-title {
          font-family: 'Unbounded', sans-serif;
          font-size: 1rem;
          font-weight: 700;
          margin: 0.2rem 0 0.25rem;
          line-height: 1.25;
        }

        .card-count { font-size: 0.78rem; color: var(--text-dim); }
        .card-chevron { color: var(--text-dim); flex-shrink: 0; }

        .ring { flex-shrink: 0; }
        .ring-track { fill: none; stroke: rgba(255,255,255,0.1); stroke-width: 4; }
        .ring-progress {
          fill: none;
          stroke: var(--success);
          stroke-width: 4;
          stroke-linecap: round;
          transform: rotate(-90deg);
          transform-origin: 50% 50%;
          transition: stroke-dashoffset 0.4s ease;
        }
        .ring-label { font-size: 10px; font-weight: 600; fill: var(--text); }

        .versions {
          padding: 0 1.1rem 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          border-top: 1px solid var(--border-soft);
          padding-top: 0.85rem;
        }

        .versions-empty { font-size: 0.82rem; color: var(--text-dim); margin: 0; }

        .version-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
        .version-name { font-size: 0.88rem; color: var(--text); }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.4rem 0.85rem;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          border: 1px solid transparent;
          transition: transform 0.15s ease, background 0.15s ease;
          flex-shrink: 0;
        }

        .pill:active { transform: scale(0.96); }
        .pill-owned { background: var(--success-dim); color: var(--success); border-color: rgba(61,220,151,0.35); }
        .pill-missing { background: transparent; color: var(--text-dim); border-color: var(--missing); }
        .pill-missing:hover { background: rgba(255,255,255,0.04); }
        .pill:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

        .empty {
          position: relative;
          z-index: 1;
          text-align: center;
          color: var(--text-dim);
          font-size: 0.9rem;
          margin-top: 2rem;
        }

        .skeleton-grid {
          position: relative;
          z-index: 1;
          max-width: 920px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
          gap: 1rem;
        }

        .skeleton-card {
          height: 84px;
          border-radius: 18px;
          background: var(--surface);
          border: 1px solid var(--border-soft);
          animation: pulse 1.4s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ring-progress, .pill, .card, .card-chevron svg, .skeleton-card { transition: none !important; animation: none !important; }
        }
      `}</style>

      <div className="app">
        <div className="bg-glow" aria-hidden="true" />

        <div className="topbar">
          {authLoading ? null : user ? (
            <button className="auth-btn" onClick={signOut}>
              <span className="avatar" aria-hidden="true" />
              {user.user_metadata?.name ?? user.email}
            </button>
          ) : (
            <button className="auth-btn" onClick={signInWithGoogle}>
              Iniciar sesión con Google
            </button>
          )}
        </div>

        <header className="hero">
          <span className="eyebrow">Archivo físico · MOA Collection</span>
          <h1 className="title">
            TOMORROW <span className="x-mark">X</span> TOGETHER
          </h1>
          <p className="subtitle">Tracker de versiones físicas — minisodes, chapters y todo lo demás.</p>
        </header>

        <div className="search-wrap">
          <SearchIcon />
          <input
            className="search-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar álbum o era..."
            aria-label="Buscar álbum"
          />
        </div>

        {!authLoading && !user && (
          <p className="hint-line">Iniciá sesión con Google para guardar tu colección.</p>
        )}

        {user && (
          <p className="stats-line">
            Tenés <strong>{totalOwned}</strong> de <strong>{totalVersions}</strong> versiones en total
          </p>
        )}

        {toggleError && <div className="banner banner-error">{toggleError}</div>}
        {albumsError && (
          <div className="banner banner-error">No pudimos cargar el catálogo: {albumsError}</div>
        )}

        {albumsLoading ? (
          <div className="skeleton-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-card" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid">
              {filtered.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  isOpen={openId === album.id}
                  onToggleOpen={toggleOpen}
                  onToggleVersion={handleToggleVersion}
                  canEdit={Boolean(user)}
                />
              ))}
            </div>

            {filtered.length === 0 && albums.length > 0 && (
              <p className="empty">No encontramos ese álbum en el archivo.</p>
            )}

            {albums.length === 0 && (
              <p className="empty">
                Todavía no hay álbumes cargados en Supabase. Corré el script de seed
                (<code>node scripts/seed-discogs.mjs</code>) para importar la discografía desde Discogs.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}