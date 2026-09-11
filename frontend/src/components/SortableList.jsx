import React, { useCallback, useRef, useState } from "react";

/**
 * 손가락/마우스로 항목 순서를 바꾸는 리스트.
 *
 * 터치에서 안정적으로 동작시키기 위한 두 가지 원칙:
 *  1) 드래그 중에는 DOM 구조를 절대 바꾸지 않는다. 놓일 자리는 요소를 끼워 넣는 대신
 *     대상 행의 inset box-shadow 로 그린다. (노드를 넣고 빼면 브라우저가 pointercancel 을
 *     쏘면서 드래그가 중간에 끊긴다)
 *  2) pointerup 은 '놓았다', pointercancel 은 '취소됐다'로 서로 다르게 처리한다.
 *     예전에는 둘 다 커밋해서, 중간에 취소가 나면 엉뚱한 순서로 저장됐다.
 */
export default function SortableList({ items, getId, onReorder, renderItem, gap = 8 }) {
  const rowRefs = useRef([]);
  const rectsRef = useRef([]);
  const committingRef = useRef(false);
  const [drag, setDrag] = useState(null); // {from, target, dy, startY}

  const start = (index) => (e) => {
    if (items.length < 2) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* 캡처를 못 잡아도 일반 이벤트로 동작한다 */
    }
    rectsRef.current = rowRefs.current
      .slice(0, items.length)
      .map((el) => (el ? el.getBoundingClientRect() : null));
    committingRef.current = false;
    setDrag({ from: index, target: index, dy: 0, startY: e.clientY });
  };

  const move = useCallback(
    (e) => {
      setDrag((d) => {
        if (!d) return d;
        const rects = rectsRef.current;
        const self = rects[d.from];
        if (!self) return d;
        const dy = e.clientY - d.startY;

        // 끄는 항목의 '중심'이 아니라 진행 방향 쪽 '변'을 기준으로 판정한다.
        // 중심끼리 비교하면 마지막 한 칸을 넘지 못해 맨 위/맨 아래로 보낼 수 없다.
        const top = self.top + dy;
        const bottom = self.bottom + dy;
        const centerOf = (i) => {
          const r = rects[i];
          return r ? r.top + r.height / 2 : null;
        };

        let target = d.from;
        if (dy < 0) {
          while (target > 0) {
            const c = centerOf(target - 1);
            if (c === null || top > c) break;
            target--;
          }
        } else if (dy > 0) {
          while (target < items.length - 1) {
            const c = centerOf(target + 1);
            if (c === null || bottom < c) break;
            target++;
          }
        }
        return dy === d.dy && target === d.target ? d : { ...d, dy, target };
      });
    },
    [items.length]
  );

  // 손을 뗐을 때만 저장한다.
  const finish = (e) => {
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* noop */
    }
    const d = drag;
    setDrag(null);
    if (!d || d.target === d.from || committingRef.current) return;
    committingRef.current = true;
    const ids = items.map(getId);
    const [moved] = ids.splice(d.from, 1);
    ids.splice(d.target, 0, moved);
    onReorder(ids);
  };

  // 브라우저가 드래그를 취소한 경우(스크롤 전환, 전화 수신 등)는 저장하지 않는다.
  const cancel = () => setDrag(null);

  const handleProps = (index) => ({
    onPointerDown: start(index),
    onPointerMove: move,
    onPointerUp: finish,
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    style: { touchAction: "none", cursor: drag ? "grabbing" : "grab" },
  });

  // 놓일 자리 표시: 대상 행의 위/아래에 선을 '그린다'. DOM 은 그대로 둔다.
  const dropShadow = (i) => {
    if (!drag || drag.target !== i || drag.target === drag.from) return undefined;
    return drag.target < drag.from
      ? "inset 0 3px 0 0 var(--accent)"
      : "inset 0 -3px 0 0 var(--accent)";
  };

  return (
    <div className="flex flex-col" style={{ gap, userSelect: drag ? "none" : undefined }}>
      {items.map((item, i) => {
        const isDragging = drag?.from === i;
        return (
          <div
            key={getId(item)}
            ref={(el) => (rowRefs.current[i] = el)}
            style={{
              borderRadius: 14,
              boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,.28)" : dropShadow(i),
              transform: isDragging ? `translateY(${drag.dy}px)` : undefined,
              zIndex: isDragging ? 40 : undefined,
              position: isDragging ? "relative" : undefined,
              touchAction: isDragging ? "none" : undefined,
              transition: drag ? "none" : "box-shadow .15s",
            }}
          >
            {renderItem(item, { handleProps: handleProps(i), dragging: isDragging })}
          </div>
        );
      })}
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
      style={{ width: 28, height: 32, color: "var(--text-muted)", ...handleProps.style }}
      onPointerDown={handleProps.onPointerDown}
      onPointerMove={handleProps.onPointerMove}
      onPointerUp={handleProps.onPointerUp}
      onPointerCancel={handleProps.onPointerCancel}
      onLostPointerCapture={handleProps.onLostPointerCapture}
      onClick={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8 7h.01M8 12h.01M8 17h.01M16 7h.01M16 12h.01M16 17h.01"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
