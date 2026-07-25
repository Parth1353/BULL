"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

type Job = { id: string; status: "queued" | "processing" | "completed" | "failed"; error?: string | null; downloadUrl?: string | null };
const accepted = ".pdf,.csv,.txt";

const STOCK_FACTS = [
  "The Amsterdam Stock Exchange, established in 1602 by the Dutch East India Company, is considered the world's oldest official stock exchange.",
  "The New York Stock Exchange (NYSE) originated in 1792 when 24 stockbrokers signed the Buttonwood Agreement under a buttonwood tree on Wall Street.",
  "October and September are historically known as the most volatile months in the US stock market, with September often recording negative average returns.",
  "The term 'Wall Street' comes from an actual 12-foot wooden wall built by Dutch settlers in 1653 in Manhattan to defend against British and Native American attacks.",
  "In 1999, at the height of the dot-com bubble, the NASDAQ composite index rose by an astonishing 85.6% in a single calendar year.",
  "The shortest bear market in U.S. history occurred in early 2020 during the COVID-19 pandemic crash, lasting only 33 days before entering a powerful new bull market.",
  "Warren Buffett bought his first stock at age 11 in 1942—three shares of Cities Service Preferred at $38 per share.",
  "Approximately 80% of daily stock market volume in the United States is now executed by automated algorithmic and quantitative high-frequency trading systems.",
  "A 'Bull Market' and 'Bear Market' get their names from how the animals attack: a bull thrusts its horns upward into the air, while a bear swipes its paws downward.",
  "The Dow Jones Industrial Average originally debuted in 1896 with just 12 industrial companies, including General Electric and American Cotton Oil.",
  "If you had invested $1,000 in the S&P 500 in 1965 and reinvested all dividends, your investment would be worth over $300,000 today.",
  "The most expensive single share of stock in the world is Berkshire Hathaway Class A (BRK.A), trading at over $600,000 per share because Warren Buffett has never split it.",
  "Over any 20-year rolling period in U.S. stock market history, the S&P 500 has never produced a negative return, adjusting for inflation.",
  "The Japanese stock market index, the Nikkei 225, took nearly 34 years to recover and surpass its previous all-time high set in December 1989 during the Japanese asset price bubble.",
  "In 2013, a single false tweet from an AP account hacked by Syrian hackers claiming an explosion at the White House briefly wiped out $136 billion in market value in just two minutes.",
  "The concept of short selling dates back to 1609 when Isaac Le Maire, a Dutch merchant, shorted shares of the Dutch East India Company.",
  "The first stock ticker machine was invented by Edward Calahan in 1867, which printed stock quotes on paper tape over telegraph lines.",
  "Ronald Wayne, the third co-founder of Apple alongside Steve Jobs and Steve Wozniak, sold his 10% stake in the company for just $800 in 1976—a stake worth hundreds of billions today.",
  "Dividends account for roughly 40% of the total historical stock market return of the S&P 500 since 1930.",
  "The 'Janitor Who Bequeathed Millions': Ronald Read, a Vermont janitor and gas station attendant, quietly amassed an $8 million stock portfolio by investing in dividend-paying blue-chip stocks over decades.",
  "Only one company from the original 1896 Dow Jones Industrial Average remained in the index for over a century: General Electric, before being removed in 2018.",
  "During the Crash of 1929, the U.S. stock market lost nearly 90% of its value from peak to trough, and it took 25 years for the Dow to return to its 1929 peak.",
  "The largest single-day percentage drop in Dow Jones history occurred on Black Monday, October 19, 1987, when the index plummeted by 22.6% in a matter of hours.",
  "The total value of all global stock markets combined is estimated to be over $110 trillion, with the U.S. stock market representing more than 40% of the global total.",
  "The 'Halloween Strategy' or 'Sell in May and Go Away' is based on the historical anomaly where stocks tend to perform better between November and April than between May and October.",
  "Apple became the world's first publicly traded company to reach a $1 trillion market capitalization in 2018, $2 trillion in 2020, and $3 trillion in 2023.",
  "The VIX, often referred to as Wall Street's 'Fear Gauge,' measures the market's expectation of 30-day volatility implied by S&P 500 index options.",
  "In 2008, Volkswagen briefly became the world's most valuable company by market capitalization during a historic short squeeze that drove its stock price up by over 400% in two days.",
  "The term 'Blue Chip' stock originates from the game of poker, where blue chips traditionally hold the highest monetary value on the table.",
  "The Bombay Stock Exchange (BSE), founded in 1875 under a banyan tree in Mumbai, is the oldest stock exchange in Asia.",
  "In the 17th century during 'Tulip Mania' in Holland, the price of a single rare tulip bulb soared higher than the cost of a grand mansion in Amsterdam before collapsing completely.",
  "Over 90% of actively managed mutual funds fail to beat their respective benchmark stock market indexes over a 15-year investment horizon.",
  "The National Association of Securities Dealers Automated Quotations (NASDAQ) was launched in 1971 as the world's first electronic stock market, eliminating the need for a physical trading floor.",
  "The 'Rule of 72' is a mental shortcut to estimate how long an investment takes to double: divide 72 by your annual compound interest rate (e.g., at an 8% return, your money doubles every 9 years).",
  "The stock market is forward-looking: historical economic data shows that stock markets typically begin recovering 3 to 6 months before an economic recession officially ends.",
  "During World War I, the New York Stock Exchange was closed for over four months in 1914—the longest shutdown in its history—to prevent market panic and mass sell-offs."
];

export default function HomePage() {
  const [companyName, setCompanyName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [message, setMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [factIndex, setFactIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const pollRef = useRef<number | null>(null);

  const selectFile = (next: File | null) => { setMessage(""); if (!next) return; if (!/\.(pdf|csv|txt)$/i.test(next.name)) { setMessage("Choose a PDF, CSV, or TXT document."); return; } setFile(next); };
  const fileChange = (event: ChangeEvent<HTMLInputElement>) => selectFile(event.target.files?.[0] ?? null);

  const working = job?.status === "queued" || job?.status === "processing";

  useEffect(() => {
    if (!working) return;
    const interval = window.setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setFactIndex((prev) => (prev + 1) % STOCK_FACTS.length);
        setFade(true);
      }, 450);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [working]);

  useEffect(() => {
    if (!job || ["completed", "failed"].includes(job.status)) return;
    pollRef.current = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/reports/${job.id}`, { cache: "no-store" });
        if (response.ok) {
          setJob(await response.json());
          return;
        }
        if (response.status === 404) {
          // Render's free plan uses ephemeral local storage, so a restart can
          // remove a queued job while this browser tab is still polling it.
          setJob(null);
          setMessage("This report session expired after the server restarted. Please submit the document again.");
        }
      } catch {
        // A deployment wake-up or restart can briefly make the status endpoint
        // unavailable. Keep polling so a transient outage can recover.
      }
    }, 900);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [job?.id, job?.status]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage("");
    if (!companyName.trim() || !file) { setMessage("Enter a company name and select a context document."); return; }
    const form = new FormData(); form.set("companyName", companyName.trim()); form.set("file", file);
    const response = await fetch("/api/reports", { method: "POST", body: form }); const body = await response.json();
    if (!response.ok) { setMessage(body.error ?? "Unable to start report generation."); return; }
    setJob(body);
  }

  async function retry() { if (!job) return; const response = await fetch(`/api/reports/${job.id}/retry`, { method: "POST" }); if (response.ok) setJob(await response.json()); }

  return <main><nav className="nav"><div className="brand-mark"><span className="mark">B</span><span>BULL AI</span></div><span className="nav-label">FINANCIAL RESEARCH AUTOMATION</span></nav>
    <section className="hero"><div><p className="eyebrow">Evidence-backed company intelligence</p><h1>Turn a filing into a <em>research-ready</em> report.</h1><p className="lead">Upload a public company PDF, CSV, or TXT document. Bull AI validates its findings against source evidence and creates a four-page research report.</p><div className="tags"><span>PDF / CSV / TXT</span><span>Source-aware extraction</span><span>Static PDF download</span></div></div><aside className="report-card"><div className="card-top"><span>BULL AI RESEARCH</span><b>Q2 FY26</b></div><div className="skeleton-title" /><div className="skeleton-line wide" /><div className="skeleton-line" /><div className="mini-bars"><i /><i /><i /><i /></div><div className="card-bottom">4-page evidence-backed report</div></aside></section>
    <section className="workspace"><form className="form-card" onSubmit={submit}><div className="form-heading"><div><p className="eyebrow">New report</p><h2>Generate a report</h2></div><span className="required">Public-source filings only</span></div><label>Company name<input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="e.g. L&T Technology Services" maxLength={100} disabled={working} /></label><label>Context document<div className={`dropzone ${isDragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectFile(event.dataTransfer.files?.[0] ?? null); }}><input type="file" accept={accepted} onChange={fileChange} disabled={working} /><strong>{file ? file.name : "Drop a filing here"}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected` : "or browse for a PDF, CSV, or TXT file"}</span></div></label>{message && <p className="error">{message}</p>}<button type="submit" disabled={working}>{working ? "Generating report…" : "Generate research report"}<span>→</span></button></form>
      <aside className="status-card"><p className="eyebrow">Workflow status</p>{!job ? <><h3>Ready when you are.</h3><p>Select a company filing to start an evidence-backed extraction.</p><ol><li>Parse and reconstruct tables</li><li>Validate facts against sources</li><li>Render a polished PDF</li></ol></> : <Status job={job} onRetry={retry} />}</aside></section>
    <section className="trust"><div><b>No fabricated fields</b><span>Unavailable facts render as Not disclosed.</span></div><div><b>Source reconciliation</b><span>Reported metrics keep page-level evidence.</span></div><div><b>Private key handling</b><span>Our AI agents are called only from the secure server worker.</span></div></section>
    {working && (
      <div className="overlay-loader">
        <div className="loader-box">
          <div className="loader-title">Extracting Intelligence…</div>
          <div className="loader-subtitle">
            Our AI agents are working on reading source pages, reconciling tables, and verifying evidence.
          </div>
          <div className="loader-progress-track">
            <div className="loader-progress-bar" />
          </div>
          <div className="fact-container">
            <div className="fact-header">Did You Know? • Fact #{factIndex + 1} of {STOCK_FACTS.length}</div>
            <div
              className="fact-text"
              style={{
                opacity: fade ? 1 : 0,
                transform: fade ? "translateY(0)" : "translateY(4px)",
              }}
            >
              &ldquo;{STOCK_FACTS[factIndex]}&rdquo;
            </div>
          </div>
        </div>
      </div>
    )}
  </main>;
}

function Status({ job, onRetry }: { job: Job; onRetry: () => void }) {
  const copy = job.status === "queued" ? ["Queued", "Your document is waiting for the report worker."] : job.status === "processing" ? ["Building your report", "Parsing source pages, validating financial facts, and rendering the PDF."] : job.status === "completed" ? ["Report ready", "Your four-page report has been generated."] : ["Generation needs attention", job.error ?? "The report could not be created."];
  return <><div className={`status-dot ${job.status}`} /><h3>{copy[0]}</h3><p>{copy[1]}</p><div className="job-id">Job {job.id.slice(0, 8)}</div>{job.status === "completed" && job.downloadUrl && <a className="download" href={job.downloadUrl}>Download PDF <span>↓</span></a>}{job.status === "failed" && <button className="retry" onClick={onRetry}>Retry job</button>}</>;
}
