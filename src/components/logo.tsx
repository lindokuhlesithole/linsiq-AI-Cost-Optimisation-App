export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 group cursor-default select-none ${className ?? ""}`}>
      {/* Icon */}
      <div className="relative h-9 w-9 shrink-0">
        {/* Ambient glow */}
        <div className="absolute inset-0 rounded-lg bg-brand-cyan blur-md opacity-10 group-hover:opacity-25 transition-opacity duration-500" />

        {/* Icon body */}
        <div className="relative h-full w-full rounded-xl bg-sidebar-accent border border-sidebar-border flex items-center justify-center overflow-hidden shadow-lg">
          {/* Subtle interior gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />

          {/* Dot pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--sidebar-foreground)) 1px, transparent 0)",
              backgroundSize: "6px 6px",
            }}
          />

          {/* Stylized L glyph */}
          <svg viewBox="0 0 24 24" className="h-5 w-5 relative z-10" fill="none" stroke="currentColor">
            <defs>
              <linearGradient id="linsiq-logo-grad" x1="7" y1="5" x2="17" y2="17" gradientUnits="userSpaceOnUse">
                <stop stopColor="hsl(var(--brand-cyan))" />
                <stop offset="1" stopColor="hsl(var(--brand-blue))" />
              </linearGradient>
            </defs>
            <path
              d="M7 5V17H17"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              stroke="url(#linsiq-logo-grad)"
              className="drop-shadow-[0_0_4px_hsl(var(--brand-cyan-glow))]"
            />
            <path
              d="M13 8L16 11L13 14"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-sidebar-muted"
            />
            <circle cx="7" cy="5" r="1" fill="currentColor" className="text-sidebar-foreground" />
            <circle cx="17" cy="17" r="1" fill="currentColor" className="text-sidebar-foreground" />
          </svg>
        </div>

        {/* Accent corner */}
        <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-brand-cyan scale-0 group-hover:scale-100 transition-transform duration-300 delay-100" />
      </div>

      {/* Wordmark */}
      <div className="flex flex-col leading-none">
        <span
          className="text-lg font-extrabold tracking-tighter text-brand-cyan"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          Lin
          <span className="bg-gradient-to-r from-brand-cyan to-brand-blue bg-clip-text text-transparent">siq</span>
        </span>
        {/* Animated underline */}
        <div className="relative h-0.5 w-full mt-0.5 rounded-full bg-sidebar-border overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-brand-cyan to-brand-blue rounded-full -translate-x-full group-hover:translate-x-[200%] transition-transform duration-700 ease-in-out" />
        </div>
      </div>
    </div>
  );
}
