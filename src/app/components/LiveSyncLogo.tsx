import React from "react";

export function LiveSyncLogoMark({ className = "size-8", color = "#0066FF" }: { className?: string; color?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer ring with top-right opening */}
      <path d="M 76 28 A 38 38 0 1 1 84 45" stroke={color} strokeWidth="7.5" strokeLinecap="round" fill="none" />
      
      {/* Inner orbit arc */}
      <path d="M 66 32 A 23 23 0 1 0 66 68" stroke={color} strokeWidth="2.8" strokeLinecap="round" fill="none" />
      
      {/* 3 orbit node dots */}
      <circle cx="66" cy="32" r="4.8" fill={color} />
      <circle cx="27" cy="50" r="4.8" fill={color} />
      <circle cx="66" cy="68" r="4.8" fill={color} />
      
      {/* Center core dot */}
      <circle cx="50" cy="50" r="10" fill={color} />
    </svg>
  );
}

export function LiveSyncFullLogo({ className = "h-8" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LiveSyncLogoMark className="size-8 shrink-0" color="#0066FF" />
      <div className="flex flex-col leading-none">
        <span className="font-display font-extrabold text-foreground tracking-tight" style={{ fontSize: 18 }}>
          live sync <span className="text-[#0066FF]" style={{ fontWeight: 900 }}>AI</span>
        </span>
      </div>
    </div>
  );
}
