import Link from "next/link";

const steps = [
  { number: "01", title: "Import", detail: "Bring budget, actual, and cash plan data together from structured CSV or Excel files." },
  { number: "02", title: "Analyze", detail: "Review variance, operating profit, and a rolling 13-week cash forecast." },
  { number: "03", title: "Decide", detail: "Compare scenarios and share a clear management report." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#142b25]">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-7 sm:px-10">
        <header className="flex items-center justify-between border-b border-[#d8dfd7] pb-6">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#164d3b] text-lg text-white">↗</span>
            <span>Flow & Forecast</span>
          </Link>
          <span className="rounded-full border border-[#c7d8cd] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#356952]">Foundation preview</span>
        </header>
        <section className="grid gap-12 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:py-28">
          <div>
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.23em] text-[#407a5e]">Budget vs Actual + Cash Flow</p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.08] tracking-[-0.055em] sm:text-7xl">Know where the money went. See where it goes next.</h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#53675d]">One workspace for budget performance, short-term cash visibility, and practical scenario planning. Built for finance teams that need answers they can trace back to the numbers.</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a href="#workflow" className="rounded-xl bg-[#164d3b] px-6 py-3 font-medium text-white transition hover:bg-[#0c3829]">Explore the workflow <span aria-hidden>→</span></a>
              <span className="text-sm text-[#718278]">Application features are being built in phases.</span>
            </div>
          </div>
          <div aria-label="Illustrative finance dashboard preview" className="rounded-[2rem] border border-[#d8e1d7] bg-white p-5 shadow-[0_24px_70px_rgba(27,60,42,0.09)] sm:p-7">
            <div className="flex items-center justify-between border-b border-[#e9eee8] pb-5">
              <div><p className="text-xs font-semibold uppercase tracking-widest text-[#819187]">Dashboard preview</p><p className="mt-1 text-xl font-semibold">Financial overview</p></div>
              <span className="rounded-lg bg-[#eef5ee] px-3 py-1 text-xs font-medium text-[#356952]">Illustrative</span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#f3f7f1] p-5"><p className="text-xs text-[#64786a]">Revenue vs budget</p><p className="mt-3 text-3xl font-semibold tracking-tight">+8.2%</p><p className="mt-1 text-xs text-[#39795d]">Favorable variance</p></div>
              <div className="rounded-2xl bg-[#f3f7f1] p-5"><p className="text-xs text-[#64786a]">Projected cash</p><p className="mt-3 text-3xl font-semibold tracking-tight">13 weeks</p><p className="mt-1 text-xs text-[#64786a]">Rolling forecast</p></div>
            </div>
            <div className="mt-5 rounded-2xl border border-[#e7ece5] p-5">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold">Cash outlook</p><p className="text-xs text-[#7b8b80]">Illustration only</p></div>
              <div className="mt-7 flex h-28 items-end gap-2" aria-hidden="true">{[48, 56, 52, 67, 62, 72, 69, 79, 73, 84, 80, 89, 94].map((height, index) => <div key={index} className="flex-1 rounded-t-md bg-[#6fb48b]" style={{ height: `${height}%` }} />)}</div>
              <div className="mt-3 flex justify-between text-xs text-[#8b9b8f]"><span>Week 1</span><span>Week 13</span></div>
            </div>
          </div>
        </section>
        <section id="workflow" className="border-t border-[#d8dfd7] pt-10">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#407a5e]">The planned workflow</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">From source data to a clearer decision</h2></div><p className="max-w-sm text-sm leading-6 text-[#64766c]">The foundation is live first. Secure accounts, imports, calculations, and reports follow in later phases.</p></div>
          <div className="grid gap-4 md:grid-cols-3">{steps.map((step) => <article key={step.number} className="rounded-2xl border border-[#dce4da] bg-white p-7"><span className="text-sm font-semibold text-[#6aa17b]">{step.number}</span><h3 className="mt-8 text-2xl font-semibold">{step.title}</h3><p className="mt-3 leading-7 text-[#64766c]">{step.detail}</p></article>)}</div>
        </section>
        <footer className="mt-20 border-t border-[#d8dfd7] pt-6 text-sm text-[#718278]">Flow & Forecast · Budget vs Actual + 13-Week Cash Flow Management</footer>
      </div>
    </main>
  );
}
