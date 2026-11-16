/* ==========================================================================
   Ayat — shared site behaviour
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- Template catalogue (mirrors the studio) ---------- */
  var TEMPLATES = [
    { id: "sakina",   name: "سكينة",        bg1: "#0b3d2e", bg2: "#052018", accent: "#d4af37", text: "#f5f0e6", font: "'Amiri Quran',serif" },
    { id: "mushaf",   name: "مصحف",         bg1: "#f5ebd2", bg2: "#e8d5b5", accent: "#8b5a2b", text: "#1a1400", font: "'Amiri Quran',serif" },
    { id: "layli",    name: "ليلي",         bg1: "#0a0a14", bg2: "#000000", accent: "#f1c40f", text: "#ffffff", font: "'Amiri',serif" },
    { id: "talween",  name: "تلوين",        bg1: "#052e16", bg2: "#022c22", accent: "#22c55e", text: "#ffffff", font: "'Noto Naskh Arabic',sans-serif" },
    { id: "zakhrafa", name: "زخرفة",        bg1: "#3b0764", bg2: "#1e1b4b", accent: "#e879f9", text: "#fdf4ff", font: "'Amiri',serif" },
    { id: "glass",    name: "بطاقة زجاجية", bg1: "#0c4a6e", bg2: "#082f49", accent: "#38bdf8", text: "#ffffff", font: "'Noto Naskh Arabic',sans-serif" },
    { id: "wide",     name: "عريض 16:9",    bg1: "#7c2d12", bg2: "#431407", accent: "#f97316", text: "#ffffff", font: "'Amiri',serif" },
    { id: "kinetic",  name: "كلمة كبيرة",   bg1: "#450a0a", bg2: "#1c0a0a", accent: "#ef4444", text: "#ffffff", font: "'Amiri Quran',serif" },
    { id: "mihrab",   name: "محراب",        bg1: "#064e3b", bg2: "#022c22", accent: "#10b981", text: "#ecfdf5", font: "'Amiri',serif" },
    { id: "fajr",     name: "فجر",          bg1: "#78350f", bg2: "#451a03", accent: "#fbbf24", text: "#fff7ed", font: "'Noto Naskh Arabic',sans-serif" },
    { id: "montage",  name: "مشهد متتابع",  bg1: "#3b0764", bg2: "#1e1b4b", accent: "#a855f7", text: "#faf5ff", font: "'Amiri',serif" },
    { id: "minimal",  name: "بسيط فاخر",    bg1: "#f8fafc", bg2: "#e2e8f0", accent: "#64748b", text: "#0f172a", font: "'Noto Naskh Arabic',sans-serif" },
    { id: "mood",     name: "مزاج سينمائي", bg1: "#4c0519", bg2: "#1f0a0a", accent: "#f43f5e", text: "#fff1f2", font: "'Amiri',serif" },
    { id: "modern",   name: "عصري بسيط",    bg1: "#083344", bg2: "#042f2e", accent: "#06b6d4", text: "#ecfeff", font: "'Noto Naskh Arabic',sans-serif" },
    { id: "editorial",name: "حميمي تحريري", bg1: "#451a03", bg2: "#1c0a00", accent: "#d97706", text: "#fffbeb", font: "'Amiri',serif" },
    { id: "gold",     name: "ذهبي تقليدي",  bg1: "#faf3dc", bg2: "#e8d5a0", accent: "#d4af37", text: "#1a1400", font: "'Amiri Quran',serif" }
  ];
  window.AYAT_TEMPLATES = TEMPLATES;

  var SAMPLE = "وَقُل رَّبِّ زِدْنِي عِلْمًا";

  /* ---------- Helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Header ---------- */
  var header = $(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  var burger = $("#burger");
  var nav = $("#mainNav");
  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    $all("a", nav).forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target) && !burger.contains(e.target)) nav.classList.remove("open");
    });
  }

  /* Active nav link */
  var current = location.pathname.split("/").pop() || "index.html";
  $all(".main-nav a").forEach(function (a) {
    var href = (a.getAttribute("href") || "").split("#")[0].split("/").pop();
    if (href && href === current) a.classList.add("active");
  });

  /* ---------- Canonical / social URL ---------- */
  try {
    var canonical = document.querySelector('link[rel="canonical"]');
    var page = location.pathname + location.search;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = location.origin + page;
    var og = document.querySelector('meta[property="og:url"]');
    if (og) og.setAttribute("content", location.origin + page);
  } catch (e) { /* noop */ }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    var revealEls = $all(".reveal:not(.in)");
    if (!revealEls.length) return;
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add("in"); });
    }
  }

  /* ---------- Animated counters ---------- */
  var counters = $all("[data-count]");
  if (counters.length && "IntersectionObserver" in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var target = parseInt(el.getAttribute("data-count"), 10) || 0;
        var suffix = el.getAttribute("data-suffix") || "";
        var start = performance.now();
        var dur = 1200;
        function tick(now) {
          var p = Math.min(1, (now - start) / dur);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased).toLocaleString("en-US") + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        co.unobserve(el);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* ---------- Template cards ---------- */
  function templateCard(t) {
    return '<a class="tpl-card reveal" href="app/index.html">' +
      '<div class="tpl-preview" style="background:linear-gradient(150deg,' + t.bg1 + ',' + t.bg2 + ');color:' + t.text + ';font-family:' + t.font + '">' +
        '<span style="position:relative;z-index:1">' + esc(SAMPLE) + "</span>" +
      "</div>" +
      '<div class="tpl-name"><b>' + esc(t.name) + "</b><span>4:5 · HD</span></div>" +
      '<span class="tpl-cta"><span class="btn gold sm">استخدم القالب</span></span>' +
      "</a>";
  }
  var gridFull = $("#tplGrid");
  if (gridFull) {
    gridFull.innerHTML = TEMPLATES.map(templateCard).join("");
  }
  var gridMini = $("#tplGridMini");
  if (gridMini) {
    gridMini.innerHTML = TEMPLATES.slice(0, 8).map(templateCard).join("");
  }

  /* ---------- Users (local demo auth) ---------- */
  var USER_KEY = "ayat_user";
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch (e) { return null; }
  }
  function setUser(u) {
    try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch (e) {}
  }
  function clearUser() {
    try { localStorage.removeItem(USER_KEY); } catch (e) {}
  }

  /* ---------- Login form ---------- */
  var loginForm = $("#loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = $("#loginEmail").value.trim();
      var pass = $("#loginPass").value;
      var alertEl = $("#loginAlert");
      if (!/^\S+@\S+\.\S+$/.test(email)) return showAlert(alertEl, "أدخل بريداً إلكترونياً صحيحاً.", true);
      if (pass.length < 6) return showAlert(alertEl, "كلمة المرور يجب أن تكون 6 أحرف على الأقل.", true);
      setUser({ name: email.split("@")[0], email: email, since: new Date().toISOString().slice(0, 10) });
      showAlert(alertEl, "تم تسجيل الدخول ✓ جارٍ التحويل إلى لوحة التحكم…", false);
      setTimeout(function () { location.href = "dashboard.html"; }, 700);
    });
  }

  /* ---------- Register form ---------- */
  var registerForm = $("#registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("#regName").value.trim();
      var email = $("#regEmail").value.trim();
      var pass = $("#regPass").value;
      var alertEl = $("#regAlert");
      if (name.length < 2) return showAlert(alertEl, "أدخل اسمك.", true);
      if (!/^\S+@\S+\.\S+$/.test(email)) return showAlert(alertEl, "أدخل بريداً إلكترونياً صحيحاً.", true);
      if (pass.length < 6) return showAlert(alertEl, "كلمة المرور يجب أن تكون 6 أحرف على الأقل.", true);
      setUser({ name: name, email: email, since: new Date().toISOString().slice(0, 10) });
      showAlert(alertEl, "تم إنشاء الحساب ✓ جارٍ التحويل…", false);
      setTimeout(function () { location.href = "dashboard.html"; }, 700);
    });
  }

  /* Logout buttons */
  $all("[data-logout]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      clearUser();
      location.href = "index.html";
    });
  });

  /* Fill user name */
  $all("[data-user-name]").forEach(function (el) {
    var u = getUser();
    el.textContent = u ? u.name : "زائر";
  });

  /* ---------- Dashboard ---------- */
  var clipsWrap = $("#clipsList");
  if (clipsWrap) {
    var clips = [];
    try { clips = JSON.parse(localStorage.getItem("ayat_clips") || "[]"); } catch (e) { clips = []; }
    if (!clips.length) {
      clipsWrap.innerHTML = '<div class="empty">لا توجد مقاطع محفوظة بعد.<br><a class="btn gold sm" style="margin-top:16px" href="app/index.html">أنشئ أول مقطع</a></div>';
    } else {
      clipsWrap.innerHTML = clips.map(function (c) {
        return '<div class="clip-row">' +
          '<div class="clip-main">' +
            "<b>سورة " + esc(c.surah) + " · الآيات " + esc(c.from) + "–" + esc(c.to) + "</b>" +
            "<small>" + esc(c.reciter) + " · قالب " + esc(c.template) + " · " + esc(c.aspect) + " · " + esc(c.quality) + "p · " + esc(c.date) + "</small>" +
          "</div>" +
          '<div class="clip-actions">' +
            '<span class="chip">' + esc(c.size) + " MB</span>" +
            '<button class="btn ghost sm" data-del="' + esc(c.id) + '">حذف</button>' +
          "</div>" +
        "</div>";
      }).join("");
      $all("[data-del]", clipsWrap).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-del");
          var list = clips.filter(function (x) { return String(x.id) !== String(id); });
          try { localStorage.setItem("ayat_clips", JSON.stringify(list)); } catch (e) {}
          location.reload();
        });
      });
    }
    var statCount = $("#statClips");
    if (statCount) statCount.textContent = clips.length;
    var statExtra = $("#statExtra");
    if (statExtra) {
      var tpls = {}, mb = 0;
      clips.forEach(function (c) { tpls[c.template] = 1; mb += parseFloat(c.size) || 0; });
      statExtra.textContent = Object.keys(tpls).length;
      var statMb = $("#statMb");
      if (statMb) statMb.textContent = mb.toFixed(1);
    }
  }

  /* ---------- Contact form (Netlify Forms) ---------- */
  var contactForm = $("#contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var alertEl = $("#contactAlert");
      var data = new FormData(contactForm);
      if (data.get("bot-field")) return; // honeypot
      var name = (data.get("name") || "").toString().trim();
      var email = (data.get("email") || "").toString().trim();
      var message = (data.get("message") || "").toString().trim();
      if (name.length < 2) return showAlert(alertEl, "أدخل اسمك.", true);
      if (!/^\S+@\S+\.\S+$/.test(email)) return showAlert(alertEl, "أدخل بريداً إلكترونياً صحيحاً.", true);
      if (message.length < 5) return showAlert(alertEl, "اكتب رسالتك.", true);

      var body = new URLSearchParams();
      data.forEach(function (v, k) { body.append(k, v); });

      var btn = contactForm.querySelector('[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = "جارٍ الإرسال…"; }
      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        contactForm.reset();
        showAlert(alertEl, "تم إرسال رسالتك ✓ سنعاود التواصل قريباً.", false);
      }).catch(function () {
        // Netlify Forms may be disabled on the site; never dead-end the user.
        var mailto = "mailto:digitalproduct188@gmail.com"
          + "?subject=" + encodeURIComponent("رسالة من موقع آيات — " + ((data.get("subject") || "استفسار").toString()))
          + "&body=" + encodeURIComponent(name + " <" + email + ">\n\n" + message);
        if (alertEl) {
          alertEl.textContent = "تعذّر الإرسال الآلي. ";
          var link = document.createElement("a");
          link.href = mailto;
          link.textContent = "أرسل رسالتك بالبريد الآن";
          link.style.color = "var(--gold)";
          link.style.textDecoration = "underline";
          alertEl.appendChild(link);
          alertEl.classList.add("error");
          alertEl.classList.add("show");
        }
      }).finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = "إرسال الرسالة"; }
      });
    });
  }

  function showAlert(el, msg, isError) {
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("error", !!isError);
    el.classList.add("show");
  }

  /* ---------- Footer year ---------- */
  $all("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Pricing toggle (monthly / yearly) ---------- */
  var priceToggle = $("#priceToggle");
  if (priceToggle) {
    var proPrice = $("#proPrice");
    var proPeriod = $("#proPeriod");
    var yearly = false;
    priceToggle.addEventListener("click", function () {
      yearly = !yearly;
      priceToggle.classList.toggle("on", yearly);
      proPrice.textContent = yearly ? "3,990" : "490";
      proPeriod.textContent = yearly ? "دج / سنة (خصم 32%)" : "دج / شهر";
    });
  }

  /* ---------- Studio link (remember referral) ---------- */
  $all('a[href="app/index.html"]').forEach(function (a) {
    a.addEventListener("click", function () {
      try { localStorage.setItem("ayat_last_visit", new Date().toISOString()); } catch (e) {}
    });
  });

  /* ---------- Start reveal (after dynamic cards exist) ---------- */
  initReveal();
  window.AYAT_READY = true;
})();
