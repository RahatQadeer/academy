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

export type AdminHeaderContent = {
  title: string;
  subtitle?: string;
};

type AdminHeaderContextValue = {
  header: AdminHeaderContent | null;
  setHeader: (next: AdminHeaderContent | null) => void;
  actionSlotRef: RefObject<HTMLDivElement | null>;
};

const AdminHeaderContext = createContext<AdminHeaderContextValue | null>(null);

export { AdminHeaderContext };

export function AdminHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<AdminHeaderContent | null>(null);
  const actionSlotRef = useRef<HTMLDivElement | null>(null);

  const setHeader = useCallback((next: AdminHeaderContent | null) => {
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
    <AdminHeaderContext.Provider value={value}>
      {children}
    </AdminHeaderContext.Provider>
  );
}

export function useAdminHeader(): AdminHeaderContextValue {
  const ctx = useContext(AdminHeaderContext);
  if (!ctx) {
    throw new Error("useAdminHeader must be used within AdminHeaderProvider");
  }
  return ctx;
}
