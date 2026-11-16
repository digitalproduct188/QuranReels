# آيات Ayat — ريلز القرآن

استوديو ويب عربي (RTL) لصناعة **ريلز قرآنية** جاهزة للنشر: نص عثماني، تلاوات متعدّدة،
خلفيات فيديو، 16 قالباً، تصدير فيديو عمودي بجودة عالية — كل ذلك داخل المتصفح دون رفع
أي ملف إلى أي خادم.

الموقع صفحة ساكنة بالكامل (بدون خطوة بناء) + دالة وسيط اختيارية لتجاوز مشاكل CORS.

---

## 1) البنية

```
.
├── index.html              الصفحة الرئيسية
├── app/                    الاستوديو (التطبيق نفسه)
│   ├── index.html
│   ├── app.js              منطق التسجيل والتصدير
│   └── styles.css
├── templates.html          القوالب الـ16
├── pricing.html · about.html · help.html · contact.html · blog*.html
├── login.html · register.html · dashboard.html · privacy.html · terms.html
├── 404.html
├── styles.css · site.js · site.webmanifest
├── sitemap.xml · robots.txt
├── functions/proxy.js      وسيط CORS لـ Cloudflare Pages  (‏/proxy)
├── netlify/functions/proxy.js  نفس الوسيط لـ Netlify
├── netlify.toml            إعدادات Netlify (توجيه /proxy + الترويسات)
├── _headers                ترويسات التخزين المؤقت (Netlify + Cloudflare Pages)
├── _redirects              توجيه /app (Netlify + Cloudflare Pages)
└── set-domain.py           تبديل النطاق في كل الملفات دفعة واحدة
```

الاستوديو يعمل مباشرة من الصفحة الساكنة:

| المصدر | الاستخدام |
|---|---|
| `api.alquran.cloud` | نص القرآن العثماني + الترجمة الإنجليزية |
| `everyayah.com` | تلاوات الآيات (MP3، يدعم CORS) |
| `api.pexels.com` + `images.pexels.com` | خلفيات فيديو |

---

## 2) الرفع إلى GitHub

1. أنشئ مستودعاً جديداً (Name: `ayat-reels` مثلاً) — **بدون** README.
2. ارفع محتويات هذا المجلد إلى الفرع `main`:

```bash
git init
git add .
git commit -m "آيات Ayat — النسخة الأولى"
git branch -M main
git remote add origin https://github.com/<USERNAME>/ayat-reels.git
git push -u origin main
```

> **ملاحظة:** إن أردت النشر على GitHub Pages بمسارات مطلقة سليمة، سمِّ المستودع
> `<USERNAME>.github.io` (موقع جذر) أو استخدم Cloudflare Pages (يعمل مع أي اسم).

### تشغيل GitHub Pages

- Settings → Pages → **Source: GitHub Actions** (يوجد Workflow جاهز في
  `.github/workflows/pages.yml` يعمل تلقائياً عند كل `push`).
- أو: Source: **Deploy from a branch** → `main` / `/ (root)`.
- الرابط: `https://<USERNAME>.github.io/<REPO>/`

> GitHub Pages يقدّم الملفات الساكنة فقط، لذا `/proxy` غير متاح هناك.
> لا مشكلة: التلاوات تُجلب مباشرة من `everyayah.com` (CORS مفتوح)، والوسيط
> يُستخدم فقط كخطة بديلة عند حجب الشبكة.

---

## 3) الرفع إلى Cloudflare Pages (موصى به)

### أ) ربط المستودع (تحديث تلقائي)

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. اختر المستودع، ثم:
   - **Framework preset:** None
   - **Build command:** (اتركه فارغاً)
   - **Build output directory:** `/`
3. Deploy. ستحصل على `https://<PROJECT>.pages.dev`.
4. دالة `/proxy` تعمل تلقائياً بفضل `functions/proxy.js`.

### ب) رفع مباشر (بدون Git)

Cloudflare Dashboard → **Pages** → **Upload assets** → اسحب محتويات مجلد الموقع
(أو ملف `Ayat-cloudflare-pages.zip` الجاهز). بدون Git تُرفع الملفات كما هي، والدوال
تعمل أيضاً لأن المجلد يحتوي `functions/`.

---

## 4) تغيير النطاق (Canonical / Sitemap / OG)

بعد ربط نطاق مخصّص (مثال `ayat.example.com`):

```bash
python3 set-domain.py https://ayat.example.com
```

يحدّث الأمر: `canonical` و`og:url` و`twitter` و`sitemap.xml` و`robots.txt`
في كل الصفحات. ثم أعد الرفع.

---

## 5) التشغيل محلياً

```bash
python3 -m http.server 8080
# الموقع:   http://localhost:8080/
# الاستوديو: http://localhost:8080/app/
```

كذلك `python3 proxy.py` يشغّل وسيطاً محلياً على المنفذ 8787 عند الحاجة.

---

## 6) ملاحظات التصدير

- على الحاسوب: **MP4 (H.264/AAC)** أولاً — الأفضل ليوتيوب.
- على الهاتف (WebView): **WebM (VP9/Opus)** عند تعذّر ترميز MP4.
- الدقة: 1080p على الهاتف، وحتى 4K على سطح المكتب.

---

## الترخيص

MIT — انظر `LICENSE`.
