import { createContext } from "preact";
import { useContext, useState, useCallback, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { GhostCard } from "./GhostCard";
import type { Zone, CardAnimation } from "./types";

interface AnimationContextValue {
  registerZoneRef: (zone: Zone, element: HTMLElement | null) => void;
  getZoneRect: (zone: Zone) => DOMRect | null;
  queueAnimation: (animation: Omit<CardAnimation, "id">) => void;
  queueAnimationAsync: (animation: Omit<CardAnimation, "id">) => Promise<void>;
}

const AnimationContext = createContext<AnimationContextValue | null>(null);

export function useAnimation(): AnimationContextValue {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error("useAnimation must be used within AnimationProvider");
  }
  return context;
}

// Safe version that returns null if outside provider (for gradual adoption)
export function useAnimationSafe(): AnimationContextValue | null {
  return useContext(AnimationContext);
}

interface AnimationProviderProps {
  children: ComponentChildren;
}

export function AnimationProvider({ children }: AnimationProviderProps) {
  const [animations, setAnimations] = useState<CardAnimation[]>([]);
  const zoneRefs = useRef<Map<Zone, HTMLElement>>(new Map());
  const animationIdCounter = useRef(0);
  const animationCallbacks = useRef<Map<string, () => void>>(new Map());

  const registerZoneRef = useCallback(
    (zone: Zone, element: HTMLElement | null) => {
      if (element) {
        zoneRefs.current.set(zone, element);
      } else {
        zoneRefs.current.delete(zone);
      }
    },
    [],
  );

  const getZoneRect = useCallback((zone: Zone): DOMRect | null => {
    const element = zoneRefs.current.get(zone);
    return element ? element.getBoundingClientRect() : null;
  }, []);

  const queueAnimation = useCallback((animation: Omit<CardAnimation, "id">) => {
    const id = `anim-${++animationIdCounter.current}`;
    setAnimations(prev => [...prev, { ...animation, id }]);
  }, []);

  const queueAnimationAsync = useCallback(
    (animation: Omit<CardAnimation, "id">): Promise<void> => {
      return new Promise(resolve => {
        const id = `anim-${++animationIdCounter.current}`;
        animationCallbacks.current.set(id, resolve);
        setAnimations(prev => [...prev, { ...animation, id }]);
      });
    },
    [],
  );

  const removeAnimation = useCallback((id: string) => {
    setAnimations(prev => prev.filter(a => a.id !== id));
    const callback = animationCallbacks.current.get(id);
    if (callback) {
      callback();
      animationCallbacks.current.delete(id);
    }
  }, []);

  const value: AnimationContextValue = {
    registerZoneRef,
    getZoneRect,
    queueAnimation,
    queueAnimationAsync,
  };

  return (
    <AnimationContext.Provider value={value}>
      {children}
      {animations.map(anim => (
        <GhostCard
          key={anim.id}
          cardName={anim.cardName}
          fromRect={anim.fromRect}
          toZone={anim.toZone}
          duration={anim.duration}
          getZoneRect={getZoneRect}
          onComplete={() => removeAnimation(anim.id)}
        />
      ))}
    </AnimationContext.Provider>
  );
}
