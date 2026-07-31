import { useEffect, useState, useCallback, useRef } from "react";
import { Bell, X } from "lucide-react";

export interface BannerPayload {
  title: string;
  body: string;
  /** Optional icon tint colour */
  tint?: string;
}

/** Global event target so native.ts can dispatch banner events without React coupling. */
const bannerBus = new EventTarget();

/** Call from native.ts to show a banner. */
export function showBanner(payload: BannerPayload) {
  bannerBus.dispatchEvent(new CustomEvent("show", { detail: payload }));
}

/**
 * Animated in-app notification banner.
 * Mount once inside the app shell — it listens for `showBanner()` dispatches.
 */
export function InAppBanner() {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<BannerPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const payload = (e as CustomEvent<BannerPayload>).detail;
      setData(payload);
      setVisible(true);

      // Clear any existing timer
      if (timerRef.current) clearTimeout(timerRef.current);
      // Auto-dismiss after 4 seconds
      timerRef.current = setTimeout(() => {
        setVisible(false);
        timerRef.current = null;
      }, 4000);
    };

    bannerBus.addEventListener("show", handler);
    return () => {
      bannerBus.removeEventListener("show", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!data) return null;

  return (
    <div
      className="fixed inset-x-0 z-[100] flex justify-center pointer-events-none safe-top"
      style={{ top: 8 }}
    >
      <div
        onClick={dismiss}
        className="pointer-events-auto w-[92%] max-w-md cursor-pointer"
        style={{
          transform: visible ? "translateY(0)" : "translateY(-120%)",
          opacity: visible ? 1 : 0,
          transition: "transform 0.35s cubic-bezier(.4,0,.2,1), opacity 0.3s ease",
        }}
      >
        <div
          className="relative flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-2xl"
          style={{
            background: "rgba(15, 23, 42, 0.92)",
            borderColor: "rgba(99, 102, 241, 0.25)",
            backdropFilter: "blur(16px) saturate(1.4)",
            WebkitBackdropFilter: "blur(16px) saturate(1.4)",
          }}
        >
          {/* Icon */}
          <div
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${data.tint ?? "#6366f1"}22` }}
          >
            <Bell
              className="size-4"
              style={{ color: data.tint ?? "#818cf8" }}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div
              className="text-sm text-white truncate"
              style={{ fontWeight: 700 }}
            >
              {data.title}
            </div>
            <div
              className="text-xs mt-0.5 line-clamp-2"
              style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}
            >
              {data.body}
            </div>
          </div>

          {/* Dismiss button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              dismiss();
            }}
            className="mt-0.5 size-6 shrink-0 flex items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.08)" }}
            aria-label="Dismiss notification"
          >
            <X className="size-3" style={{ color: "rgba(255,255,255,0.5)" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
