"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

export type PartnerHeaderContent = {
  title: string;
  subtitle?: string;
};

type PartnerHeaderContextValue = {
  header: PartnerHeaderContent | null;
  setHeader: (next: PartnerHeaderContent | null) => void;
  actionSlotRef: RefObject<HTMLDivElement | null>;
};

const PartnerHeaderContext = createContext<PartnerHeaderContextValue | null>(
  null,
);

export function PartnerHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<PartnerHeaderContent | null>(null);
  const actionSlotRef = useRef<HTMLDivElement | null>(null);

  const setHeader = useCallback((next: PartnerHeaderContent | null) => {
    setHeaderState((prev) => {
      if (next === null) return null;
      if (prev?.title === next.title && prev?.subtitle === next.subtitle) {
        return prev;
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ header, setHeader, actionSlotRef }),
    [header, setHeader],
  );

  return (
    <PartnerHeaderContext.Provider value={value}>
      {children}
    </PartnerHeaderContext.Provider>
  );
}

export function usePartnerHeader(): PartnerHeaderContextValue {
  const ctx = useContext(PartnerHeaderContext);
  if (!ctx) {
    throw new Error(
      "usePartnerHeader must be used within PartnerHeaderProvider",
    );
  }
  return ctx;
}
