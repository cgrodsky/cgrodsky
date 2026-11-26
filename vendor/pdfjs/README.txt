pdf.js 3.11.174 (Mozilla, Apache License 2.0 — see LICENSE), legacy UMD build from the npm package
pdfjs-dist@3.11.174 (legacy/build/pdf.min.js + legacy/build/pdf.worker.min.js), unmodified.

Used by js/edge-pdf.js (Microsoft Edge's PDF viewer). It is loaded lazily the first time a PDF is
opened, so it costs nothing at startup (~1.5 MB on first use). The legacy build is used so older
iPad Safari versions work. If these files are removed, Edge falls back to the browser's own PDF viewer.
