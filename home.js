/* ==========================================================
   HOME PAGE — renders ARTICLES and MAGAZINES from js/data.js
   ========================================================== */

(function () {
  "use strict";

  const TZ = (window.CONFIG && CONFIG.TIMEZONE) || "Asia/Manila";

  function parseDate(value) {
    const d = new Date(value + "T00:00:00");
    return isNaN(d) ? null : d;
  }

  function longDate(value) {
    const d = parseDate(value);
    if (!d) return value || "";
    return d.toLocaleDateString("en-PH", {
      year: "numeric", month: "long", day: "numeric", timeZone: TZ
    });
  }

  function splitDate(value) {
    const d = parseDate(value);
    if (!d) return { big: "", small: value || "" };
    return {
      big: d.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: TZ }),
      small: d.toLocaleDateString("en-PH", { year: "numeric", timeZone: TZ })
    };
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /* ---------- lead story ---------- */

  function renderLead(article) {
    const wrap = document.getElementById("lead-article");
    if (!wrap || !article) return;

    const img = document.getElementById("lead-image");
    const figure = document.getElementById("lead-link");

    if (article.image) {
      img.src = article.image;
      img.alt = article.title;
      figure.href = article.url || "#";
    } else {
      // No image supplied: swap the figure for a typographic plate.
      figure.innerHTML = "";
      figure.className = "cover";
      figure.style.aspectRatio = "4 / 3";
      figure.href = article.url || "#";
      const plate = el("span", "cover-fallback", article.kicker || "The Lewisians");
      figure.appendChild(plate);
    }

    document.getElementById("lead-kicker").textContent = article.kicker || "";
    const titleLink = document.getElementById("lead-title-link");
    titleLink.textContent = article.title;
    titleLink.href = article.url || "#";
    document.getElementById("lead-standfirst").textContent = article.standfirst || "";
    document.getElementById("lead-author").textContent = article.author ? "By " + article.author : "";
    const time = document.getElementById("lead-date");
    time.textContent = longDate(article.date);
    time.dateTime = article.date || "";
    document.getElementById("lead-read").href = article.url || "#";

    wrap.hidden = false;
  }

  /* ---------- the rest of the list ---------- */

  function renderList(articles) {
    const list = document.getElementById("story-list");
    if (!list) return;
    list.innerHTML = "";

    articles.forEach(function (a) {
      const li = el("li", "story");

      const dateCell = el("div", "story-date");
      const parts = splitDate(a.date);
      dateCell.appendChild(el("b", null, parts.big));
      dateCell.appendChild(document.createTextNode(parts.small));

      const body = el("div");
      const h = el("h3", "story-title");
      const link = el("a", null, a.title);
      link.href = a.url || "#";
      h.appendChild(link);
      body.appendChild(h);

      if (a.standfirst) body.appendChild(el("p", null, a.standfirst));

      const byline = el("p", "byline");
      if (a.kicker) byline.appendChild(el("span", null, a.kicker));
      if (a.author) byline.appendChild(el("span", null, "By " + a.author));
      body.appendChild(byline);

      li.appendChild(dateCell);
      li.appendChild(body);
      list.appendChild(li);
    });
  }

  /* ---------- magazine shelf ---------- */

  function renderMagazines(issues) {
    const shelf = document.getElementById("shelf");
    if (!shelf) return;
    shelf.innerHTML = "";

    if (!issues || !issues.length) {
      shelf.appendChild(el("p", "empty", "No issues have been posted yet."));
      return;
    }

    issues.forEach(function (m) {
      const item = el("article", "issue");

      const cover = el("a", "cover");
      cover.href = m.url || "#";
      cover.setAttribute("aria-label", "View " + m.title);

      if (m.cover) {
        const img = el("img");
        img.src = m.cover;
        img.alt = m.title + " cover";
        cover.appendChild(img);
      } else {
        cover.appendChild(el("span", "cover-fallback", m.title));
      }

      item.appendChild(cover);
      item.appendChild(el("h3", "issue-title", m.title));
      item.appendChild(el("p", "issue-meta", m.volume + " · " + longDate(m.date)));

      const read = el("a", "read", "View this issue");
      read.href = m.url || "#";
      item.appendChild(read);

      shelf.appendChild(item);
    });
  }

  /* ---------- boot ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    if (typeof ARTICLES === "undefined") return;

    const sorted = ARTICLES.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    renderLead(sorted[0]);
    renderList(sorted.slice(1));

    const count = document.getElementById("article-count");
    if (count) {
      count.textContent = sorted.length + (sorted.length === 1 ? " story" : " stories") +
        " · updated " + longDate(sorted[0].date);
    }

    if (typeof MAGAZINES !== "undefined") {
      renderMagazines(
        MAGAZINES.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
      );
    }
  });
})();
