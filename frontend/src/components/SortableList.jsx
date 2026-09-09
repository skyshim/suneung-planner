import React, { useRef, useState } from "react";

/**
 * 손가락/마우스로 항목 순서를 바꾸는 리스트.
 * 포인터 이벤트를 쓰기 때문에 터치와 마우스가 같은 코드로 동작한다.
 * 끌고 있는 행만 따라 움직이고, 놓일 자리는 가로선으로 표시한다.
 */
export default function SortableList({ items, getId, onReorder, renderItem, gap = 8 }) {
  const wrapRef = useRef(null);
  const rowRefs = useRef([]);
  const rectsRef = useRef([]);
  const [drag, setDrag] = useState(null); // {from, target, dy, startY}

  const start = (index) => (e) => {
    if (items.length < 2) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    rectsRef.current = rowRefs.current
      .slice(0, items.length)
      .map((el) => (el ? el.getBoundingClientRect() : null));
    setDrag({ from: index, target: index, dy: 0, startY: e.clientY });
  };

  const move = (e) => {
    setDrag((d) => {
      if (!d) return d;
      const rects = rectsRef.current;
      if (!rects[d.from]) return d;
      const centers = rects.map((r) => (r ? r.top + r.height / 2 : 0));
      const dy = e.clientY - d.startY;
      const y = centers[d.from] + dy;
      let target = d.from;
      if (dy > 0) while (target < items.length - 1 && y > centers[target + 1]) target++;
      else while (target > 0 && y < centers[target - 1]) target--;
      return { ...d, dy, target };
    });
  };

  const end = () => {
    setDrag((d) => {
      if (d && d.target !== d.from) {
        const ids = items.map(getId);
        const [moved] = ids.splice(d.from, 1);
        ids.splice(d.target, 0, moved);
        onReorder(ids);
      }
      return null;
    });
  };

  const handleProps = (index) => ({
    onPointerDown: start(index),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
    style: { touchAction: "none", cursor: drag ? "grabbing" : "grab" },
  });

  const line = (
    <div
      key="drop-line"
      aria-hidden="true"
      style={{ height: 3, borderRadius: 2, background: "var(--accent)", margin: `${-gap / 2}px 0` }}
    />
  );

  const out = [];
  items.forEach((item, i) => {
    const isDragging = drag?.from === i;
    const showBefore = drag && drag.target === i && drag.target < drag.from;
    const showAfter = drag && drag.target === i && drag.target > drag.from;
    if (showBefore) out.push(line);
    out.push(
      <div
        key={getId(item)}
        ref={(el) => (rowRefs.current[i] = el)}
        style={
          isDragging
            ? {
                transform: `translateY(${drag.dy}px)`,
                zIndex: 40,
                position: "relative",
                boxShadow: "0 8px 24px rgba(0,0,0,.28)",
                borderRadius: 14,
                touchAction: "none",
              }
            : undefined
        }
      >
        {renderItem(item, { handleProps: handleProps(i), dragging: isDragging })}
      </div>
    );
    if (showAfter) out.push(line);
  });

  return (
    <div
      ref={wrapRef}
      className="flex flex-col"
      style={{ gap, userSelect: drag ? "none" : undefined }}
    >
      {out}
    </div>
  );
}

/** 왼쪽에 붙는 손잡이 아이콘 */
export function Grip({ handleProps }) {
  return (
    <button
      type="button"
      aria-label="끌어서 순서 바꾸기"
      className="shrink-0 flex items-center justify-center rounded-md"
      style={{ width: 26, height: 30, color: "var(--text-muted)", ...handleProps.style }}
      onPointerDown={handleProps.onPointerDown}
      onPointerMove={handleProps.onPointerMove}
      onPointerUp={handleProps.onPointerUp}
      onPointerCancel={handleProps.onPointerCancel}
      onClick={(e) => e.preventDefault()}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 7h.01M8 12h.01M8 17h.01M16 7h.01M16 12h.01M16 17h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}
