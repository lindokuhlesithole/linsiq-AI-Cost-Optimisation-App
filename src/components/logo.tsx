export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 group cursor-default select-none ${className ?? ""}`}>
      {/* Icon */}
      <div className="relative h-9 w-9 shrink-0">
        {/* Ambient glow */}
        <div className="absolute inset-0 rounded-lg bg-emerald-400 blur-md opacity-10 group-hover:opacity-25 transition-opacity duration-500" />

        {/* Icon body */}
        <div className="relative h-full w-full rounded-xl bg-sidebar-accent border border-sidebar-border flex items-center justify-center overflow-hidden shadow-lg">
          {/* Subtle interior gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />

          {/* Speedometer / Gauge icon */}
          <svg viewBox="0 0 24 24" className="h-5 w-5 relative z-10" fill="none" stroke="currentColor">
            <defs>
              <linearGradient id="throttle-logo-grad" x1="2" y1="12" x2="22" y2="12" gradientUnits="userSpaceOnUse">
                <stop stopColor="hsl(var(--brand-cyan))" />
                <stop offset="1" stopColor="hsl(var(--brand-blue))" />
              </linearGradient>
            </defs>
            {/* Gauge arc */}
            <path
              d="M4 16C4 10.477 8.477 6 14 6C16.5 6 18.8 7 20.5 8.7"
              stroke="url(#throttle-logo-grad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            {/* Needle */}
            <line
              x1="14" y1="16" x2="10" y2="10"
              stroke="hsl(var(--brand-cyan))"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Center dot */}
            <circle cx="14" cy="16" r="2" fill="hsl(var(--brand-cyan))" />
            {/* Tick marks */}
            <line x1="5" y1="12" x2="6.5" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
            <line x1="14" y1="4" x2="14" y2="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
            <line x1="20" y1="7" x2="19" y2="8.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          </svg>
        </div>

        {/* Accent corner */}
        <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-emerald-400 scale-0 group-hover:scale-100 transition-transform duration-300 delay-100" />
      </div>

      {/* Wordmark */}
      <div className="flex flex-col leading-none">
        <span
          className="text-lg font-extrabold tracking-tighter text-emerald-400"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          Thro<span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">ttle</span>
        </span>
        {/* Animated underline */}
        <div className="relative h-0.5 w-full mt-0.5 rounded-full bg-sidebar-border overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full -translate-x-full group-hover:translate-x-[200%] transition-transform duration-700 ease-in-out" />
        </div>
      </div>
    </div>
  );
}
