"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AgGridReact, type CustomCellRendererProps } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef } from "ag-grid-community";
import { Empty, usd, useStreet } from "@/components/street";
import { gridTheme } from "@/components/gridTheme";
import type { LedgerEntry } from "@/lib/street/store";

ModuleRegistry.registerModules([AllCommunityModule]);

export default function Ledger() {
  const { data } = useStreet();
  const cols = useMemo<ColDef<LedgerEntry>[]>(() => [
    { headerName: "When", field: "created_at", width: 120, sort: "desc", valueFormatter: (p) => new Date(p.value).toLocaleTimeString() },
    { headerName: "Mission", field: "mission_id", width: 145, filter: true, cellRenderer: (p: CustomCellRendererProps<LedgerEntry>) => <Link className="underline" href={`/app/missions/${p.value}`}>{p.value}</Link> },
    { headerName: "Event", field: "type", width: 170, filter: true, valueFormatter: (p) => String(p.value).replaceAll("_", " ").toLowerCase() },
    { headerName: "Actor", field: "actor", width: 125, filter: true },
    { headerName: "Amount", field: "amount_cents", width: 110, type: "rightAligned", cellClass: "font-mono", valueFormatter: (p) => (p.value ? usd(Math.abs(p.value)) : "") },
    { headerName: "Detail", field: "detail", flex: 1, minWidth: 260, tooltipField: "detail" },
    { headerName: "Hash", field: "hash", width: 130, cellClass: "font-mono text-xs", valueFormatter: (p) => String(p.value).slice(0, 12) },
  ], []);
  if (!data) return <Empty>Loading ledger…</Empty>;
  return (
    <div className="space-y-3">
      <h1 className="font-display text-4xl">Money ledger</h1>
      <p className="text-sm text-ink-3">Every entry is hashed to the one before it, per mission.</p>
      <div className="h-[70vh]"><AgGridReact<LedgerEntry> theme={gridTheme} rowData={data.ledger} columnDefs={cols} getRowId={(p) => p.data.id} tooltipShowDelay={300} /></div>
    </div>
  );
}
