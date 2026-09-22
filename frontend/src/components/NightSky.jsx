import React, { useMemo } from "react";

// 매번 같은 하늘이 나오도록 고정 시드 난수
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function layer(n, seed, tint) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = (r() * 100).toFixed(2);
    const y = (r() * 100).toFixed(2);
    const c = tint[Math.floor(r() * tint.length)];
    out.push(`${x}vw ${y}vh 0 0 ${c}`);
  }
  return out.join(",");
}

/** 화면 뒤에 고정된 밤하늘. 별은 box-shadow 로만 그려서 가볍다. */
export default function NightSky() {
  const shadows = useMemo(
    () => ({
      s1: layer(150, 7, ["#ffffff", "#dfe6ff", "#c9d3ff"]),
      s2: layer(45, 29, ["#ffffff", "#e8ecff", "#ffeccc"]),
      s3: layer(12, 101, ["#ffffff", "#dfe6ff"]),
    }),
    []
  );
  return (
    <div className="sky" aria-hidden="true">
      <span className="stars s1" style={{ boxShadow: shadows.s1 }} />
      <span className="stars s2" style={{ boxShadow: shadows.s2 }} />
      <span className="stars s3" style={{ boxShadow: shadows.s3 }} />
    </div>
  );
}
