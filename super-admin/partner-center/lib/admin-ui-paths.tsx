"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

/** Serializable path helpers shared by Super Admin and Partner Admin UI. */
export type AdminUiPaths = {
  root: string;
  applications: string;
  application: (id: string) => string;
  partners: string;
  partner: (id: string) => string;
  referrals: string;
  referral: (id: string) => string;
  opportunities: string;
  opportunity: (id: string) => string;
  payouts: string;
  messages: string;
  message: (profileId: string) => string;
};

export type AdminUiMode = "super_admin" | "partner_admin";

type AdminUiContextValue = {
  paths: AdminUiPaths;
  mode: AdminUiMode;
};

const AdminUiContext = createContext<AdminUiContextValue>({
  paths: {
    root: PC_ADMIN.root,
    applications: PC_ADMIN.applications,
    application: PC_ADMIN.application,
    partners: PC_ADMIN.partners,
    partner: PC_ADMIN.partner,
    referrals: PC_ADMIN.referrals,
    referral: PC_ADMIN.referral,
    opportunities: PC_ADMIN.opportunities,
    opportunity: PC_ADMIN.opportunity,
    payouts: PC_ADMIN.payouts,
    messages: PC_ADMIN.messages,
    message: PC_ADMIN.message,
  },
  mode: "super_admin",
});

export function buildAdminUiPaths(root: string): AdminUiPaths {
  const base = root.replace(/\/$/, "");
  return {
    root: base,
    applications: `${base}/applications`,
    application: (id) => `${base}/applications/${id}`,
    partners: `${base}/partners`,
    partner: (id) => `${base}/partners/${id}`,
    referrals: `${base}/referrals`,
    referral: (id) => `${base}/referrals/${id}`,
    opportunities: `${base}/opportunities`,
    opportunity: (id) => `${base}/opportunities/${id}`,
    payouts: `${base}/payouts`,
    messages: `${base}/messages`,
    message: (profileId) => `${base}/messages/${profileId}`,
  };
}

export function AdminUiProvider({
  root,
  mode,
  children,
}: {
  root: string;
  mode: AdminUiMode;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ paths: buildAdminUiPaths(root), mode }),
    [root, mode],
  );
  return (
    <AdminUiContext.Provider value={value}>{children}</AdminUiContext.Provider>
  );
}

export function useAdminUiPaths(): AdminUiPaths {
  return useContext(AdminUiContext).paths;
}

export function useAdminUiMode(): AdminUiMode {
  return useContext(AdminUiContext).mode;
}
