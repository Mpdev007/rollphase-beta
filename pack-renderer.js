/* Tab icon packs. Recolours the trim mask (the whole outline), then adds a short outer stroke.
   Body pixels, including interior gold, are left alone. */
(function () {
  const JOBS = ["home", "gyms", "partners", "feed", "profile"];
  const PACKS = [
    { id: "fight", name: "Fight night" },
    { id: "neon", name: "Neon" },
    { id: "chalk", name: "Chalk" },
    { id: "ice", name: "Ice" },
    { id: "bright", name: "Bright" }
  ];
  const images = new Map();
  const cache = new Map();
  const loading = new Map();
  let generation = 0;
  let paintedKey = "";

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      if (h < 0) h += 6;
    }
    return [h / 6, max === 0 ? 0 : d / max, max];
  }
  function hsvToRgb(h, s, v) {
    const i = Math.floor(h * 6) % 6;
    const f = h * 6 - Math.floor(h * 6);
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i].map((x) => Math.round(x * 255));
  }
  function edt1d(f) {
    const n = f.length;
    const d = new Float64Array(n);
    const v = new Int32Array(n);
    const z = new Float64Array(n + 1);
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      const dx = q - v[k];
      d[q] = dx * dx + f[v[k]];
    }
    return d;
  }
  function distanceToZero(zeroAt, w, h) {
    const INF = 1e15;
    const tmp = new Float64Array(w * h);
    const col = new Float64Array(h);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) col[y] = zeroAt[y * w + x] ? 0 : INF;
      const d = edt1d(col);
      for (let y = 0; y < h; y++) tmp[y * w + x] = d[y];
    }
    const out = new Float32Array(w * h);
    const row = new Float64Array(w);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) row[x] = tmp[y * w + x];
      const d = edt1d(row);
      for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(Math.max(0, d[x]));
    }
    return out;
  }
  function loadImage(url) {
    if (images.has(url)) return Promise.resolve(images.get(url));
    if (loading.has(url)) return loading.get(url);
    const pending = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { images.set(url, img); resolve(img); };
      img.onerror = () => resolve(null);
      img.src = url;
    });
    loading.set(url, pending);
    return pending;
  }
  function fileUrl(packId, job, trim) {
    return "packs/" + packId + "/" + job + (trim ? "-trim" : "") + ".png?v=2";
  }
  function sourceOf(packId, job) {
    const key = packId + "/" + job;
    if (cache.has(key)) return cache.get(key);
    const img = images.get(fileUrl(packId, job, false));
    const maskImg = images.get(fileUrl(packId, job, true));
    if (!img) return null;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const snap = ctx.getImageData(0, 0, w, h);
    const mask = new Uint8Array(w * h);
    if (maskImg) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(maskImg, 0, 0, w, h);
      const md = ctx.getImageData(0, 0, w, h).data;
      for (let i = 0, p = 0; i < mask.length; i++, p += 4) mask[i] = md[p];
    }
    const reachMax = 6 * (w / 104) + 8;
    const pad = Math.ceil(reachMax);
    const W = w + pad * 2;
    const H = h + pad * 2;
    const fg = new Uint8Array(W * H);
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (snap.data[(y * w + x) * 4 + 3] > 20) {
          fg[(y + pad) * W + (x + pad)] = 1;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; }
    const outside = distanceToZero(fg, W, H);
    const sheet = document.createElement("canvas");
    sheet.width = W;
    sheet.height = H;
    const base = new Uint8ClampedArray(W * H * 4);
    const maskList = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const o = ((y + pad) * W + (x + pad)) * 4;
        const q = i * 4;
        base[o] = snap.data[q];
        base[o + 1] = snap.data[q + 1];
        base[o + 2] = snap.data[q + 2];
        base[o + 3] = snap.data[q + 3];
        if (mask[i] >= 38) maskList.push(i);
      }
    }
    const strokeList = [];
    for (let i = 0; i < outside.length; i++) {
      const od = outside[i];
      if (od > 0 && od < reachMax) strokeList.push(i);
    }
    const rec = {
      w, h, W, H, pad, snap, mask, outside, sheet, base,
      maskList: new Uint32Array(maskList),
      strokeList: new Uint32Array(strokeList),
      box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
    };
    cache.set(key, rec);
    return rec;
  }
  function shiftHue(r, g, b, target, t, m) {
    const hsv = rgbToHsv(r, g, b);
    const s = hsv[1];
    const v = hsv[2];
    const floor = 0.32 + 0.55 * t;
    const lifted = Math.min(1, Math.max(s, floor) + (1 - Math.max(s, floor)) * 0.22 * t);
    const lit = Math.min(1, v * (1 + 0.4 * t) + 0.05 * t);
    return hsvToRgb(target, s + (lifted - s) * m, v + (lit - v) * m);
  }
  function renderSheet(src, hueDeg, visibility) {
    const { w, h, W, H, pad, snap, mask, outside, base, maskList, strokeList } = src;
    const out = new ImageData(W, H);
    const d = out.data;
    d.set(base);
    const s = snap.data;
    const t = Math.max(0, Math.min(1, visibility / 100));
    const target = ((hueDeg % 360) + 360) % 360 / 360;
    const reach = t * 3 * (w / 104);
    const stroke = hsvToRgb(target, 0.96, 0.92);
    const aa = 1;
    for (let n = 0; n < maskList.length; n++) {
      const i = maskList[n];
      const m = mask[i] / 255;
      const y = (i / w) | 0;
      const x = i - y * w;
      const p = ((y + pad) * W + (x + pad)) * 4;
      const q = i * 4;
      const rgb = shiftHue(s[q], s[q + 1], s[q + 2], target, t, m);
      d[p] = s[q] * (1 - m) + rgb[0] * m;
      d[p + 1] = s[q + 1] * (1 - m) + rgb[1] * m;
      d[p + 2] = s[q + 2] * (1 - m) + rgb[2] * m;
    }
    if (reach > 0.05) {
      const limit = reach + aa;
      for (let n = 0; n < strokeList.length; n++) {
        const i = strokeList[n];
        const od = outside[i];
        if (od >= limit) continue;
        const cover = od <= reach ? 1 : 1 - (od - reach) / aa;
        const p = i * 4;
        const da = d[p + 3] / 255;
        const outA = cover + da * (1 - cover);
        if (outA <= 0) continue;
        d[p] = (stroke[0] * cover + d[p] * da * (1 - cover)) / outA;
        d[p + 1] = (stroke[1] * cover + d[p + 1] * da * (1 - cover)) / outA;
        d[p + 2] = (stroke[2] * cover + d[p + 2] * da * (1 - cover)) / outA;
        d[p + 3] = Math.min(255, outA * 255);
      }
    }
    const sheetCtx = src.sheet.getContext("2d");
    sheetCtx.putImageData(out, 0, 0);
  }
  function blit(canvas, src) {
    const ctx = canvas.getContext("2d");
    const box = src.box;
    const padX = canvas.width * 0.08;
    const padTop = canvas.height * 0.06;
    const padBot = canvas.height * 0.08;
    const scale = Math.min((canvas.width - padX * 2) / box.w, (canvas.height - padTop - padBot) / box.h);
    const contentH = box.h * scale;
    const contentW = box.w * scale;
    const contentLeft = (canvas.width - contentW) / 2;
    const contentTop = canvas.height - padBot - contentH;
    const extra = src.pad;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      src.sheet,
      box.x + src.pad - extra, box.y + src.pad - extra, box.w + extra * 2, box.h + extra * 2,
      contentLeft - extra * scale, contentTop - extra * scale,
      (box.w + extra * 2) * scale, (box.h + extra * 2) * scale
    );
  }
  function paintTabs(packId, hue, vis) {
    let painted = 0;
    document.querySelectorAll("canvas.tab-pack").forEach((canvas) => {
      const src = sourceOf(packId, canvas.dataset.job);
      if (!src) return;
      renderSheet(src, hue, vis);
      blit(canvas, src);
      painted += 1;
    });
    if (painted) {
      document.querySelector(".tab-bar")?.classList.add("is-pack");
      document.documentElement.dataset.iconPack = packId;
      document.documentElement.dataset.iconPainted = packId + ":" + hue + ":" + vis;
    }
    return painted;
  }
  function ensure(packId) {
    return Promise.all(JOBS.flatMap((job) => [
      loadImage(fileUrl(packId, job, false)),
      loadImage(fileUrl(packId, job, true))
    ]));
  }
  function read(s) {
    const id = s?.iconPack || s?.pack;
    const pack = PACKS.some((p) => p.id === id) ? id : "fight";
    const hueRaw = s?.iconHue ?? s?.hue;
    const visRaw = s?.iconVis ?? s?.vis;
    const hue = Number.isFinite(Number(hueRaw)) ? Math.max(0, Math.min(360, Number(hueRaw))) : 43;
    const vis = Number.isFinite(Number(visRaw)) ? Math.max(0, Math.min(100, Number(visRaw))) : 46;
    return { pack, hue, vis };
  }
  function apply(s) {
    const next = read(s);
    const key = next.pack + ":" + next.hue + ":" + next.vis;
    if (key === paintedKey) return;
    const gen = ++generation;
    ensure(next.pack).then(() => {
      if (gen !== generation) return;
      if (paintTabs(next.pack, next.hue, next.vis)) paintedKey = key;
    });
  }

  window.IconPacks = { PACKS, JOBS, apply, read, hsvToRgb };
})();
