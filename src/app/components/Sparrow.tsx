import type { Mood } from "../lib/sparrow";

/**
 * Chiku the sparrow — LiveSync's mascot. Pure inline SVG with CSS animation: a few kilobytes, no image
 * files, no animation library, works offline. Moods change the pose; motion is switched off for people
 * who ask their phone to reduce it.
 */
export function Sparrow({ mood = "idle", size = 96, label = "Chiku the sparrow" }: { mood?: Mood; size?: number; label?: string }) {
  return (
    <span className={`ls-sparrow ls-sparrow--${mood}`} style={{ width: size, height: size, display: "inline-block" }} role="img" aria-label={`${label}, ${mood === "idle" ? "listening" : mood}`}>
      <style>{CSS}</style>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        {/* ground shadow */}
        <ellipse className="sp-shadow" cx="60" cy="108" rx="26" ry="4" fill="#0F172A" opacity="0.10" />
        <g className="sp-bird">
          {/* tail */}
          <path className="sp-tail" d="M28 70 L8 62 L12 74 L6 80 L30 82 Z" fill="#7A5230" />
          {/* legs */}
          <path d="M52 96 v10 M52 106 l-5 3 M52 106 l5 3 M68 96 v10 M68 106 l-5 3 M68 106 l5 3" stroke="#C2410C" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* body */}
          <ellipse cx="58" cy="72" rx="32" ry="27" fill="#A9794B" />
          {/* belly */}
          <ellipse cx="62" cy="80" rx="22" ry="17" fill="#F3E3CC" />
          {/* wing */}
          <g className="sp-wing">
            <path d="M36 62 C44 50, 70 54, 72 72 C62 86, 42 84, 36 62 Z" fill="#7A5230" />
            <path d="M44 66 C52 62, 62 64, 66 72 M42 73 C50 71, 58 73, 62 79" stroke="#5B3B20" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>
          {/* head */}
          <g className="sp-head">
            <circle cx="80" cy="46" r="20" fill="#A9794B" />
            {/* grey crown */}
            <path d="M62 40 C66 26, 92 24, 98 40 C88 34, 72 34, 62 40 Z" fill="#6B7280" />
            {/* cheek */}
            <ellipse cx="78" cy="52" rx="9" ry="7" fill="#F3E3CC" />
            {/* black bib */}
            <path d="M82 60 C88 60, 94 58, 96 54 C96 62, 90 68, 82 66 Z" fill="#1F2937" />
            {/* beak */}
            <path className="sp-beak" d="M98 44 L112 48 L98 53 Z" fill="#F59E0B" />
            {/* eye */}
            <g className="sp-eye">
              <circle cx="88" cy="43" r="4.2" fill="#111827" />
              <circle cx="89.4" cy="41.6" r="1.3" fill="#FFFFFF" />
            </g>
            {/* brow — only visible when concerned */}
            <path className="sp-brow" d="M82 36 L93 39" stroke="#1F2937" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        </g>
        {/* thinking dots */}
        <g className="sp-dots" fill="#64748B">
          <circle cx="100" cy="18" r="3" /><circle cx="110" cy="12" r="2.4" /><circle cx="117" cy="7" r="1.8" />
        </g>
      </svg>
    </span>
  );
}

const CSS = `
.ls-sparrow svg { overflow: visible; }
.ls-sparrow .sp-bird { transform-origin: 60px 100px; animation: sp-bob 3.2s ease-in-out infinite; }
.ls-sparrow .sp-head { transform-origin: 74px 60px; }
.ls-sparrow .sp-wing { transform-origin: 40px 62px; }
.ls-sparrow .sp-tail { transform-origin: 30px 76px; animation: sp-tail 3.2s ease-in-out infinite; }
.ls-sparrow .sp-eye { transform-origin: 88px 43px; animation: sp-blink 4.5s infinite; }
.ls-sparrow .sp-brow, .ls-sparrow .sp-dots { opacity: 0; }

.ls-sparrow--thinking .sp-head { animation: sp-tilt 1.6s ease-in-out infinite; }
.ls-sparrow--thinking .sp-dots { opacity: 1; }
.ls-sparrow--thinking .sp-dots circle { animation: sp-dot 1.2s ease-in-out infinite; }
.ls-sparrow--thinking .sp-dots circle:nth-child(2) { animation-delay: .2s; }
.ls-sparrow--thinking .sp-dots circle:nth-child(3) { animation-delay: .4s; }

.ls-sparrow--happy .sp-bird { animation: sp-hop .7s ease-in-out 3; }
.ls-sparrow--happy .sp-wing { animation: sp-flap .35s ease-in-out 6; }

.ls-sparrow--concerned .sp-bird { animation: sp-bob 4.5s ease-in-out infinite; }
.ls-sparrow--concerned .sp-head { transform: rotate(8deg); }
.ls-sparrow--concerned .sp-brow { opacity: 1; }

@keyframes sp-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
@keyframes sp-tail { 0%,100% { transform: rotate(0) } 50% { transform: rotate(-6deg) } }
@keyframes sp-blink { 0%,92%,100% { transform: scaleY(1) } 95% { transform: scaleY(.1) } }
@keyframes sp-tilt { 0%,100% { transform: rotate(-6deg) } 50% { transform: rotate(8deg) } }
@keyframes sp-dot { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
@keyframes sp-hop { 0%,100% { transform: translateY(0) } 40% { transform: translateY(-12px) } }
@keyframes sp-flap { 0%,100% { transform: rotate(0) } 50% { transform: rotate(-28deg) } }

@media (prefers-reduced-motion: reduce) {
  .ls-sparrow * { animation: none !important; }
}
`;
