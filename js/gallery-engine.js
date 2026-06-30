// ============================================================
// Tristan Shu Gallery Engine — vanilla JS port
// Source : useGalleryEngine.ts (Next.js 16 + React 19) — 456 LOC TS
// Port : v0.1 alpha — da-prod implementation
// ============================================================

const BREATH_CONFIG = {
  micro:    { vw: 0.030, minRem: 0.5,  maxRem: 0.75 },
  phoneS:   { vw: 0.030, minRem: 0.625, maxRem: 1.25 },
  phoneL:   { vw: 0.025, minRem: 0.75, maxRem: 1.5  },
  tablet:   { vw: 0.025, minRem: 1.0,  maxRem: 2.0  },
  desktopS: { vw: 0.025, minRem: 1.25, maxRem: 2.5  },
  desktopM: { vw: 0.025, minRem: 1.5,  maxRem: 3.0  },
  ultra:    { vw: 0.020, minRem: 2.0,  maxRem: 3.5  },
  extreme:  { vw: 0.015, minRem: 3.0,  maxRem: 3.5  },
  titan:    { vw: 0.010, minRem: 3.5,  maxRem: 4.0  }
};
const CONTAINER_MAX = { micro:null, phoneS:null, phoneL:null, tablet:null, desktopS:null, desktopM:null, ultra:2400, extreme:3200, titan:4000 };

function getBreakpoint(w){
  if (w < 360) return 'micro';
  if (w < 480) return 'phoneS';
  if (w < 768) return 'phoneL';
  if (w < 1024) return 'tablet';
  if (w < 1536) return 'desktopS';
  if (w < 2560) return 'desktopM';
  if (w < 3840) return 'ultra';
  if (w < 5120) return 'extreme';
  return 'titan';
}
function getRootFontSize(){ return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; }
function calculateBreath(vw){
  const cfg = BREATH_CONFIG[getBreakpoint(vw)];
  const rfs = getRootFontSize();
  return Math.max(cfg.minRem * rfs, Math.min(cfg.maxRem * rfs, vw * cfg.vw));
}
function calculateLandscapeBreath(vw){
  const rfs = getRootFontSize();
  return Math.max(0.5 * rfs, Math.min(1.0 * rfs, vw * 0.02));
}
function calculateContainerMax(vw){ return CONTAINER_MAX[getBreakpoint(vw)]; }

function loadImageDimensions(src){
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ src, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ src, width: 1500, height: 1000 });
    img.src = src;
  });
}
async function loadGalleryImages(paths){
  return await Promise.all(paths.map(loadImageDimensions));
}

function calculateLayout(images, containerWidth, viewportWidth, viewportHeight){
  if (containerWidth === 0 || images.length === 0) return { rows: [], breath: 24 };
  const rows = [];
  let i = 0;
  const isLandscapeMobile = viewportHeight < 500 && viewportWidth > viewportHeight;
  const breath = isLandscapeMobile ? calculateLandscapeBreath(viewportWidth) : calculateBreath(viewportWidth);
  const containerMax = calculateContainerMax(viewportWidth);
  const isMobile = viewportWidth < 600;
  const isTablet = viewportWidth >= 600 && viewportWidth <= 1024;
  const isUltraWide = viewportWidth > 2000;
  const effWidth = containerMax ? Math.min(containerWidth, containerMax) : containerWidth;
  const targetHeights = [32, 35, 38, 40, 33, 37, 34, 39, 36];
  const getTargetH = (idx) => Math.floor((targetHeights[idx % 9] * viewportHeight) / 100);
  const getCeiling = () => isMobile ? viewportHeight * 0.5 : viewportHeight * 0.6;
  let rowIdx = 0;

  while (i < images.length){
    let mag = false;
    if (!isMobile){
      for (let j = i; j < Math.min(i + 5, images.length - 2); j++){
        const img = images[j];
        const rV = img.width / img.height;
        if (rV < 1.0){
          const n1 = images[j+1], n2 = images[j+2];
          const r1 = n1.width / n1.height, r2 = n2.width / n2.height;
          if (r1 > 1.2 && r2 > 1.2){
            if (j > i) break;
            const gap = breath;
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
            if (Math.round(wS) >= 300){
              rows.push({type:'magazine', gap, height: Math.round(hV),
                magazine: {vert:{img, w:Math.round(wV), h:Math.round(hV)}, top:{img:n1, w:Math.round(wS), h:Math.round(h1)}, bot:{img:n2, w:Math.round(wS), h:Math.round(h2)}}
              });
              i += 3; rowIdx++; mag = true; break;
            }
          }
        }
      }
    }
    if (mag) continue;

    const cur = images[i];
    const ratio = cur.width / cur.height;
    if (isTablet && ratio > 1.8){
      const hH = Math.floor(0.45 * viewportHeight);
      rows.push({type:'hero', gap:0, height:hH, items:[{img:cur, w:effWidth, h:hH}]});
      i++; rowIdx++; continue;
    }

    const rowItems = [];
    let widthSum = 0;
    const targetH = getTargetH(rowIdx);
    const ceiling = getCeiling();
    const gap = breath;

    while (i < images.length){
      const img = images[i];
      const r = img.width / img.height;
      const w = r * targetH;
      const hasVert = rowItems.some(it => (it.width/it.height) < 1.0) || r < 1.0;
      const maxIn = hasVert ? (isMobile ? 1 : 2) : (isMobile ? 2 : (isUltraWide ? 5 : 4));

      if (isMobile && r < 0.9 && rowItems.length === 0 && i+1 < images.length){
        const nxt = images[i+1];
        const nr = nxt.width / nxt.height;
        if (nr < 0.9){
          const avail = effWidth - gap;
          const w1 = Math.floor(avail/2), w2 = avail - w1;
          const h = Math.min(Math.floor(w1 / Math.min(r, nr)), ceiling);
          rows.push({type:'standard', gap, height:h, items:[{img, w:w1, h}, {img:nxt, w:w2, h}]});
          i += 2; rowIdx++; break;
        }
      }

      if (isMobile && rowItems.length === 0){
        const hF = Math.min(Math.round(effWidth / r), ceiling);
        const wF = Math.round(r * hF);
        rows.push({type:'single-centered', gap:0, height:hF, items:[{img, w:wF, h:hF}]});
        i++; rowIdx++; break;
      }

      if (rowItems.length > 0 && (widthSum + w + gap > effWidth || rowItems.length >= maxIn)){
        const numGaps = rowItems.length - 1;
        const availForImgs = effWidth - (numGaps * gap);
        const ratios = rowItems.map(it => it.width / it.height);
        const totalR = ratios.reduce((a,b)=>a+b, 0);
        let items, finalH, rowType = 'standard';
        if (rowItems.length === 1){
          const sc = availForImgs / widthSum;
          finalH = Math.floor(targetH * sc);
          if (finalH > ceiling) finalH = Math.floor(ceiling);
          const r0 = ratios[0];
          items = [{img: rowItems[0], w: Math.round(r0 * finalH), h: finalH}];
          rowType = 'single-centered';
        } else {
          finalH = Math.round(availForImgs / totalR);
          const softCeiling = viewportHeight * 0.8;
          if (finalH > softCeiling){ finalH = Math.floor(softCeiling); rowType = 'single-centered'; }
          let used = 0;
          items = rowItems.map((it, idx) => {
            const r = ratios[idx];
            let iw;
            if (idx === rowItems.length - 1) iw = availForImgs - used;
            else { iw = Math.round(r * finalH); used += iw; }
            return {img: it, w: iw, h: Math.round(iw / r)};
          });
          finalH = Math.max(...items.map(it => it.h));
        }
        rows.push({type: rowType, gap, height: finalH, items});
        rowIdx++; break;
      }
      rowItems.push(img);
      widthSum += w;
      i++;
      if (i === images.length){
        let finalH = targetH;
        if (finalH > ceiling) finalH = ceiling;
        const isOrphSingle = rowItems.length === 1;
        const items = rowItems.map(it => {
          const r = it.width / it.height;
          return {img: it, w: Math.round(r * finalH), h: finalH};
        });
        rows.push({type: isOrphSingle ? 'single-centered' : 'standard', gap, height: finalH, items});
        break;
      }
    }
  }
  return { rows, breath };
}

function renderGallery(container, layout){
  container.innerHTML = '';
  container.style.setProperty('--breath', layout.breath + 'px');
  for (const row of layout.rows){
    const rowEl = document.createElement('div');
    rowEl.className = 'gallery-row ' + row.type;
    rowEl.style.gap = row.gap + 'px';
    rowEl.style.height = row.height + 'px';
    if (row.type === 'magazine'){
      const v = row.magazine.vert;
      const vEl = document.createElement('div');
      vEl.className = 'gallery-item';
      vEl.style.width = v.w + 'px';
      vEl.style.height = v.h + 'px';
      vEl.innerHTML = `<img src="${encodeURI(v.img.src)}" alt="" loading="lazy">`;
      rowEl.appendChild(vEl);
      const stack = document.createElement('div');
      stack.className = 'stack';
      stack.style.gap = row.gap + 'px';
      for (const part of [row.magazine.top, row.magazine.bot]){
        const it = document.createElement('div');
        it.className = 'gallery-item';
        it.style.width = part.w + 'px';
        it.style.height = part.h + 'px';
        it.innerHTML = `<img src="${encodeURI(part.img.src)}" alt="" loading="lazy">`;
        stack.appendChild(it);
      }
      rowEl.appendChild(stack);
    } else {
      for (const it of row.items){
        const el = document.createElement('div');
        el.className = 'gallery-item';
        el.style.width = it.w + 'px';
        el.style.height = it.h + 'px';
        el.innerHTML = `<img src="${encodeURI(it.img.src)}" alt="" loading="lazy">`;
        rowEl.appendChild(el);
      }
    }
    container.appendChild(rowEl);
  }
}

window.TristanShuGallery = { loadGalleryImages, calculateLayout, renderGallery };
