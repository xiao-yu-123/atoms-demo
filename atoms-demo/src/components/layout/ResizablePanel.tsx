"use client";

// ============================================================================
// ResizablePanel — 可拖拽调整宽度的分栏布局
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResizablePanelProps {
  /** 各列的初始宽度比例（如 [3, 3, 4]） */
  initialRatios: number[];
  /** 各列最小宽度（px），默认 200 */
  minWidths?: number[];
  className?: string;
  children: React.ReactNode[];
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function ResizablePanel({
  initialRatios,
  minWidths: minWidthsProp,
  className = "",
  children,
}: ResizablePanelProps) {
  // 归一化
  const normalize = (r: number[]) => {
    const sum = r.reduce((a, b) => a + b, 1);
    return r.map((v) => v / sum);
  };

  const [ratios, setRatios] = useState(() => normalize(initialRatios));
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    index: number;
    startX: number;
    startRatios: number[];
  } | null>(null);

  const minWidths = minWidthsProp ?? children.map(() => 200);
  const panelCount = children.length;

  // 拖拽开始
  const onDividerMouseDown = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { index, startX: e.clientX, startRatios: [...ratios] };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [ratios],
  );

  // 拖拽中
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || !containerRef.current) return;

      const containerWidth = containerRef.current.getBoundingClientRect().width;
      if (containerWidth === 0) return;

      const dx = e.clientX - drag.startX;
      const dxRatio = dx / containerWidth;

      const newRatios = [...drag.startRatios];
      newRatios[drag.index] = drag.startRatios[drag.index] + dxRatio;
      newRatios[drag.index + 1] = drag.startRatios[drag.index + 1] - dxRatio;

      // 应用最小宽度
      for (let i = 0; i < newRatios.length; i++) {
        const minRatio = minWidths[i] / containerWidth;
        newRatios[i] = Math.max(minRatio, newRatios[i]);
      }

      // 如果最小宽度导致溢出，从另一列扣除
      const total = newRatios.reduce((a, b) => a + b, 0);
      if (total > 0) {
        for (let i = 0; i < newRatios.length; i++) {
          newRatios[i] = newRatios[i] / total;
        }
      }

      setRatios(newRatios);
    };

    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [minWidths]);

  return (
    <div ref={containerRef} className={`flex overflow-hidden ${className}`}>
      {children.map((child, i) => {
        const isLast = i === panelCount - 1;
        return (
          <div
            key={i}
            className="flex items-stretch"
            style={{ width: `${ratios[i] * 100}%`, minWidth: 0 }}
          >
            {/* 面板内容 */}
            <div className="min-w-0 flex-1 overflow-hidden">{child}</div>

            {/* 分割线 */}
            {!isLast && (
              <div
                className="group relative flex shrink-0 cursor-col-resize items-center justify-center bg-transparent transition-colors hover:bg-zinc-800/50 active:bg-emerald-500/20"
                style={{ width: 6, marginLeft: -3, marginRight: -3, zIndex: 10 }}
                onMouseDown={(e) => onDividerMouseDown(i, e)}
              >
                <div className="h-8 w-0.5 rounded-full bg-zinc-700 transition-colors group-hover:bg-zinc-500 group-active:bg-emerald-400" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
