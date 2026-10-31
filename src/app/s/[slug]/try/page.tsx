import { notFound } from "next/navigation";
import { getShop } from "@/lib/db";
import Playground from "./Playground";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getShop(slug);
  if (!shop) notFound();
  return <Playground slug={slug} shopName={shop.name} category={shop.category} />;
}
