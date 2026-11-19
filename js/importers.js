// Dear Reader — bringing books in from Goodreads, StoryGraph, the Dear Agneta Book Tracker sheet, or any list.
import { parseCSV, toISODate, guessDateFormat, toNumber } from "./csv.js";
import { splitSeries, cleanISBN, isbnKey, findBook } from "./books.js";
import { newBook } from "./model.js";

const lower = h => String(h || "").toLowerCase().trim();
const col = (header, ...names) => { const h = header.map(lower); for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; } for (const n of names) { const i = h.findIndex(x => x.includes(n)); if (i >= 0) return i; } return -1; };
const get = (r, i) => (i >= 0 ? String(r[i] ?? "").trim() : "");

export function detect(header) {
  const h = header.map(lower);
  if (h.includes("exclusive shelf") && h.includes("my rating")) return "goodreads";
  if (h.includes("read status") && h.some(x => x.includes("star rating"))) return "storygraph";
  if (h.some(x => x.includes("page i'm on") || x.includes("books in series") || x === "# in series")) return "sheet";
  return "generic";
}
export const SOURCE_NAMES = { goodreads: "Goodreads", storygraph: "StoryGraph", sheet: "Dear Agneta Book Tracker", generic: "a book list" };

const fmtFrom = s => { s = lower(s); return /audio|audible/.test(s) ? "audio" : /kindle|ebook|e-book|digital|epub|nook|kobo/.test(s) ? "ebook" : "paper"; };
const statusFrom = s => {
  s = lower(s);
  if (/did.?not.?finish|dnf|abandon/.test(s)) return "dnf";
  if (/currently|reading|in progress/.test(s)) return "reading";
  if (/to.?read|tbr|want/.test(s)) return "tbr";
  if (/wish/.test(s)) return "wish";
  if (/read|finished|done/.test(s)) return "read";
  return "tbr";
};
const sourceFrom = s => { s = lower(s); return /library/.test(s) ? "library" : /kindle unlimited|\bku\b|subscription|scribd|everand|libby/.test(s) ? (/libby/.test(s) ? "library" : "ku") : /borrow/.test(s) ? "borrowed" : /gift/.test(s) ? "gift" : /bought|buy|owned|purchase/.test(s) ? "bought" : ""; };

export function readFile(text, locale = "en-GB") {
  const p = parseCSV(text);
  const kind = detect(p.header);
  const H = p.header;
  const dateCols = [col(H, "date read", "last date read", "finished", "date finished"), col(H, "date added", "started", "date started")].filter(i => i >= 0);
  const dateFmt = guessDateFormat(p.rows.flatMap(r => dateCols.map(i => r[i])).filter(Boolean).slice(0, 60), locale);
  const D = v => (v ? toISODate(v, dateFmt) : null);
  const books = [];
  for (const r of p.rows) {
    let b;
    if (kind === "goodreads") {
      const t = splitSeries(get(r, col(H, "title")));
      const shelves = lower(get(r, col(H, "bookshelves")));
      let status = statusFrom(get(r, col(H, "exclusive shelf")));
      if (/\bdnf\b|did-not-finish/.test(shelves)) status = "dnf";
      if (/wish/.test(shelves) && status === "tbr") status = "wish";
      const rating = Number(get(r, col(H, "my rating"))) || 0;
      b = newBook({ title: t.title, series: t.series, seriesNo: t.seriesNo, author: get(r, col(H, "author")),
        isbn: cleanISBN(get(r, col(H, "isbn13"))) || cleanISBN(get(r, col(H, "isbn"))), pages: Number(get(r, col(H, "number of pages"))) || null,
        format: fmtFrom(get(r, col(H, "binding"))), status, rating, finished: status === "read" ? D(get(r, col(H, "date read"))) : null,
        addedAt: D(get(r, col(H, "date added"))) || undefined, owned: Number(get(r, col(H, "owned copies"))) > 0 || /owned/.test(shelves),
        notes: [get(r, col(H, "my review")), get(r, col(H, "private notes"))].filter(Boolean).join("\n\n").replace(/<br\s*\/?>/gi, "\n").slice(0, 4000) });
      const rc = Number(get(r, col(H, "read count"))) || 0;
      if (rc > 1 && b.finished) b.rereads = Array.from({ length: rc - 1 }, () => ({ started: null, finished: null, rating: 0 }));
    } else if (kind === "storygraph") {
      const status = statusFrom(get(r, col(H, "read status")));
      const t = splitSeries(get(r, col(H, "title")));
      b = newBook({ title: t.title, series: t.series, seriesNo: t.seriesNo, author: get(r, col(H, "authors")), isbn: cleanISBN(get(r, col(H, "isbn/uid", "isbn"))),
        format: fmtFrom(get(r, col(H, "format"))), status, rating: Number(get(r, col(H, "star rating"))) || 0,
        finished: status === "read" ? D(get(r, col(H, "last date read"))) : null, addedAt: D(get(r, col(H, "date added"))) || undefined,
        moods: get(r, col(H, "moods")).split(/[,;]/).map(x => x.trim().toLowerCase()).filter(Boolean).slice(0, 8),
        tropes: get(r, col(H, "tags")).split(/[,;]/).map(x => x.trim().toLowerCase()).filter(Boolean).slice(0, 12),
        owned: /^y/i.test(get(r, col(H, "owned"))), notes: get(r, col(H, "review")).slice(0, 4000) });
      if (b.isbn && !/^\d{9}[\dX]$|^\d{13}$/.test(b.isbn)) b.isbn = "";
    } else {
      // Dear Agneta sheet or any list with a Title column.
      const ti = col(H, "title", "book", "name");
      if (ti < 0) continue;
      const t = splitSeries(get(r, ti));
      const source = sourceFrom(get(r, col(H, "source", "where from", "how i got it")));
      const status = statusFrom(get(r, col(H, "status", "shelf")) || (get(r, col(H, "finished", "date read")) ? "read" : "tbr"));
      const seriesName = get(r, col(H, "series")) || t.series;
      b = newBook({ title: t.title, author: get(r, col(H, "author")), isbn: cleanISBN(get(r, col(H, "isbn"))), genre: get(r, col(H, "genre")) || "Other",
        format: fmtFrom(get(r, col(H, "format"))), source, owned: source === "bought" || source === "gift", status,
        progress: Number(get(r, col(H, "page i'm on", "current page"))) || 0, pages: Number(get(r, col(H, "pages", "page count"))) || null,
        started: D(get(r, col(H, "started", "date started"))), finished: D(get(r, col(H, "finished", "date read", "date finished"))),
        rating: Math.min(5, Math.max(0, Number(String(get(r, col(H, "rating", "stars"))).replace(",", ".")) || 0)),
        series: seriesName, seriesNo: Number(get(r, col(H, "# in series", "series #", "number in series"))) || t.seriesNo,
        seriesTotal: Number(get(r, col(H, "books in series"))) || null, seriesStatus: get(r, col(H, "series status")),
        price: (() => { const n = toNumber(get(r, col(H, "price", "cost"))); return isFinite(n) && n > 0 ? n : null; })(), boughtOn: D(get(r, col(H, "bought on", "date bought"))),
        cover: /^https?:/.test(get(r, col(H, "cover link"))) ? get(r, col(H, "cover link")) : "",
        quotes: get(r, col(H, "favourite quote", "favorite quote", "quote")) ? [{ text: get(r, col(H, "favourite quote", "favorite quote", "quote")) }] : [],
        notes: get(r, col(H, "notes", "review")).slice(0, 4000) });
    }
    if (!b.title) continue;
    if (b.status === "reading" && !b.started) b.started = b.addedAt || null;
    if (b.status === "read" && !b.finished) b.finished = b.addedAt || null;
    if (!b.addedAt) b.addedAt = new Date().toISOString().slice(0, 10);
    b.rating = Math.round(b.rating * 4) / 4;
    books.push(b);
  }
  return { kind, books };
}

// Splits incoming books into new ones and ones already in the library (same ISBN, or same title and author).
export function plan(S, books) {
  const seen = new Set();
  const fresh = [], dupes = [];
  for (const b of books) {
    const k = (b.isbn ? isbnKey(b.isbn) : "") || (b.title + "|" + b.author).toLowerCase();
    if (seen.has(k) || findBook(S, b)) { dupes.push(b); continue; }
    seen.add(k); fresh.push(b);
  }
  return { fresh, dupes };
}
