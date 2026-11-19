// Dear Reader — small drawing helpers shared by the screens and sheets.
import { app, esc } from "./core.js";
import { percent, length } from "./books.js";

export const genreColor = g => { const i = app.S.genres.indexOf(g); return `var(--p${(i < 0 ? 8 : i) % 9})`; };

// A book cover: the real cover when there is one, otherwise a cloth cover with the title (also shown while the image loads or if it fails).
export function cover(b, w = 96, h = Math.round(w * 1.5), extra = "", lazy = false) {
  const img = b.cover ? `<img src="${esc(b.cover)}" alt=""${lazy ? ' loading="lazy"' : ""} decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : "";
  const longest = Math.max(1, ...String(b.title || "").split(/\s+/).map(x => x.length));
  const fs = longest > 9 ? (0.115 * 9 / longest).toFixed(4) : "0.115";
  return `<div class="bk" style="--c:${genreColor(b.genre)};--w:${w}px;width:${w}px;height:${h}px" ${extra}><div class="cloth"><b style="font-size:calc(var(--w) * ${fs})">${esc(b.title)}</b><span>${esc(String(b.author || "").split(",")[0])}</span></div>${img}</div>`;
}

const STAR = "M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z";
let sid = 0;
export function stars(r, size = 16) {
  let out = "";
  for (let i = 0; i < 5; i++) {
    const f = Math.max(0, Math.min(1, (r || 0) - i)); const id = "s" + (++sid);
    out += `<svg viewBox="0 0 24 24" style="width:${size}px;height:${size}px"><defs><clipPath id="${id}"><rect width="${(24 * f).toFixed(1)}" height="24"/></clipPath></defs><path d="${STAR}" fill="var(--track)"/><path d="${STAR}" fill="var(--gold)" clip-path="url(#${id})"/></svg>`;
  }
  return `<span class="stars" aria-label="${r || 0} stars">${out}</span>`;
}
export const ratingText = r => { if (!r) return "not rated"; const w = Math.floor(r), q = Math.round((r - w) * 4); return `${w || ""}${["", "¼", "½", "¾"][q]} ${r === 1 ? "star" : "stars"}`.trim(); };

const CHILLI = "M5 9C5 6.5 9 6 12 7.5c4 2 6 6.5 5 11.5-.4 1.6-2 1.8-2.6.4C13 16 10.5 12.8 6.5 11.6 5.4 11.2 5 10.2 5 9zM7 7.5C7 5.5 8 4 10 3.4l.6 1.2C9.2 5.2 8.6 6.2 8.7 7.6z";
export const chilli = (on, size = 22) => `<svg viewBox="0 0 22 22" style="width:${size}px;height:${size}px"><path d="${CHILLI}" fill="${on ? "var(--accent)" : "var(--soft)"}"/></svg>`;
export const spiceRow = (n, size = 20) => `<span class="spice" aria-label="spice ${n} of 5">${Array.from({ length: 5 }, (_, i) => chilli(i < n, size)).join("")}</span>`;

export function progressText(b) {
  const L = length(b), p = Number(b.progress) || 0;
  if (b.format === "audio") { const h = m => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`; return L ? `${h(p)} of ${h(L)}` : `${h(p)} listened`; }
  return L ? `p. ${p} of ${L}` : `p. ${p}`;
}
export const progressBar = b => `<div class="bar"><i style="width:${percent(b)}%"></i></div>`;
export const STATUS_LABEL = { reading: "Reading", tbr: "Want to read", read: "Read", dnf: "Did not finish", wish: "Wishlist" };
