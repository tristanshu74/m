// ============================================================
// Tristan Shu Gallery Engine — vanilla JS port v2
// Verdicts /ask-design-system : Vignelli + Vinh + Frost + Weinschenk
// Anti-Antalík : rigueur > "imperfections contrôlées"
// ============================================================

// --- Breath system (preserved) ---
const BREATH_CONFIG = {
  micro:{vw:0.030,minRem:0.5,maxRem:0.75}, phoneS:{vw:0.030,minRem:0.625,maxRem:1.25},
  phoneL:{vw:0.025,minRem:0.75,maxRem:1.5}, tablet:{vw:0.025,minRem:1.0,maxRem:2.0},
  desktopS:{vw:0.025,minRem:1.25,maxRem:2.5}, desktopM:{vw:0.025,minRem:1.5,maxRem:3.0},
  ultra:{vw:0.020,minRem:2.0,maxRem:3.5}, extreme:{vw:0.015,minRem:3.0,maxRem:3.5},
  titan:{vw:0.010,minRem:3.5,maxRem:4.0}
};
function getBreakpoint(w){if(w<360)return'micro';if(w<480)return'phoneS';if(w<768)return'phoneL';if(w<1024)return'tablet';if(w<1536)return'desktopS';if(w<2560)return'desktopM';if(w<3840)return'ultra';if(w<5120)return'extreme';return'titan';}
function getRootFontSize(){return parseFloat(getComputedStyle(document.documentElement).fontSize)||16;}
function calculateBreath(vw){const cfg=BREATH_CONFIG[getBreakpoint(vw)];const rfs=getRootFontSize();return Math.max(cfg.minRem*rfs,Math.min(cfg.maxRem*rfs,vw*cfg.vw));}

// PATCH BUG 2 : UNIQUE GAP TOKEN (Vignelli+Frost)
function getGap(vw){ return vw < 768 ? 16 : 24; }

// --- Image loader ---
function loadImageDimensions(src){return new Promise(res=>{const i=new Image();i.onload=()=>res({src,width:i.naturalWidth,height:i.naturalHeight});i.onerror=()=>res({src,width:1500,height:1000});i.src=src;});}
async function loadGalleryImages(paths){return await Promise.all(paths.map(loadImageDimensions));}

// PATCH BUG 3 : Math.floor + last consume exact remainder
function distributeWidths(items, rowWidth, gap, targetHeight){
  const totalGap = gap * (items.length - 1);
  const availableWidth = rowWidth - totalGap;
  const totalRatio = items.reduce((s, it) => s + (it.width / it.height), 0);
  let consumed = 0;
  return items.map((it, i) => {
    const r = it.width / it.height;
    let w;
    if (i === items.length - 1) {
      w = availableWidth - consumed;
    } else {
      w = Math.floor((r / totalRatio) * availableWidth);
      consumed += w;
    }
    const h = Math.floor(w / r);
    return { img: it, w, h };
  });
}

// PATCH BUG 5 : Pair verticales baseline — hauteurs égales
function pairVerticalsBaseline(v1, v2, rowWidth, gap){
  const r1 = v1.width / v1.height;
  const r2 = v2.width / v2.height;
  const availW = rowWidth - gap;
  const h = Math.floor(availW / (r1 + r2));
  const w1 = Math.floor(h * r1);
  const w2 = availW - w1;
  return [{ img:v1, w:w1, h }, { img:v2, w:w2, h }];
}

// PATCH BUG 4 : MAGAZINE STRICT — déclenché QUE si [V,H,H] consécutifs source
function detectMagazineStrict(images, i){
  if (i + 2 >= images.length) return null;
  const a = images[i], b = images[i+1], c = images[i+2];
  const rA = a.width / a.height, rB = b.width / b.height, rC = c.width / c.height;
  // strict consecutive : a vertical, b horizontal, c horizontal
  if (rA < 1.0 && rB > 1.2 && rC > 1.2) {
    return { vert: a, top: b, bot: c, rV: rA, r1: rB, r2: rC };
  }
  return null;
}

function buildMagazineRow(detection, effWidth, gap, viewportHeight){
  const { vert, top, bot, rV, r1, r2 } = detection;
  const denom = 1 + rV * (1/r1 + 1/r2);
  let wS = (effWidth - gap * (1 + rV)) / denom;
  let wV = effWidth - gap - wS;
  let hV = wV / rV;
  let h1 = wS / r1, h2 = wS / r2;
  const ceiling = viewportHeight * 0.8;
  if (hV > ceiling){
    const sc = ceiling / hV;
    wS *= sc; wV *= sc; hV = ceiling;
    h1 = wS / r1; h2 = wS / r2;
  }
  return {
    type: 'magazine',
    gap,
    height: Math.round(hV),
    magazine: {
      vert: { img: vert, w: Math.round(wV), h: Math.round(hV) },
      top: { img: top, w: Math.round(wS), h: Math.round(h1) },
      bot: { img: bot, w: Math.round(wS), h: Math.round(h2) }
    }
  };
}

// === MAIN LAYOUT ENGINE ===
function calculateLayout(images, containerWidth, viewportWidth, viewportHeight){
  if (containerWidth === 0 || images.length === 0) return { rows: [], gap: 24 };
  const rows = [];
  let i = 0;
  const gap = getGap(viewportWidth); // PATCH 2 : unique
  const isMobile = viewportWidth < 600;
  const isUltraWide = viewportWidth > 2000;
  const effWidth = containerWidth;
  const targetHeights = [38, 42, 40, 44, 36, 41, 39, 43, 37];
  const getTargetH = (idx) => Math.floor((targetHeights[idx % 9] * viewportHeight) / 100);
  const getCeiling = () => isMobile ? viewportHeight * 0.55 : viewportHeight * 0.6;
  let rowIdx = 0;

  while (i < images.length){
    // PATCH 4 : magazine STRICT consecutive (no lookahead-5 reorder)
    if (!isMobile){
      const mag = detectMagazineStrict(images, i);
      if (mag){
        rows.push(buildMagazineRow(mag, effWidth, gap, viewportHeight));
        i += 3; rowIdx++; continue;
      }
    }

    const cur = images[i];
    const r = cur.width / cur.height;

    // PATCH 6 : ORPHAN DERNIÈRE IMAGE = HERO CLOSING (90vh max)
    if (i === images.length - 1){
      const maxH = viewportHeight * 0.9;
      const wByH = r * maxH;
      let w, h;
      if (wByH <= effWidth){ w = Math.round(wByH); h = Math.round(maxH); }
      else { w = effWidth; h = Math.round(effWidth / r); }
      rows.push({ type: 'hero-closing', gap, height: h, items: [{ img: cur, w, h }] });
      i++; break;
    }

    // Mobile single column
    if (isMobile){
      // Check duo verticales adjacentes
      if (r < 0.9 && i+1 < images.length){
        const nxt = images[i+1];
        const nr = nxt.width / nxt.height;
        if (nr < 0.9){
          const pair = pairVerticalsBaseline(cur, nxt, effWidth, gap);
          rows.push({ type: 'vertical-pair', gap, height: pair[0].h, items: pair });
          i += 2; rowIdx++; continue;
        }
      }
      // Single full width
      const h = Math.min(Math.round(effWidth / r), getCeiling());
      rows.push({ type: 'single-centered', gap, height: h, items: [{ img: cur, w: Math.round(r*h), h }] });
      i++; rowIdx++; continue;
    }

    // Desktop : check 2 verticales adjacentes (PATCH 5 baseline)
    if (r < 0.9 && i+1 < images.length){
      const nxt = images[i+1];
      const nr = nxt.width / nxt.height;
      if (nr < 0.9){
        const pair = pairVerticalsBaseline(cur, nxt, effWidth, gap);
        rows.push({ type: 'vertical-pair', gap, height: pair[0].h, items: pair });
        i += 2; rowIdx++; continue;
      }
    }

    // Build standard row — collect images jusqu'à row complète
    const rowItems = [];
    let widthSum = 0;
    const targetH = getTargetH(rowIdx);
    const ceiling = getCeiling();

    while (i < images.length){
      // Don't pull next magazine triplet into row
      if (!isMobile && detectMagazineStrict(images, i)) break;

      const img = images[i];
      const rr = img.width / img.height;
      const w = rr * targetH;
      const hasVert = rowItems.some(it => (it.width/it.height) < 1.0) || rr < 1.0;
      const maxIn = hasVert ? 2 : (isUltraWide ? 5 : 4);

      if (rowItems.length > 0 && (widthSum + w + gap > effWidth || rowItems.length >= maxIn)){
        // PATCH 3 : distribuer avec last-child consume
        const finalH = Math.round((effWidth - (rowItems.length-1)*gap) / rowItems.reduce((s,it)=>s+(it.width/it.height),0));
        const cappedH = Math.min(finalH, ceiling);
        const items = distributeWidths(rowItems, effWidth, gap, cappedH);
        // Recompute heights based on cappedH if capped
        if (finalH > ceiling){
          items.forEach(it => { it.h = Math.round(it.w / (it.img.width/it.img.height)); });
          const maxH = Math.max(...items.map(it => it.h));
          items.forEach(it => { it.h = maxH; });
        }
        rows.push({ type: 'standard', gap, height: Math.max(...items.map(it=>it.h)), items });
        rowIdx++; break;
      }

      rowItems.push(img);
      widthSum += w;
      i++;

      if (i === images.length){
        // L'image i-1 fait partie de rowItems mais c'est PAS la dernière isolated
        // Si rowItems > 1, build row standard finale
        if (rowItems.length >= 2){
          const finalH = Math.round((effWidth - (rowItems.length-1)*gap) / rowItems.reduce((s,it)=>s+(it.width/it.height),0));
          const cappedH = Math.min(finalH, ceiling);
          const items = distributeWidths(rowItems, effWidth, gap, cappedH);
          if (finalH > ceiling){
            items.forEach(it => { it.h = Math.round(it.w / (it.img.width/it.img.height)); });
            const maxH = Math.max(...items.map(it => it.h));
            items.forEach(it => { it.h = maxH; });
          }
          rows.push({ type: 'standard', gap, height: Math.max(...items.map(it=>it.h)), items });
        } else {
          // 1 seule image en rowItems → hero closing (sera traité par early-return prochaine itération... mais on est déjà à i==length)
          const item = rowItems[0];
          const itemR = item.width / item.height;
          const maxH = viewportHeight * 0.9;
          const wByH = itemR * maxH;
          let w, h;
          if (wByH <= effWidth){ w = Math.round(wByH); h = Math.round(maxH); }
          else { w = effWidth; h = Math.round(effWidth / itemR); }
          rows.push({ type: 'hero-closing', gap, height: h, items: [{ img: item, w, h }] });
        }
        break;
      }
    }
  }
  return { rows, gap };
}

// === DOM render — PATCH 1 (centering via CSS justify-content) ===
function renderGallery(container, layout){
  container.innerHTML = '';
  container.style.setProperty('--gap', layout.gap + 'px');
  for (const row of layout.rows){
    const rowEl = document.createElement('div');
    rowEl.className = 'gallery-row ' + row.type;
    rowEl.style.gap = row.gap + 'px';
    if (row.type === 'magazine'){
      rowEl.style.height = row.height + 'px';
      const v = row.magazine.vert;
      const vEl = document.createElement('div');
      vEl.className = 'gallery-item';
      vEl.style.cssText = `width:${v.w}px;height:${v.h}px`;
      vEl.innerHTML = `<img src="${encodeURI(v.img.src)}" alt="" loading="lazy">`;
      rowEl.appendChild(vEl);
      const stack = document.createElement('div');
      stack.className = 'stack';
      stack.style.gap = row.gap + 'px';
      for (const part of [row.magazine.top, row.magazine.bot]){
        const it = document.createElement('div');
        it.className = 'gallery-item';
        it.style.cssText = `width:${part.w}px;height:${part.h}px`;
        it.innerHTML = `<img src="${encodeURI(part.img.src)}" alt="" loading="lazy">`;
        stack.appendChild(it);
      }
      rowEl.appendChild(stack);
    } else if (row.type === 'hero-closing'){
      rowEl.style.height = row.height + 'px';
      const it = row.items[0];
      const el = document.createElement('div');
      el.className = 'gallery-item';
      el.style.cssText = `width:${it.w}px;height:${it.h}px`;
      el.innerHTML = `<img src="${encodeURI(it.img.src)}" alt="" loading="lazy">`;
      rowEl.appendChild(el);
    } else {
      rowEl.style.height = row.height + 'px';
      for (const it of row.items){
        const el = document.createElement('div');
        el.className = 'gallery-item';
        el.style.cssText = `width:${it.w}px;height:${it.h}px`;
        el.innerHTML = `<img src="${encodeURI(it.img.src)}" alt="" loading="lazy">`;
        rowEl.appendChild(el);
      }
    }
    container.appendChild(rowEl);
  }
}

window.TristanShuGallery = { loadGalleryImages, calculateLayout, renderGallery };

// === LIGHTBOX (inchangé, preserved) ===
const Lightbox = {
  el:null, imgEl:null, captionEl:null, images:[], currentIdx:0,
  init(){
    if (this.el) return;
    const overlay = document.createElement('div');
    overlay.id = 'lightbox';
    overlay.innerHTML = `<button class="lb-close" aria-label="Close">✕</button><button class="lb-prev" aria-label="Previous">‹</button><button class="lb-next" aria-label="Next">›</button><div class="lb-image-wrap"><img class="lb-image" alt=""></div><div class="lb-caption"></div>`;
    document.body.appendChild(overlay);
    const style = document.createElement('style');
    style.textContent = `#lightbox{position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:1000;display:none;align-items:center;justify-content:center;opacity:0;transition:opacity .3s cubic-bezier(.22,1,.36,1);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}#lightbox.open{display:flex;opacity:1}#lightbox .lb-image-wrap{max-width:95vw;max-height:95vh;display:flex;align-items:center;justify-content:center}#lightbox .lb-image{max-width:95vw;max-height:90vh;object-fit:contain;display:block;cursor:zoom-out;border-radius:2px;transition:opacity .25s ease;opacity:1}#lightbox .lb-image.loading{opacity:.3}#lightbox .lb-close,#lightbox .lb-prev,#lightbox .lb-next{position:absolute;background:rgba(255,255,255,.08);color:#fff;border:0;cursor:pointer;font-family:-apple-system,system-ui;line-height:1;border-radius:50%;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);transition:background .2s ease,transform .2s ease}#lightbox .lb-close:hover,#lightbox .lb-prev:hover,#lightbox .lb-next:hover{background:rgba(255,255,255,.18)}#lightbox .lb-close{top:20px;right:20px;width:44px;height:44px;font-size:18px}#lightbox .lb-prev,#lightbox .lb-next{top:50%;transform:translateY(-50%);width:52px;height:52px;font-size:32px;font-weight:300}#lightbox .lb-prev{left:24px}#lightbox .lb-next{right:24px}#lightbox .lb-prev:hover{transform:translateY(-50%) translateX(-3px)}#lightbox .lb-next:hover{transform:translateY(-50%) translateX(3px)}#lightbox .lb-caption{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.6);font-size:12px;font-weight:500;letter-spacing:.04em;text-transform:uppercase;font-feature-settings:"tnum"}@media(max-width:600px){#lightbox .lb-image{max-width:100vw;max-height:85vh}#lightbox .lb-close{top:14px;right:14px;width:40px;height:40px}#lightbox .lb-prev,#lightbox .lb-next{width:44px;height:44px;font-size:26px}#lightbox .lb-prev{left:8px}#lightbox .lb-next{right:8px}}.gallery-item{cursor:zoom-in;transition:opacity .2s ease}.gallery-item:hover{opacity:.92}`;
    document.head.appendChild(style);
    this.el = overlay;
    this.imgEl = overlay.querySelector('.lb-image');
    this.captionEl = overlay.querySelector('.lb-caption');
    overlay.querySelector('.lb-close').addEventListener('click', () => this.close());
    overlay.querySelector('.lb-prev').addEventListener('click', e => { e.stopPropagation(); this.prev(); });
    overlay.querySelector('.lb-next').addEventListener('click', e => { e.stopPropagation(); this.next(); });
    overlay.addEventListener('click', e => { if (e.target === overlay || e.target.classList.contains('lb-image-wrap')) this.close(); });
    this.imgEl.addEventListener('click', () => this.close());
    document.addEventListener('keydown', e => { if (!overlay.classList.contains('open')) return; if (e.key==='Escape') this.close(); else if (e.key==='ArrowLeft') this.prev(); else if (e.key==='ArrowRight') this.next(); });
    let tsX = 0;
    overlay.addEventListener('touchstart', e => { tsX = e.touches[0].clientX; }, {passive:true});
    overlay.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - tsX; if (Math.abs(dx)>50){ if(dx>0) this.prev(); else this.next(); } }, {passive:true});
  },
  open(images, idx){ this.init(); this.images=images; this.currentIdx=idx; this.show(); requestAnimationFrame(()=>this.el.classList.add('open')); document.body.style.overflow='hidden'; },
  close(){ this.el.classList.remove('open'); setTimeout(()=>{document.body.style.overflow='';}, 300); },
  show(){ const img=this.images[this.currentIdx]; this.imgEl.classList.add('loading'); const tmp=new Image(); tmp.onload=()=>{this.imgEl.src=tmp.src;this.imgEl.classList.remove('loading');}; tmp.src=img.src; this.captionEl.textContent=`${this.currentIdx+1} / ${this.images.length}`; },
  prev(){ this.currentIdx=(this.currentIdx-1+this.images.length)%this.images.length; this.show(); },
  next(){ this.currentIdx=(this.currentIdx+1)%this.images.length; this.show(); }
};

const _origRender = renderGallery;
function renderGalleryWithLightbox(container, layout){
  _origRender(container, layout);
  const flat = [];
  for (const row of layout.rows){
    if (row.type === 'magazine'){ flat.push(row.magazine.vert.img, row.magazine.top.img, row.magazine.bot.img); }
    else if (row.items){ for (const it of row.items) flat.push(it.img); }
  }
  const items = container.querySelectorAll('.gallery-item');
  items.forEach((el, idx) => el.addEventListener('click', () => Lightbox.open(flat, idx)));
}
window.TristanShuGallery.renderGallery = renderGalleryWithLightbox;
window.TristanShuGallery.Lightbox = Lightbox;
