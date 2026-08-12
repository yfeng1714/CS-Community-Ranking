import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Admin Console",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
