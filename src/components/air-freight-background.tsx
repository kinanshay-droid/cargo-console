import { useEffect, useState } from "react";

// Animated air-freight backdrop for the login page: planes gliding along
// dotted flight routes between pulsing airport nodes, drifting clouds and a
// slowly turning radar ring. Purely decorative (aria-hidden, no pointer
// events) and sits behind the page content. Planes use SVG <animateMotion>,
// which scales with the viewBox; everything else is CSS keyframes defined
// inline below. Respects prefers-reduced-motion by rendering a static
// version (routes + nodes, no movement).

type Route = {
  id: string;
  d: string;
  dur: number;
  begin: number;
  scale: number;
};

// viewBox is 1600x900; paths are deliberately long and arcing so a plane is
// on screen for a good while, and they cross behind the three main panels.
const ROUTES: Route[] = [
  { id: "r1", d: "M -80 640 C 300 80, 900 80, 1680 260", dur: 34, begin: 0, scale: 1.15 },
  { id: "r2", d: "M 1680 760 C 1200 960, 600 520, -80 360", dur: 42, begin: -14, scale: 1 },
  { id: "r3", d: "M 120 940 C 520 520, 1040 640, 1560 -40", dur: 38, begin: -22, scale: 0.9 },
  { id: "r4", d: "M -80 180 C 420 380, 980 -40, 1680 480", dur: 48, begin: -30, scale: 0.8 },
];

// Airport "hubs" — pulsing nodes along/near the routes.
const NODES: { x: number; y: number; delay: number }[] = [
  { x: 150, y: 540, delay: 0 },
  { x: 560, y: 205, delay: 0.8 },
  { x: 1180, y: 190, delay: 1.6 },
  { x: 1480, y: 640, delay: 2.4 },
  { x: 760, y: 700, delay: 3.2 },
  { x: 1380, y: 90, delay: 4 },
];

const PLANE_PATH =
  "M10 0 L2 -1.5 L-2 -9 L-4 -9 L-2 -1.5 L-8 -1.2 L-9 -4 L-10.5 -4 L-9.5 0 L-10.5 4 L-9 4 L-8 1.2 L-2 1.5 L-4 9 L-2 9 L2 1.5 Z";

const CSS = `
@keyframes afb-dash { to { stroke-dashoffset: -120; } }
@keyframes afb-pulse { 0% { transform: scale(0.6); opacity: 0.7; } 100% { transform: scale(3); opacity: 0; } }
@keyframes afb-drift { from { transform: translateX(-30vw); } to { transform: translateX(130vw); } }
@keyframes afb-spin { to { transform: rotate(360deg); } }
@keyframes afb-pan { to { background-position: 180px 90px; } }
@keyframes afb-sweep { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
.afb-route { stroke-dasharray: 2 10; animation: afb-dash 9s linear infinite; }
.afb-node-pulse { transform-box: fill-box; transform-origin: center; animation: afb-pulse 3.2s ease-out infinite; }
.afb-cloud { position: absolute; border-radius: 9999px; background: rgba(255,255,255,0.07); filter: blur(28px); animation: afb-drift linear infinite; }
.afb-ring { position: absolute; border-radius: 9999px; border: 1px dashed rgba(255,255,255,0.16); animation: afb-spin linear infinite; }
.afb-grid { position: absolute; inset: 0; opacity: 0.12; background-image: radial-gradient(rgba(255,255,255,0.9) 1.2px, transparent 1.2px); background-size: 36px 36px; animation: afb-pan 60s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .afb-route, .afb-node-pulse, .afb-cloud, .afb-ring, .afb-grid { animation: none !important; }
}
`;

const CLOUDS: { top: string; w: number; h: number; dur: number; delay: number; op: number }[] = [
  { top: "8%", w: 520, h: 120, dur: 95, delay: -10, op: 1 },
  { top: "34%", w: 420, h: 100, dur: 130, delay: -70, op: 0.7 },
  { top: "62%", w: 600, h: 140, dur: 110, delay: -40, op: 0.85 },
  { top: "84%", w: 460, h: 110, dur: 150, delay: -100, op: 0.6 },
];

export function AirFreightBackground() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{CSS}</style>

      <div className="afb-grid" />

      {/* Slowly turning radar / globe rings, bottom corner */}
      <div
        className="afb-ring"
        style={{ width: 760, height: 760, right: -260, bottom: -300, animationDuration: "120s" }}
      />
      <div
        className="afb-ring"
        style={{
          width: 520,
          height: 520,
          right: -140,
          bottom: -180,
          animationDuration: "80s",
          animationDirection: "reverse",
          borderStyle: "dotted",
        }}
      />

      {/* Drifting clouds */}
      {CLOUDS.map((c, i) => (
        <div
          key={i}
          className="afb-cloud"
          style={{
            top: c.top,
            width: c.w,
            height: c.h,
            opacity: c.op,
            animationDuration: `${c.dur}s`,
            animationDelay: `${c.delay}s`,
          }}
        />
      ))}

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="afb-node" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Flight routes */}
        {ROUTES.map((r) => (
          <path
            key={r.id}
            id={`afb-${r.id}`}
            d={r.d}
            fill="none"
            stroke="white"
            strokeOpacity="0.22"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="afb-route"
          />
        ))}

        {/* Airport nodes */}
        {NODES.map((n, i) => (
          <g key={i} transform={`translate(${n.x} ${n.y})`}>
            <circle
              r="9"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.5"
              className="afb-node-pulse"
              style={{ animationDelay: `${n.delay}s` }}
            />
            <circle r="3.5" fill="var(--accent)" />
          </g>
        ))}

        {/* Planes, each following its route */}
        {!reduced &&
          ROUTES.map((r) => (
            <g key={`plane-${r.id}`} opacity="0.9">
              <path d={PLANE_PATH} fill="white" transform={`scale(${r.scale * 1.4})`} />
              <animateMotion
                dur={`${r.dur}s`}
                begin={`${r.begin}s`}
                repeatCount="indefinite"
                rotate="auto"
              >
                <mpath href={`#afb-${r.id}`} />
              </animateMotion>
            </g>
          ))}
      </svg>
    </div>
  );
}
