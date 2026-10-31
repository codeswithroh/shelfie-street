import type { Metadata } from "next";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = { title: "Shelfie Street" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
