import { useRef, useEffect, useState } from "preact/hooks";
import { useSyncToLocalStorage } from "../../hooks/useSyncToLocalStorage";
import {
  DEFAULT_LOG_HEIGHT_PERCENT,
  MIN_LOG_HEIGHT_PERCENT,
  MAX_LOG_HEIGHT_PERCENT,
  FULL_PERCENT,
} from "./constants";

const STORAGE_LOG_HEIGHT_KEY = "dominion-maker-log-height";

export function useResizeHandle() {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [gameLogHeight, setGameLogHeight] = useState(() => {
    const saved = localStorage.getItem(STORAGE_LOG_HEIGHT_KEY);
    return saved ? parseFloat(saved) : DEFAULT_LOG_HEIGHT_PERCENT;
  });
  const [isDragging, setIsDragging] = useState(false);

  useSyncToLocalStorage(STORAGE_LOG_HEIGHT_KEY, gameLogHeight, {
    serialize: value => value.toString(),
  });

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (sidebarRef.current) {
        const sidebarRect = sidebarRef.current.getBoundingClientRect();
        const relativeY = e.clientY - sidebarRect.top;
        const percentage = (relativeY / sidebarRect.height) * FULL_PERCENT;
        setGameLogHeight(
          Math.max(
            MIN_LOG_HEIGHT_PERCENT,
            Math.min(MAX_LOG_HEIGHT_PERCENT, percentage),
          ),
        );
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return {
    sidebarRef,
    gameLogHeight,
    isDragging,
    setIsDragging,
  };
}
