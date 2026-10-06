'use strict';

const GARDEN_URL = "https://garden.sugeesh.dev";
const SECTION_NAMES = {
  "journal": "Journal",
  "study-sessions": "Study Sessions",
  "experiments": "Experiments",
  "library": "Library",
  "random-thoughts": "Random Thoughts"
};
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


/*
 * sidebar toggle (mobile)
 */
const sidebar = document.querySelector("[data-sidebar]");
document.querySelector("[data-sidebar-btn]").addEventListener("click", function () {
  sidebar.classList.toggle("active");
});


/*
 * page navigation — any element with data-nav-link="<page>" switches pages
 */
const pages = document.querySelectorAll("[data-page]");
const navbarLinks = document.querySelectorAll(".navbar-link[data-nav-link]");

const showPage = function (name, push) {
  if (![...pages].some(p => p.dataset.page === name)) name = "about";

  pages.forEach(p => p.classList.toggle("active", p.dataset.page === name));
  navbarLinks.forEach(l => l.classList.toggle("active", l.dataset.navLink === name));

  if (push) {
    history.replaceState(null, "", name === "about" ? location.pathname : "#" + name);
    window.scrollTo(0, 0);
  }
};

document.querySelectorAll("[data-nav-link]").forEach(el => {
  el.addEventListener("click", () => showPage(el.dataset.navLink, true));
});

showPage(location.hash.slice(1), false);
window.addEventListener("hashchange", () => showPage(location.hash.slice(1), false));


/*
 * starfield — same generator as the greenhouse and Ask Holocron
 */
(function () {
  const host = document.querySelector("[data-stars]");
  const w = window.innerWidth;
  const h = window.innerHeight;
  const count = Math.min(160, Math.round((w * h) / 9000));
  const frag = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const star = document.createElement("span");
    star.className = "s";
    const size = Math.random() * 1.6 + 0.4;
    star.style.width = size + "px";
    star.style.height = size + "px";
    star.style.left = Math.random() * 100 + "%";
    star.style.top = Math.random() * 100 + "%";
    star.style.opacity = Math.random() * 0.5 + 0.2;
    if (!reducedMotion && Math.random() > 0.55) {
      const dur = (Math.random() * 3 + 2).toFixed(2);
      const delay = (Math.random() * 4).toFixed(2);
      star.style.animation = `twinkle ${dur}s ease-in-out ${delay}s infinite`;
    }
    // a few faintly gold stars
    if (Math.random() > 0.9) star.style.background = "hsl(45,100%,80%)";
    frag.appendChild(star);
  }
  host.appendChild(frag);
})();


/*
 * live garden sync — reads the Quartz content index + RSS from garden.sugeesh.dev.
 * The HTML already holds a snapshot, so this only upgrades it when the fetch works.
 */
const isNote = slug => slug !== "index" && !slug.endsWith("/index") && !slug.startsWith("tags/");
const sectionOf = slug => slug.split("/")[0];

const renderStats = function (index) {
  const notes = Object.keys(index).filter(isNote);
  const counts = {};
  notes.forEach(slug => { counts[sectionOf(slug)] = (counts[sectionOf(slug)] || 0) + 1; });

  const set = (sel, n) => document.querySelectorAll(sel).forEach(el => { el.textContent = n; });
  set('[data-stat="notes"]', notes.length);
  set('[data-stat="study-sessions"]', counts["study-sessions"] || 0);
  set('[data-stat="experiments"]', counts["experiments"] || 0);
  Object.keys(SECTION_NAMES).forEach(sec => set(`[data-count="${sec}"]`, counts[sec] || 0));
};

// A note's own "Date - dd/mm/yyyy" line (study sessions have one) is when it was written.
const writtenDate = function (content) {
  const m = /^\s*Date\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(content || "");
  return m ? new Date(+m[3], m[2] - 1, +m[1]) : null;
};

const firstSentence = text => (text || "").replace(/^\s*Date\s*-\s*[\d/]+\s*/, "").split(/(?<=[.!?])\s/)[0];

// RSS dates are last-modified dates, so renames and small edits look "new".
// Prefer the written date when a note has one, and leave the Library link lists out.
const renderFeed = function (index, xmlText) {
  const rss = new Map();
  if (xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    doc.querySelectorAll("item").forEach(item => {
      const link = item.querySelector("link")?.textContent.trim();
      if (!link || link.endsWith("/")) return;
      rss.set(decodeURIComponent(new URL(link).pathname.slice(1)), {
        title: item.querySelector("title")?.textContent.trim(),
        text: item.querySelector("description")?.textContent.trim(),
        date: new Date(item.querySelector("pubDate")?.textContent)
      });
    });
  }

  const source = index
    ? Object.entries(index).map(([slug, note]) => ({ slug, title: note.title, content: note.content }))
    : [...rss].map(([slug, it]) => ({ slug, title: it.title, content: it.text }));

  const items = source
    .filter(n => isNote(n.slug) && sectionOf(n.slug) !== "library")
    .map(n => {
      const written = writtenDate(n.content);
      const updated = rss.get(n.slug)?.date;
      return {
        slug: n.slug,
        title: n.title,
        text: firstSentence(rss.get(n.slug)?.text || n.content),
        date: written || (updated && !isNaN(updated) ? updated : null),
        isWritten: Boolean(written)
      };
    })
    .filter(it => it.date)
    .sort((x, y) => y.date - x.date)
    .slice(0, 6);

  if (!items.length) return;

  const list = document.querySelector("[data-garden-feed]");
  list.replaceChildren(...items.map(it => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "feed-item";
    a.href = GARDEN_URL + "/" + it.slug;

    const section = document.createElement("span");
    section.className = "feed-section";
    section.textContent = (SECTION_NAMES[sectionOf(it.slug)] || "Garden") + " · " +
      (it.isWritten ? "" : "updated ") +
      it.date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

    const title = document.createElement("span");
    title.className = "feed-title";
    title.textContent = it.title;

    const text = document.createElement("span");
    text.className = "feed-text";
    text.textContent = it.text;

    a.append(section, title, text);
    li.append(a);
    return li;
  }));
};

const syncGarden = async function () {
  const state = document.querySelector("[data-sync-state]");
  const get = (path, as) => fetch(GARDEN_URL + path).then(r => (r.ok ? r[as]() : null)).catch(() => null);

  const [index, xmlText] = await Promise.all([
    get("/static/contentIndex.json", "json"),
    get("/index.xml", "text")
  ]);

  // offline or garden unreachable: keep the snapshot already in the page
  if (!index && !xmlText) return;

  if (index) renderStats(index);
  renderFeed(index, xmlText);
  state.textContent = "Live from the garden";
  state.classList.add("live");
};

syncGarden();
