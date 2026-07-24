"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

type Job = { id: string; status: "queued" | "processing" | "completed" | "failed"; error?: string | null; downloadUrl?: string | null };
const accepted = ".pdf,.csv,.txt";

export default function HomePage() {
  const [companyName, setCompanyName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [message, setMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const pollRef = useRef<number | null>(null);

  const selectFile = (next: File | null) => { setMessage(""); if (!next) return; if (!/\.(pdf|csv|txt)$/i.test(next.name)) { setMessage("Choose a PDF, CSV, or TXT document."); return; } setFile(next); };
  const fileChange = (event: ChangeEvent<HTMLInputElement>) => selectFile(event.target.files?.[0] ?? null);

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
  const working = job?.status === "queued" || job?.status === "processing";

  return <main><nav className="nav"><div className="brand-mark"><span className="mark">B</span><span>BULL AI</span></div><span className="nav-label">FINANCIAL RESEARCH AUTOMATION</span></nav>
    <section className="hero"><div><p className="eyebrow">Evidence-backed company intelligence</p><h1>Turn a filing into a <em>research-ready</em> report.</h1><p className="lead">Upload a public company PDF, CSV, or TXT document. Bull AI validates its findings against source evidence and creates a four-page research report.</p><div className="tags"><span>PDF / CSV / TXT</span><span>Source-aware extraction</span><span>Static PDF download</span></div></div><aside className="report-card"><div className="card-top"><span>BULL AI RESEARCH</span><b>Q2 FY26</b></div><div className="skeleton-title" /><div className="skeleton-line wide" /><div className="skeleton-line" /><div className="mini-bars"><i /><i /><i /><i /></div><div className="card-bottom">4-page evidence-backed report</div></aside></section>
    <section className="workspace"><form className="form-card" onSubmit={submit}><div className="form-heading"><div><p className="eyebrow">New report</p><h2>Generate a report</h2></div><span className="required">Public-source filings only</span></div><label>Company name<input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="e.g. L&T Technology Services" maxLength={100} disabled={working} /></label><label>Context document<div className={`dropzone ${isDragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectFile(event.dataTransfer.files?.[0] ?? null); }}><input type="file" accept={accepted} onChange={fileChange} disabled={working} /><strong>{file ? file.name : "Drop a filing here"}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected` : "or browse for a PDF, CSV, or TXT file"}</span></div></label>{message && <p className="error">{message}</p>}<button type="submit" disabled={working}>{working ? "Generating report…" : "Generate research report"}<span>→</span></button></form>
      <aside className="status-card"><p className="eyebrow">Workflow status</p>{!job ? <><h3>Ready when you are.</h3><p>Select a company filing to start an evidence-backed extraction.</p><ol><li>Parse and reconstruct tables</li><li>Validate facts against sources</li><li>Render a polished PDF</li></ol></> : <Status job={job} onRetry={retry} />}</aside></section>
    <section className="trust"><div><b>No fabricated fields</b><span>Unavailable facts render as Not disclosed.</span></div><div><b>Source reconciliation</b><span>Reported metrics keep page-level evidence.</span></div><div><b>Private key handling</b><span>Gemini is called only from the server worker.</span></div></section>
  </main>;
}

function Status({ job, onRetry }: { job: Job; onRetry: () => void }) {
  const copy = job.status === "queued" ? ["Queued", "Your document is waiting for the report worker."] : job.status === "processing" ? ["Building your report", "Parsing source pages, validating financial facts, and rendering the PDF."] : job.status === "completed" ? ["Report ready", "Your four-page report has been generated."] : ["Generation needs attention", job.error ?? "The report could not be created."];
  return <><div className={`status-dot ${job.status}`} /><h3>{copy[0]}</h3><p>{copy[1]}</p><div className="job-id">Job {job.id.slice(0, 8)}</div>{job.status === "completed" && job.downloadUrl && <a className="download" href={job.downloadUrl}>Download PDF <span>↓</span></a>}{job.status === "failed" && <button className="retry" onClick={onRetry}>Retry job</button>}</>;
}
