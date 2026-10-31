import { notFound } from "next/navigation";
import { getShop } from "@/lib/db";
import { appUrl } from "@/lib/commerce";
import { paypalConfigured } from "@/lib/paypal";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ new?: string }> }) {
  const { slug } = await params;
  const shop = await getShop(slug);
  if (!shop) notFound();
  return (
    <Dashboard
      slug={slug}
      mcpUrl={`${appUrl()}/s/${slug}/mcp`}
      isNew={(await searchParams).new === "1"}
      paypalReady={paypalConfigured()}
    />
  );
}
