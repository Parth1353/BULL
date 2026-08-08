BULL AI — TECHNICAL ASSESSMENT
Generated research reports for the two provided input documents
================================================================

Both reports were produced with DEMO_MODE=false. There is no demo mode
and no fixture data anywhere in the codebase; these are live extractions
from the supplied PDFs.

CONTENTS
--------
LTTS-Q2FY26-Bull-AI-Research.pdf         4-page report from "LTTS Q2FY26.pdf"
LTTS-Q2FY26-Bull-AI-Research.json        Schema-validated structured output + machine-readable trace
LTTS-Q2FY26-Bull-AI-Research.trace.txt   Run trace: model, per-pass tokens/timings, reconciliation

POCL-Q2FY26-Bull-AI-Research.pdf         4-page report from "POCL Q2FY26.pdf"
POCL-Q2FY26-Bull-AI-Research.json        Schema-validated structured output + machine-readable trace
POCL-Q2FY26-Bull-AI-Research.trace.txt   Run trace

HOW THEY WERE PRODUCED
----------------------
  parse -> extract (4 passes) -> reconcile -> render

1. parse      The PDF is read page by page and table rows are reconstructed
              from the page layout, so a table's numbers stay attached to
              their row labels instead of scrambling into prose.
2. extract    Four focused Gemini passes (profile / quarterly / statements /
              charts) using constrained JSON decoding against a schema, so
              the response is guaranteed to parse and match the contract.
3. reconcile  The anti-fabrication gate. Every evidence quote must appear
              verbatim on a real page, and every figure must appear in that
              quote or on that page. A stated growth rate is recomputed from
              the two figures behind it and dropped if no rounding of those
              figures could produce it. Anything that fails prints as
              "Not disclosed" and is itemised in the trace.
4. render     Only values that survived are typeset.

VERIFICATION
------------
Every figure in both PDFs was independently re-checked against the source
documents using a second, unrelated PDF text extractor:

                                      LTTS        POCL
  Printed figures found in source     198/198     159/159
  Narrative passages, no bad figure    14/14       15/15
  Evidence quotes on their cited page   64/64       69/69

A NOTE ON THE TWO TRACES
------------------------
The traces name different models (gemini-3.6-flash and gemini-3-flash-preview).
Generation was done on a free-tier API key, which caps requests per model per
day; the second report was generated on a different model once that cap was
reached. The model is recorded per run in the trace. Page 3 of the POCL report
is correspondingly sparser: that model extracted fewer statement rows from the
same document.

WHAT THE SYSTEM DELIBERATELY DOES NOT DO
----------------------------------------
No ratings, target prices, forecasts or investment advice. No market data is
fetched. Share prices, market capitalisation and valuation multiples appear
only where the uploaded document itself states them. Missing values are marked
"Not disclosed" rather than inferred, interpolated or carried across periods.
