import Link from "next/link";
import { Nav } from "@/components/Brand";

const ROWS = [
  { n: "1", t: "One approval", b: "You set a goal and a ceiling. PayPal holds up to $150. Nothing is charged." },
  { n: "2", t: "Agents buy across shops", b: "The agent splits the errand across a bakery, a florist and a party shop." },
  { n: "3", t: "A shop sells out? It recovers", b: "It swaps in another shop inside your ceiling, with no second approval." },
  { n: "4", t: "Photo first, money after", b: "Each shop photographs the packed order. Claude checks it. Only then is anyone paid." },
];

export default function Home() {
  return (
    <>
      <Nav><Link href="/app" className="btn btn-primary">Open the app</Link></Nav>
      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <section className="pt-10 lg:pt-16">
          <h1 className="font-display max-w-4xl text-5xl leading-[1.02] sm:text-7xl">
            One PayPal approval. <span className="text-tomato">Five shops.</span> No half-finished orders.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-2">
            Tell an AI agent “birthday party for 12, $150 max.” Shelfie Street buys from every independent shop it needs,
            and you pay for all of it or none of it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/app" className="btn btn-accent text-base">Run a mission</Link>
            <Link href="/onboard" className="btn btn-ghost text-base">Add your shop from a photo</Link>
          </div>
        </section>
        <section className="mt-16 grid gap-4 md:grid-cols-2">
          {ROWS.map((r) => (
            <div key={r.n} className="card p-6">
              <div className="font-mono text-sm text-tomato">{r.n}</div>
              <h2 className="font-display mt-1 text-3xl">{r.t}</h2>
              <p className="mt-1 text-ink-2">{r.b}</p>
            </div>
          ))}
        </section>
        <section className="card mt-4 p-6">
          <h2 className="font-display text-3xl">A hostile agent can&apos;t talk its way to your money</h2>
          <p className="mt-1 max-w-3xl text-ink-2">Spending limits live in signed mandates checked by code, not by the model. The firewall page runs five live attacks so you can watch them fail.</p>
        </section>
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-sm text-ink-3 sm:px-6">Shelfie Street · PayPal sandbox · Claude</footer>
    </>
  );
}
