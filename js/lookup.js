// Dear Reader — finding a book's title, author, pages and cover (Open Library first, Google Books as a backup).
// Only used while adding a book; everything else works offline.
import { isbnKey } from "./books.js";

async function getJSON(url, ms = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

export function parseSeriesLine(s) {
  if (!s) return { series: "", seriesNo: null };
  const m = String(s).match(/^(.*?)(?:[,;:\s-]+(?:#|no\.?|book|vol\.?|volume|--)\s*(\d+(?:\.\d+)?))?\s*$/i);
  const name = (m ? m[1] : s).replace(/[,;:\s-]+$/, "").trim();
  return { series: name, seriesNo: m && m[2] ? Number(m[2]) : null };
}

export async function byISBN(raw) {
  const isbn = isbnKey(raw);
  if (!isbn) return null;
  try {
    const [data, ed] = await Promise.all([
      getJSON(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`),
      getJSON(`https://openlibrary.org/isbn/${isbn}.json`).catch(() => null),
    ]);
    const d = data && data[`ISBN:${isbn}`];
    if (d && d.title) {
      return {
        isbn, title: d.title, author: (d.authors || []).map(a => a.name).join(", "),
        pages: d.number_of_pages || ed?.number_of_pages || null,
        cover: d.cover?.medium || d.cover?.large || "",
        year: (String(d.publish_date || "").match(/\d{4}/) || [])[0] || "",
        ...parseSeriesLine(ed?.series?.[0]),
      };
    }
  } catch { /* try the backup */ }
  try {
    const g = await getJSON(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const v = g.items?.[0]?.volumeInfo;
    if (v && v.title) return { isbn, title: v.title, author: (v.authors || []).join(", "), pages: v.pageCount || null, cover: (v.imageLinks?.thumbnail || "").replace(/^http:/, "https:"), year: (v.publishedDate || "").slice(0, 4), series: "", seriesNo: null };
  } catch { /* nothing found */ }
  return null;
}

export async function search(q) {
  const s = String(q || "").trim();
  if (s.length < 2) return [];
  const isbn = isbnKey(s);
  if (/^\d{10,13}X?$/.test(isbn) && isbn.length >= 10) { const one = await byISBN(isbn); return one ? [one] : []; }
  try {
    const d = await getJSON(`https://openlibrary.org/search.json?q=${encodeURIComponent(s)}&limit=12&fields=key,title,author_name,first_publish_year,number_of_pages_median,cover_i,isbn`);
    return (d.docs || []).map(x => ({
      isbn: (x.isbn || []).find(i => /^978[01]/.test(i)) || (x.isbn || []).find(i => i.length === 13) || (x.isbn || [])[0] || "",
      title: x.title, author: (x.author_name || []).slice(0, 2).join(", "), pages: x.number_of_pages_median || null,
      cover: x.cover_i ? `https://covers.openlibrary.org/b/id/${x.cover_i}-M.jpg` : "", year: x.first_publish_year || "", series: "", seriesNo: null,
    }));
  } catch {
    try {
      const g = await getJSON(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(s)}&maxResults=12`);
      return (g.items || []).map(i => i.volumeInfo).filter(v => v && v.title).map(v => ({
        isbn: (v.industryIdentifiers || []).find(i => i.type === "ISBN_13")?.identifier || "", title: v.title, author: (v.authors || []).join(", "),
        pages: v.pageCount || null, cover: (v.imageLinks?.thumbnail || "").replace(/^http:/, "https:"), year: (v.publishedDate || "").slice(0, 4), series: "", seriesNo: null,
      }));
    } catch { return null; }
  }
}
