const ICON_LINK =
  "w-10 h-10 rounded-pill bg-white/15 hover:bg-white/30 transition flex items-center justify-center text-ink-on-royal";

export default function Footer() {
  return (
    <footer className="bg-royal text-ink-on-royal">
      <div className="max-w-2xl mx-auto px-6 py-12 md:py-16">
        <p className="text-base md:text-lg leading-relaxed">
          Creemos firmemente que cuando uno se siente bien consigo mismo es capaz de
          perderle miedo a intentarlo y luchar por sus metas y qué mejor sintiéndote hermosa.
        </p>
        <div className="flex gap-3 mt-6">
          {/* Instagram */}
          <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={ICON_LINK}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
            </svg>
          </a>
          {/* TikTok */}
          <a href="https://www.tiktok.com/" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className={ICON_LINK}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 3h2.6c.3 1.9 1.6 3.4 3.4 3.9v2.6c-1.3 0-2.5-.35-3.6-1v6.2A5.6 5.6 0 1 1 11.6 10v2.7c-.3-.1-.6-.1-.9-.1a2.9 2.9 0 1 0 2.9 2.9V3z" />
            </svg>
          </a>
          {/* Email */}
          <a href="mailto:hola@corve.mx" aria-label="Correo" className={ICON_LINK}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m2 7 10 6 10-6" />
            </svg>
          </a>
        </div>
        <div className="mt-8 text-xs text-ink-on-royal/70">© CORVE · Muévete desde el amor</div>
      </div>
    </footer>
  );
}
