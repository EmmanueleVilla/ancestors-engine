/**
 * Ancestors Interactive Canvas Family Tree
 * Provides pan, zoom, smooth curves, gender-themed node cards, and PNG export.
 */

function initFamilyTree() {

  const dataScript = document.getElementById('tree-data');
  const canvas = document.getElementById('tree-canvas');
  if (!dataScript || !canvas) return;

  let graphData;
  try {
    graphData = JSON.parse(dataScript.textContent || '{}');
  } catch (e) {
    console.error('Failed to parse tree-data JSON', e);
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // View state (Pan & Zoom)
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let hasDragged = false;
  let downClientX = 0;
  let downClientY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let hoveredNode = null;
  let hoveredRing = null;
  let marriageRings = [];
  let hoveredLink = null;
  // Frecce genitore-figlio cliccabili: punti campionati lungo la curva + etichette TBC
  let linkHits = [];

  function getLinkAt(worldX, worldY, tolerance) {
    const tol = tolerance !== undefined ? tolerance : 7 / zoom;
    let best = null;
    let bestD = tol * tol;
    for (const h of linkHits) {
      if (h.rect) {
        const r = h.rect;
        if (worldX >= r.x - tol && worldX <= r.x + r.w + tol && worldY >= r.y - tol && worldY <= r.y + r.h + tol) return h.edge;
        continue;
      }
      for (const p of h.pts) {
        const d = (p.x - worldX) * (p.x - worldX) + (p.y - worldY) * (p.y - worldY);
        if (d <= bestD) {
          bestD = d;
          best = h.edge;
        }
      }
    }
    return best;
  }

  function getMarriageRingAt(worldX, worldY, tolerance = 0) {
    for (let i = marriageRings.length - 1; i >= 0; i--) {
      const r = marriageRings[i];
      const dx = worldX - r.x;
      const dy = worldY - r.y;
      const effectiveRadius = r.r + tolerance;
      if (dx * dx + dy * dy <= effectiveRadius * effectiveRadius) {
        return r;
      }
    }
    return null;
  }

  // Icone Material Symbols (Rounded, fill, Apache License 2.0), viewBox 0 -960 960 960
  const FOUND_IN_ICONS = {
    nascita: 'M584-502q19 0 32-13t13-32q0-19-13-32t-32-13q-19 0-32 13t-13 32q0 19 13 32t32 13Zm-209 0q19 0 32-13t13-32q0-19-13-32t-32-13q-19 0-32 13t-13 32q0 19 13 32t32 13Zm105 216q54 0 101-29t73-80H306q26 51 73 80t101 29Zm0 166q-74 0-139.5-28.5T226-226q-49-49-77.5-114.5T120-480q0-74 28.5-139.5T226-734q49-49 114.5-77.5T480-840q74 0 139.5 28.5T734-734q49 49 77.5 114.5T840-480q0 74-28.5 139.5T734-226q-49 49-114.5 77.5T480-120Zm15-518q29 0 44-8.5t15-24.5q0-9-6.5-14.5T530-691q-7 0-15 1.5t-20 1.5q-25 0-41.5-16.5T437-746q0-10 1.5-20.5T442-784q-14 2-26 4.5t-26 7.5q-2 5-2.5 12.5T387-746q0 46 31 77t77 31Z',
    matrimonio: 'M480-140q-11 0-22-4t-19-12l-53-49Q262-320 171-424.5T80-643q0-90 60.5-150.5T290-854q51 0 101 24.5t89 80.5q44-56 91-80.5t99-24.5q89 0 149.5 60.5T880-643q0 114-91 218.5T574-205l-53 49q-8 8-19 12t-22 4Z',
    morte: 'M440-80q-100 0-170-70t-70-170v-80q71-1 134 29t106 81v-152q-86-14-143-81t-57-157v-157q0-20 18-28t32 5l90 78 77-93q9-11 23-11t23 11l77 93 90-78q14-13 32-5t18 28v157q0 90-57 157t-143 81v152q43-51 106-81t134-29v80q0 100-70 170T520-80h-80Z',
    guerra: 'm480-161-73 54q-9 7-17.5.5T384-124l28-90-73-54q-9-7-5.5-17t14.5-10h90l25-97-140-82q-20-12-31.5-31T280-547v-273q0-25 17.5-42.5T340-880h280q25 0 42.5 17.5T680-820v273q0 23-11.5 42T637-474l-141 82 26 97h89q11 0 14.5 10t-5.5 17l-73 54 28 90q3 11-5.5 17t-17.5-1l-72-53Zm-26-659v350l30 16 30-16v-350h-60Z',
  };
  // Palette dell'archivio (vedi main.css)
  const PAL = {
    sheet: '#f1f0ea',
    card: '#fbfaf7',
    cardDirect: '#ffffff',
    ink: '#1c1b19',
    graphite: '#4f4c46',
    graphiteLight: '#6d695f',
    rule: '#b9b5a8',
    ruleLight: '#d6d3c8',
    violet: '#563c8c',
    violetVeil: 'rgba(86, 60, 140, 0.12)',
    serie: ['#c2b28a', '#2f5a45', '#a3463e', '#c79a2e', '#44699a', '#1e6b72', '#983254', '#d47828', '#5a7d32'],
  };
  const F_TITLE = '"Source Sans 3", -apple-system, "Segoe UI", sans-serif';
  const F_TEXT = '"Source Sans 3", -apple-system, "Segoe UI", sans-serif';
  const F_TYPE = '"Source Sans 3", -apple-system, "Segoe UI", sans-serif';
  const FOUND_IN_COLORS = { nascita: PAL.graphite, matrimonio: PAL.graphite, morte: PAL.graphite, guerra: PAL.graphite };
  const FOUND_IN_PATHS = {};
  for (const k of Object.keys(FOUND_IN_ICONS)) FOUND_IN_PATHS[k] = new Path2D(FOUND_IN_ICONS[k]);

  // Icone in basso a destra: in quali documenti compare il nome
  function drawFoundIn(c, pos, node) {
    const kinds = node.foundIn || [];
    if (kinds.length === 0) return;
    const size = 15;
    const gap = 3;
    let x = pos.x + cardW - 8 - kinds.length * size - (kinds.length - 1) * gap;
    const y = pos.y + cardH - size - 5;
    for (const k of kinds) {
      const path = FOUND_IN_PATHS[k];
      if (!path) continue;
      c.save();
      c.translate(x, y + size);
      c.scale(size / 960, size / 960);
      c.fillStyle = FOUND_IN_COLORS[k] || PAL.graphite;
      c.fill(path);
      c.restore();
      x += size + gap;
    }
  }

  const cardW = 190;
  const cardH = 82;
  const cardRadius = 2;

  // Node position calculation
  const nodePositions = new Map();

  function computeLayout() {
    nodePositions.clear();
    const nodes = graphData.nodes || [];

    // Master unified layout for the main family tree (5 generations)
    // Posizioni manuali dei nodi: arrivano dalla configurazione dell'archivio (archivio.config.yml, tree.positions).
    const LAYOUT = graphData.layout || {};
    const KNOWN_COORDINATES = LAYOUT.positions || {};

    const genYMap = {
      '-6': -620,
      '-5': -450,
      '-4': -280,
      '-3': -110,
      '-2': 60,
      '-1': 230,
      '0': 400,
      '1': 570,
      '2': 740,
    };

    // Track maxX per gen row to safely append any extra nodes
    const rowMaxX = {
      '-4': 670,
      '-3': -200,
      '-2': 500,
      '-1': 1600,
      '0': 1500,
      '1': 1500,
      '2': 0,
    };

    // 1. Assign known coordinates
    for (const n of nodes) {
      if (KNOWN_COORDINATES[n.id]) {
        const coord = KNOWN_COORDINATES[n.id];
        nodePositions.set(n.id, { x: coord.x, y: coord.y, node: n });
      }
    }

    // 1b. Ramo del coniuge della radice: i suoi antenati scendono verso il basso, sotto la riga dei figli,
    //     così i due rami non si contendono lo spazio quando si allargano salendo di generazione.
    //     Albero a coppie: ogni antenato sta al centro dello spazio occupato dai suoi antenati.
    const MIRROR_ROOT = LAYOUT.mirrorRootId;
    const ROOT_ID = LAYOUT.rootId;
    const MIRROR_START_X = 340;
    const SLOT = cardW + 30;
    const parentsOf = new Map();
    for (const e of graphData.edges || []) {
      if (e.type !== 'parent-child') continue;
      if (!parentsOf.has(e.to)) parentsOf.set(e.to, []);
      parentsOf.get(e.to).push(e.from);
    }
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    if (MIRROR_ROOT && ROOT_ID && nodeById.has(MIRROR_ROOT) && nodeById.has(ROOT_ID)) {
      const sexRank = (id) => {
        const sx = nodeById.get(id).sex;
        return sx === 'male' ? 0 : sx === 'female' ? 2 : 1;
      };
      const parentList = (id) =>
        (parentsOf.get(id) || []).filter((pid) => nodeById.has(pid)).sort((a, b) => sexRank(a) - sexRank(b));
      const widthMemo = new Map();
      const width = (id, depth) => {
        if (widthMemo.has(id)) return widthMemo.get(id);
        const ps = depth > 12 ? [] : parentList(id);
        const w = ps.length === 0 ? 1 : ps.reduce((sum, pid) => sum + width(pid, depth + 1), 0);
        widthMemo.set(id, w);
        return w;
      };
      const placed = new Set();
      const place = (id, depth, xStart) => {
        if (placed.has(id)) return;
        placed.add(id);
        const w = width(id, depth);
        nodePositions.set(id, { x: xStart + ((w - 1) * SLOT) / 2, y: genYMap['1'] + depth * 170, node: nodeById.get(id) });
        let x = xStart;
        for (const pid of parentList(id)) {
          place(pid, depth + 1, x);
          x += width(pid, depth + 1) * SLOT;
        }
      };
      let x = MIRROR_START_X;
      for (const pid of parentList(MIRROR_ROOT)) {
        place(pid, 1, x);
        x += width(pid, 1) * SLOT;
      }
    }

    // 2. Dynamic placement fallback for any new or unmapped nodes
    for (const n of nodes) {
      if (nodePositions.has(n.id) || n.unknownParents) continue;
      const g = String(n.generation ?? 0);
      const y = genYMap[g] !== undefined ? genYMap[g] : 400 + (n.generation ?? 0) * 170;
      const currentMaxX = rowMaxX[g] !== undefined ? rowMaxX[g] : 1600;
      const nextX = currentMaxX + cardW + 30;
      rowMaxX[g] = nextX;
      nodePositions.set(n.id, { x: nextX, y, node: n });
    }

    // 3. Segnaposto "?" dei genitori da trovare: sopra il figlio (o accanto al genitore noto),
    //    spostati a destra/sinistra finché non si sovrappongono ad altre schede.
    const gap = 30;
    const overlaps = (x, y) => {
      for (const pos of nodePositions.values()) {
        if (Math.abs(pos.y - y) < cardH + 10 && Math.abs(pos.x - x) < cardW + gap - 5) return true;
      }
      return false;
    };
    for (const n of nodes) {
      if (!n.unknownParents || nodePositions.has(n.id)) continue;
      const child = nodePositions.get(n.unknownParents.childId);
      if (!child) continue;
      const y = child.y - 170;
      let x0 = child.x;
      const known = n.unknownParents.knownParentId ? nodePositions.get(n.unknownParents.knownParentId) : null;
      if (known) x0 = known.x <= child.x ? known.x + cardW + gap : known.x - cardW - gap;
      let x = x0;
      const step = cardW + gap;
      for (let k = 1; k < 40 && overlaps(x, y); k++) {
        const off = Math.ceil(k / 2) * step * (k % 2 === 1 ? 1 : -1);
        x = x0 + (known ? (known.x <= child.x ? Math.abs(off) : -Math.abs(off)) : off);
        if (known && k > 20) x = x0 + off;
      }
      nodePositions.set(n.id, { x, y, node: n });
    }
  }

  function resizeCanvas() {
    const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : { width: 1200, height: 680 };
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width > 0 ? rect.width : 1200;
    const h = rect.height > 0 ? rect.height : 680;
    const nextW = Math.round(w * dpr);
    const nextH = Math.round(h * dpr);
    if (canvas.width === nextW && canvas.height === nextH) {
      render();
      return;
    }
    canvas.width = nextW;
    canvas.height = nextH;
    ctx.scale(dpr, dpr);
    render();
  }

  function fitAllNodes() {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : (canvas.parentElement ? canvas.parentElement.getBoundingClientRect().width : 1200) || 1200;
    const h = rect.height > 0 ? rect.height : (canvas.parentElement ? canvas.parentElement.getBoundingClientRect().height : 680) || 680;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pos of nodePositions.values()) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + cardW);
      maxY = Math.max(maxY, pos.y + cardH);
    }

    if (!isFinite(minX)) {
      panX = w / 2;
      panY = h / 2;
      zoom = 1;
      render();
      return;
    }

    const treeW = Math.max(maxX - minX, 100);
    const treeH = Math.max(maxY - minY, 100);
    const treeCenterX = (minX + maxX) / 2;
    const treeCenterY = (minY + maxY) / 2;

    const pad = 40;
    const scaleX = (w - pad * 2) / treeW;
    const scaleY = (h - pad * 2) / treeH;
    zoom = Math.min(Math.min(scaleX, scaleY), 1);
    zoom = Math.max(zoom, 0.32);

    panX = w / 2 - treeCenterX * zoom;
    panY = h / 2 - treeCenterY * zoom;
    render();
  }

  function centerOnFocusNode() {
    const focusId = graphData.focusId;
    let targetPos = null;
    if (focusId && nodePositions.has(focusId)) {
      targetPos = nodePositions.get(focusId);
    } else {
      for (const pos of nodePositions.values()) {
        if (pos.node && pos.node.isFocus) {
          targetPos = pos;
          break;
        }
      }
    }

    if (!targetPos) {
      fitAllNodes();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : (canvas.parentElement ? canvas.parentElement.getBoundingClientRect().width : 1200) || 1200;
    const h = rect.height > 0 ? rect.height : (canvas.parentElement ? canvas.parentElement.getBoundingClientRect().height : 680) || 680;
    zoom = w < 600 ? 0.62 : 0.72;
    panX = w / 2 - (targetPos.x + cardW / 2) * zoom;
    // La persona al centro sta in basso: sopra si vedono gli antenati, schede intere
    panY = h * 0.72 - (targetPos.y + cardH / 2) * zoom;
    // Le generazioni distano 170: sposta in giù quel poco che serve perché la riga in alto sia intera
    const ROW = 170;
    const topWorld = -panY / zoom;
    const off = (((topWorld - targetPos.y) % ROW) + ROW) % ROW;
    if (off > 0 && off < cardH + 12) panY += (off + 14) * zoom;
    render();
  }

  function centerOnFocus() {
    fitAllNodes();
  }

  function drawRoundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  const CONFIDENCE_LABEL = { probable: 'TBC', possible: 'TBC?', estimated: 'stima', unknown: '?' };

  function drawUncertainBadge(c, u) {
    const label = CONFIDENCE_LABEL[u.confidence] || 'TBC';
    c.save();
    c.font = `bold 10px ${F_TYPE}`;
    const w = c.measureText(label).width + 12;
    const h = 15;
    const x = u.x - w / 2;
    const y = u.y - 34;
    c.translate(u.x, y + h / 2);
    c.rotate(-0.05);
    c.translate(-u.x, -(y + h / 2));
    c.fillStyle = PAL.sheet;
    c.fillRect(x, y, w, h);
    c.strokeStyle = PAL.violet;
    c.lineWidth = 1.5;
    c.strokeRect(x, y, w, h);
    c.lineWidth = 0.75;
    c.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
    c.fillStyle = PAL.violet;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, u.x, y + h / 2 + 0.5);
    c.restore();
    return { x, y, w, h };
  }

  // Anello del matrimonio: due cerchi intrecciati, disegnati
  function drawRing(c, x, y, r, strong) {
    c.save();
    c.lineWidth = strong ? 1.8 : 1.3;
    c.strokeStyle = PAL.ink;
    c.beginPath();
    c.arc(x - r * 0.38, y, r * 0.62, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(x + r * 0.38, y, r * 0.62, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  function truncate(c, text, maxW) {
    if (c.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 2 && c.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  // Scheda di una persona: fascia in testa col colore della serie, nome, date e luogo di nascita
  function drawPersonCard(c, pos, node, isHovered) {
    const direct = !!node.isDirectLine;
    const isFocus = !!node.isFocus;
    const band = PAL.serie[node.serie || 0] || PAL.serie[0];

    c.save();
    c.shadowColor = 'rgba(28, 27, 25, 0.22)';
    c.shadowBlur = isHovered ? 14 : direct ? 6 : 3;
    c.shadowOffsetY = isHovered ? 5 : direct ? 2 : 1;
    c.fillStyle = direct ? PAL.cardDirect : PAL.card;
    c.fillRect(pos.x, pos.y, cardW, cardH);
    c.restore();

    // Bordo: inchiostro per la linea diretta, grigio per i collaterali, violetto per il soggetto
    c.lineWidth = isFocus ? 2.5 : direct ? 1.5 : 1;
    c.strokeStyle = isFocus ? PAL.violet : isHovered ? PAL.ink : direct ? PAL.ink : PAL.rule;
    c.strokeRect(pos.x + 0.5, pos.y + 0.5, cardW - 1, cardH - 1);

    // Fascia della serie
    c.fillStyle = band;
    c.fillRect(pos.x, pos.y, cardW, direct ? 8 : 5);

    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';

    // Nome
    c.fillStyle = PAL.ink;
    c.font = `${direct ? 600 : 500} 15px ${F_TITLE}`;
    c.fillText(truncate(c, node.name, cardW - (isFocus ? 52 : 22)), pos.x + 11, pos.y + 30);

    if (isFocus) {
      c.save();
      c.font = `bold 9px ${F_TYPE}`;
      c.fillStyle = PAL.violet;
      c.strokeStyle = PAL.violet;
      c.lineWidth = 1.2;
      const tx = pos.x + cardW - 34;
      const ty = pos.y + 16;
      c.translate(tx + 12, ty + 7);
      c.rotate(-0.08);
      c.strokeRect(-13, -7, 26, 14);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('TU', 0, 0.5);
      c.restore();
    }

    // Date
    c.font = `11px ${F_TYPE}`;
    c.fillStyle = PAL.graphite;
    let dateStr = '';
    if (node.isLiving) {
      dateStr = 'vivente';
    } else {
      const b = node.birthDate || node.birthYear ? `n. ${node.birthDate || node.birthYear}` : '';
      const d = node.deathDate || node.deathYear ? `† ${node.deathDate || node.deathYear}` : '';
      dateStr = [b, d].filter(Boolean).join('  ') || (node.dateText ? `n. ${node.dateText}` : 'date da trovare');
    }
    c.fillText(truncate(c, dateStr, cardW - 20), pos.x + 11, pos.y + 50);

    // Luogo
    c.font = `italic 12px ${F_TEXT}`;
    c.fillStyle = isHovered && !node.birthPlace ? PAL.violet : PAL.graphiteLight;
    const placeStr = node.birthPlace && !node.isLiving ? node.birthPlace : isHovered ? 'apri il fascicolo' : '';
    const iconsW = (node.foundIn || []).length * 18;
    if (placeStr) c.fillText(truncate(c, placeStr, cardW - 24 - iconsW), pos.x + 11, pos.y + 70);
    drawFoundIn(c, pos, node);
  }

  // Percorso a gomito per i genitori disegnati sotto il figlio: giù dal figlio, di lato, giù al genitore.
  function mirroredPath(fromPos, toPos) {
    const cX = toPos.x + cardW / 2;
    const cY = toPos.y + cardH;
    const pX = fromPos.x + cardW / 2;
    const pY = fromPos.y;
    const busY = pY - 28;
    return [{ x: cX, y: cY }, { x: cX, y: busY }, { x: pX, y: busY }, { x: pX, y: pY }];
  }

  function strokeElbow(c, pts) {
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], d = pts[i + 1];
      const r = Math.min(10, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(d.x - b.x, d.y - b.y) / 2);
      if (r < 0.5) c.lineTo(b.x, b.y);
      else c.arcTo(b.x, b.y, d.x, d.y, r);
    }
    const last = pts[pts.length - 1];
    c.lineTo(last.x, last.y);
    c.stroke();
  }

  function samplePolyline(pts) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
      for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function render() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = PAL.sheet;
    ctx.fillRect(0, 0, w, h);

    // Apply pan & zoom
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // 1. Draw Edges
    marriageRings = [];
    linkHits = [];
    const uncertainChildren = new Map();
    const edges = graphData.edges || [];
    for (const edge of edges) {
      const fromPos = nodePositions.get(edge.from);
      const toPos = nodePositions.get(edge.to);
      if (!fromPos || !toPos) continue;

      if (edge.type === 'spouse') {
        // Horizontal marriage line
        const leftNode = fromPos.x < toPos.x ? fromPos : toPos;
        const rightNode = fromPos.x < toPos.x ? toPos : fromPos;
        const x1 = leftNode.x + cardW;
        const y1 = leftNode.y + cardH / 2;
        const x2 = rightNode.x;
        const y2 = rightNode.y + cardH / 2;

        ctx.strokeStyle = PAL.ink;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x1, y1 - 2);
        ctx.lineTo(x2, y2 - 2);
        ctx.moveTo(x1, y1 + 2);
        ctx.lineTo(x2, y2 + 2);
        ctx.stroke();

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const hasSource = !!(edge.sourceTitle || edge.sourceUrl || (edge.media && edge.media.length > 0));
        const isRingHovered = hoveredRing && hoveredRing.edge === edge;
        const hasPending = edge.research && edge.research.some((r) => r.outcome === 'awaiting_reply' || r.outcome === 'in_attesa');
        const hasResearch = edge.research && edge.research.length > 0;

        ctx.fillStyle = isRingHovered ? '#ffffff' : PAL.sheet;
        ctx.beginPath();
        ctx.arc(midX, midY, isRingHovered ? 15 : 13, 0, Math.PI * 2);
        ctx.fill();
        if (hasSource || isRingHovered) {
          ctx.strokeStyle = hasSource ? PAL.ink : PAL.rule;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        drawRing(ctx, midX, midY, isRingHovered ? 9 : 8, hasSource);

        // Richiesta in attesa: cerchietto violetto tratteggiato. Solo ricerche, senza atto: punto grafite.
        if (hasPending) {
          ctx.save();
          ctx.strokeStyle = PAL.violet;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.arc(midX, midY, 18, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else if (!hasSource && hasResearch) {
          ctx.fillStyle = PAL.graphite;
          ctx.beginPath();
          ctx.arc(midX + 11, midY - 10, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        marriageRings.push({ x: midX, y: midY, r: 18, edge });
      } else if (edge.type === 'parent-child') {
        // Cubic Bézier curve from parent down to child
        const pX = fromPos.x + cardW / 2;
        const pY = fromPos.y + cardH;
        const cX = toPos.x + cardW / 2;
        const cY = toPos.y;

        const entryX = fromPos.x < cX - 15 ? cX - 10 : (fromPos.x > cX + 15 ? cX + 10 : cX);

        // Genitore sotto il figlio (ramo del coniuge): linea a gomito dal fondo del figlio
        // alla testa del genitore, passando nello spazio libero sopra la riga dei genitori.
        if (fromPos.y > toPos.y + 1) {
          const pts = mirroredPath(fromPos, toPos);
          const uncertainM = !!edge.confidence;
          const hoveredM = hoveredLink === edge;
          const directM = !!(fromPos.node.isDirectLine && toPos.node.isDirectLine);
          ctx.save();
          if (edge.unknownParent) {
            ctx.strokeStyle = PAL.rule;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 4]);
          } else {
            ctx.strokeStyle = uncertainM || hoveredM ? PAL.violet : directM ? PAL.ink : PAL.rule;
            ctx.lineWidth = hoveredM ? 3 : directM ? 2.4 : 1.2;
            if (uncertainM) ctx.setLineDash([6, 5]);
          }
          strokeElbow(ctx, pts);
          ctx.restore();
          if (edge.unknownParent) continue;
          if (uncertainM) uncertainChildren.set(edge.to, { x: pts[0].x, y: pts[0].y + 40, confidence: edge.confidence, edge });
          linkHits.push({ edge, pts: samplePolyline(pts) });
          ctx.fillStyle = uncertainM ? PAL.violet : directM ? PAL.ink : PAL.rule;
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, directM ? 3 : 2.2, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        if (edge.unknownParent) {
          ctx.save();
          ctx.strokeStyle = PAL.rule;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(pX, pY);
          ctx.bezierCurveTo(pX, pY + 45, cX, cY - 45, cX, cY);
          ctx.stroke();
          ctx.restore();
          continue;
        }

        const uncertain = !!edge.confidence;
        const isLinkHovered = hoveredLink === edge;
        const directLink = !!(fromPos.node.isDirectLine && toPos.node.isDirectLine);
        ctx.strokeStyle = uncertain ? PAL.violet : isLinkHovered ? PAL.violet : directLink ? PAL.ink : PAL.rule;
        ctx.lineWidth = isLinkHovered ? 3 : directLink ? 2.4 : 1.2;
        if (uncertain) ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(pX, pY);
        ctx.bezierCurveTo(pX, pY + 45, entryX, cY - 45, entryX, cY);
        ctx.stroke();
        ctx.setLineDash([]);
        if (uncertain) uncertainChildren.set(edge.to, { x: cX, y: cY, confidence: edge.confidence, edge });

        // Punti della curva per il clic (Bézier cubica campionata)
        const pts = [];
        for (let i = 0; i <= 16; i++) {
          const t = i / 16;
          const mt = 1 - t;
          const x = mt * mt * mt * pX + 3 * mt * mt * t * pX + 3 * mt * t * t * entryX + t * t * t * entryX;
          const y = mt * mt * mt * pY + 3 * mt * mt * t * (pY + 45) + 3 * mt * t * t * (cY - 45) + t * t * t * cY;
          pts.push({ x, y });
        }
        linkHits.push({ edge, pts });

        // Arrow dot
        ctx.fillStyle = uncertain ? PAL.violet : directLink ? PAL.ink : PAL.rule;
        ctx.beginPath();
        ctx.arc(entryX, cY, directLink ? 3 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Etichetta "TBC" sui legami genitore-figlio non ancora provati
    for (const u of uncertainChildren.values()) {
      const rect = drawUncertainBadge(ctx, u);
      if (rect) linkHits.unshift({ edge: u.edge, rect });
    }

    // 2. Draw Nodes
    for (const [id, pos] of nodePositions) {
      const node = pos.node;
      const isHovered = hoveredNode && hoveredNode.id === id;
      const isFocus = node.isFocus;
      if (node.isPlaceholder) {
        drawPlaceholderCard(ctx, pos, node, isHovered);
        continue;
      }

      drawPersonCard(ctx, pos, node, isHovered);
    }

    ctx.restore();
  }

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    // Convert to world space
    const worldX = (canvasX - panX) / zoom;
    const worldY = (canvasY - panY) / zoom;
    return { canvasX, canvasY, worldX, worldY };
  }

  // Scheda per fratelli/sorelle noti ma non ricercati: tratteggiata, non cliccabile.
  function drawUnknownParentsCard(c, pos, node, isHovered) {
    const info = node.unknownParents;
    const hasPlan = !!info.nextStep;
    c.save();
    c.fillStyle = isHovered ? '#ffffff' : 'rgba(251, 250, 247, 0.6)';
    drawRoundRect(c, pos.x, pos.y, cardW, cardH, cardRadius);
    c.fill();
    c.setLineDash([5, 4]);
    c.lineWidth = isHovered ? 1.8 : 1.3;
    c.strokeStyle = hasPlan ? PAL.violet : PAL.rule;
    drawRoundRect(c, pos.x, pos.y, cardW, cardH, cardRadius);
    c.stroke();
    c.setLineDash([]);
    // Grande "?"
    c.fillStyle = hasPlan ? PAL.violet : PAL.rule;
    c.font = `500 40px ${F_TITLE}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('?', pos.x + 26, pos.y + cardH / 2 + 1);
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = PAL.ink;
    c.font = `600 14px ${F_TITLE}`;
    c.fillText(truncate(c, node.name.replace(/^\?\s*/, ''), cardW - 60), pos.x + 50, pos.y + 12);
    c.font = `11px ${F_TYPE}`;
    c.fillStyle = PAL.graphite;
    let label = node.dateText || '';
    while (label.length > 4 && c.measureText(label).width > cardW - 60) label = label.slice(0, -2);
    if (label !== node.dateText) label += '…';
    c.fillText(label, pos.x + 50, pos.y + 32);
    c.font = `italic 12px ${F_TEXT}`;
    c.fillStyle = hasPlan ? PAL.violet : PAL.graphiteLight;
    c.fillText(hasPlan ? 'cosa serve per trovarli' : 'piano da definire', pos.x + 50, pos.y + 56);
    c.restore();
  }

  function drawPlaceholderCard(c, pos, node, isHovered) {
    if (node.unknownParents) {
      drawUnknownParentsCard(c, pos, node, isHovered);
      return;
    }
    c.save();
    c.fillStyle = 'rgba(251, 250, 247, 0.6)';
    drawRoundRect(c, pos.x, pos.y, cardW, cardH, cardRadius);
    c.fill();
    c.setLineDash([5, 4]);
    c.lineWidth = 1.2;
    c.strokeStyle = PAL.rule;
    drawRoundRect(c, pos.x, pos.y, cardW, cardH, cardRadius);
    c.stroke();
    c.setLineDash([]);
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = PAL.ink;
    c.font = `600 14px ${F_TITLE}`;
    c.fillText(node.name, pos.x + 12, pos.y + 12);
    if (node.dateText) {
      c.font = `11px ${F_TYPE}`;
      c.fillStyle = PAL.graphite;
      c.fillText(node.dateText, pos.x + 12, pos.y + 36);
    }
    c.font = `italic 12px ${F_TEXT}`;
    c.fillStyle = PAL.graphiteLight;
    c.fillText('noti, non ricercati', pos.x + 12, pos.y + 56);
    c.restore();
  }

  function getNodeAt(worldX, worldY) {
    for (const [id, pos] of nodePositions) {
      if (pos.node.isPlaceholder && !pos.node.unknownParents) continue;
      if (
        worldX >= pos.x &&
        worldX <= pos.x + cardW &&
        worldY >= pos.y &&
        worldY <= pos.y + cardH
      ) {
        return pos.node;
      }
    }
    return null;
  }

  // Mouse / Touch Event Listeners
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    hasDragged = false;
    downClientX = e.clientX;
    downClientY = e.clientY;
    dragStartX = e.clientX - panX;
    dragStartY = e.clientY - panY;
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      canvas.style.cursor = hoveredRing || hoveredNode || hoveredLink ? 'pointer' : 'grab';
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
      if (Math.hypot(e.clientX - downClientX, e.clientY - downClientY) > 5) {
        hasDragged = true;
      }
      panX = e.clientX - dragStartX;
      panY = e.clientY - dragStartY;
      render();
      return;
    }

    const { worldX, worldY } = getMousePos(e);
    const ring = getMarriageRingAt(worldX, worldY);
    const node = getNodeAt(worldX, worldY);
    const link = !ring && !node ? getLinkAt(worldX, worldY) : null;
    if (ring !== hoveredRing || node !== hoveredNode || link !== hoveredLink) {
      hoveredRing = ring;
      hoveredNode = node;
      hoveredLink = link;
      canvas.style.cursor = (hoveredRing || hoveredNode || hoveredLink) ? 'pointer' : 'grab';
      render();
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const { canvasX, canvasY, worldX, worldY } = getMousePos(e);
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.35), 2.5);

    // Zoom towards mouse pointer
    panX = canvasX - worldX * newZoom;
    panY = canvasY - worldY * newZoom;
    zoom = newZoom;
    render();
  }, { passive: false });

  canvas.addEventListener('click', (e) => {
    if (hasDragged) {
      hasDragged = false;
      return;
    }
    const { worldX, worldY } = getMousePos(e);
    const ring = getMarriageRingAt(worldX, worldY);
    if (ring) {
      openMarriageModal(ring.edge);
      return;
    }
    const node = getNodeAt(worldX, worldY);
    if (node && node.unknownParents) {
      openUnknownParentsModal(node);
      return;
    }
    if (node && node.url) {
      window.location.href = node.url;
      return;
    }
    const link = getLinkAt(worldX, worldY);
    if (link) openLinkModal(link);
  });

  // Touch Event Listeners (Mobile & Tablet: Pan, Pinch-to-Zoom, Tap)
  let isTouchDragging = false;
  let touchHasDragged = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchDragStartX = 0;
  let touchDragStartY = 0;
  let lastTouchDist = 0;
  let lastMidX = 0;
  let lastMidY = 0;

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      isTouchDragging = true;
      touchHasDragged = false;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchDragStartX = touch.clientX - panX;
      touchDragStartY = touch.clientY - panY;
      lastTouchDist = 0;
    } else if (e.touches.length === 2) {
      touchHasDragged = true;
      isTouchDragging = true;
      const rect = canvas.getBoundingClientRect();
      lastMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      lastMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      lastTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isTouchDragging) {
      const touch = e.touches[0];
      if (Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY) > 8) {
        touchHasDragged = true;
      }
      panX = touch.clientX - touchDragStartX;
      panY = touch.clientY - touchDragStartY;
      render();
    } else if (e.touches.length === 2) {
      touchHasDragged = true;
      const rect = canvas.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );

      if (lastTouchDist > 0 && dist > 5) {
        const scale = dist / lastTouchDist;
        const newZoom = Math.min(Math.max(zoom * scale, 0.35), 2.5);
        const worldX = (lastMidX - panX) / zoom;
        const worldY = (lastMidY - panY) / zoom;

        zoom = newZoom;
        panX = midX - worldX * zoom;
        panY = midY - worldY * zoom;
        render();
      }
      lastTouchDist = dist;
      lastMidX = midX;
      lastMidY = midY;
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
      if (!touchHasDragged && isTouchDragging && e.changedTouches && e.changedTouches.length === 1) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const canvasX = touch.clientX - rect.left;
        const canvasY = touch.clientY - rect.top;
        const worldX = (canvasX - panX) / zoom;
        const worldY = (canvasY - panY) / zoom;

        // Try marriage ring first with hit tolerance
        const ring = getMarriageRingAt(worldX, worldY, 8 / zoom);
        if (ring) {
          openMarriageModal(ring.edge);
        } else {
          const node = getNodeAt(worldX, worldY);
          if (node && node.unknownParents) {
            openUnknownParentsModal(node);
          } else if (node && node.url) {
            window.location.href = node.url;
          } else {
            const link = getLinkAt(worldX, worldY, 14 / zoom);
            if (link) openLinkModal(link);
          }
        }
      }
      isTouchDragging = false;
      touchHasDragged = false;
      lastTouchDist = 0;
    } else if (e.touches.length === 1) {
      // Transition from 2 fingers to 1 finger: recalibrate pan anchor
      const touch = e.touches[0];
      touchDragStartX = touch.clientX - panX;
      touchDragStartY = touch.clientY - panY;
      lastTouchDist = 0;
    }
  }, { passive: false });

  canvas.addEventListener('touchcancel', () => {
    isTouchDragging = false;
    touchHasDragged = false;
    lastTouchDist = 0;
  });

  // Toolbar Buttons
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnFitAll = document.getElementById('btn-fit-all');
  const btnReset = document.getElementById('btn-reset-zoom');
  const btnFocus = document.getElementById('btn-focus-person');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnExport = document.getElementById('btn-export-png');
  const treeSection = document.getElementById('tree-canvas-section');

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const worldX = (cx - panX) / zoom;
      const worldY = (cy - panY) / zoom;
      zoom = Math.min(zoom * 1.25, 2.5);
      panX = cx - worldX * zoom;
      panY = cy - worldY * zoom;
      render();
    });
  }

  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const worldX = (cx - panX) / zoom;
      const worldY = (cy - panY) / zoom;
      zoom = Math.max(zoom / 1.25, 0.25);
      panX = cx - worldX * zoom;
      panY = cy - worldY * zoom;
      render();
    });
  }

  if (btnFitAll) {
    btnFitAll.addEventListener('click', fitAllNodes);
  }

  if (btnReset) {
    btnReset.addEventListener('click', centerOnFocusNode);
  }

  if (btnFocus) {
    btnFocus.addEventListener('click', centerOnFocusNode);
  }

  function updateFullscreenBtn() {
    if (!btnFullscreen) return;
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    btnFullscreen.textContent = isFs ? 'Esci da schermo intero' : 'Schermo intero';
    btnFullscreen.setAttribute('title', isFs ? 'Esci da schermo intero' : 'Schermo intero');
    btnFullscreen.setAttribute('aria-label', isFs ? 'Esci da schermo intero' : 'Schermo intero');
  }

  if (btnFullscreen && treeSection) {
    btnFullscreen.addEventListener('click', () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (!isFs) {
        if (treeSection.requestFullscreen) {
          treeSection.requestFullscreen().catch(() => {});
        } else if (treeSection.webkitRequestFullscreen) {
          treeSection.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    });

    document.addEventListener('fullscreenchange', () => {
      updateFullscreenBtn();
      resizeCanvas();
    });
    document.addEventListener('webkitfullscreenchange', () => {
      updateFullscreenBtn();
      resizeCanvas();
    });
  }

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      // Find bounding box of all nodes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const pos of nodePositions.values()) {
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + cardW);
        maxY = Math.max(maxY, pos.y + cardH);
      }

      const padding = 60;
      const expW = Math.max(maxX - minX + padding * 2, 800);
      const expH = Math.max(maxY - minY + padding * 2, 600);

      const expCanvas = document.createElement('canvas');
      expCanvas.width = expW * 2; // 2x Retina resolution
      expCanvas.height = expH * 2;
      const expCtx = expCanvas.getContext('2d');
      if (!expCtx) return;

      expCtx.scale(2, 2);

      // Background
      expCtx.fillStyle = PAL.sheet;
      expCtx.fillRect(0, 0, expW, expH);

      // Title header on exported image
      const focusPos = nodePositions.get(graphData.focusId);
      const titleName = focusPos ? focusPos.node.name : 'Albero Genealogico';
      expCtx.font = `600 24px ${F_TITLE}`;
      expCtx.fillStyle = PAL.ink;
      expCtx.textAlign = 'center';
      expCtx.fillText(`Albero di ${titleName}`, expW / 2, 38);

      // Translate context to center the tree with padding
      expCtx.translate(-minX + padding, -minY + padding + 20);

      // Draw edges
      const expUncertain = new Map();
      for (const edge of graphData.edges || []) {
        const fromPos = nodePositions.get(edge.from);
        const toPos = nodePositions.get(edge.to);
        if (!fromPos || !toPos) continue;

        if (edge.type === 'spouse') {
          const leftNode = fromPos.x < toPos.x ? fromPos : toPos;
          const rightNode = fromPos.x < toPos.x ? toPos : fromPos;
          expCtx.strokeStyle = PAL.ink;
          expCtx.lineWidth = 1.2;
          expCtx.beginPath();
          expCtx.moveTo(leftNode.x + cardW, leftNode.y + cardH / 2 - 2);
          expCtx.lineTo(rightNode.x, rightNode.y + cardH / 2 - 2);
          expCtx.moveTo(leftNode.x + cardW, leftNode.y + cardH / 2 + 2);
          expCtx.lineTo(rightNode.x, rightNode.y + cardH / 2 + 2);
          expCtx.stroke();
          const mx = (leftNode.x + cardW + rightNode.x) / 2;
          const my = leftNode.y + cardH / 2;
          expCtx.fillStyle = PAL.sheet;
          expCtx.beginPath();
          expCtx.arc(mx, my, 13, 0, Math.PI * 2);
          expCtx.fill();
          drawRing(expCtx, mx, my, 8, true);
        } else if (edge.type === 'parent-child') {
          const expDirect = fromPos.node.isDirectLine && toPos.node.isDirectLine;
          expCtx.strokeStyle = edge.confidence ? PAL.violet : edge.unknownParent ? PAL.rule : expDirect ? PAL.ink : PAL.rule;
          expCtx.lineWidth = expDirect ? 2.4 : 1.2;
          expCtx.setLineDash(edge.unknownParent ? [3, 4] : edge.confidence ? [6, 5] : []);
          if (edge.confidence) expUncertain.set(edge.to, { x: toPos.x + cardW / 2, y: toPos.y, confidence: edge.confidence });
          expCtx.beginPath();
          expCtx.moveTo(fromPos.x + cardW / 2, fromPos.y + cardH);
          expCtx.bezierCurveTo(
            fromPos.x + cardW / 2,
            fromPos.y + cardH + 35,
            toPos.x + cardW / 2,
            toPos.y - 35,
            toPos.x + cardW / 2,
            toPos.y
          );
          expCtx.stroke();
        }
      }

      expCtx.setLineDash([]);
      for (const u of expUncertain.values()) drawUncertainBadge(expCtx, u);

      // Draw nodes
      for (const [id, pos] of nodePositions) {
        const node = pos.node;
        const isFocus = node.isFocus;
        if (node.isPlaceholder) {
          drawPlaceholderCard(expCtx, pos, node);
          continue;
        }

        drawPersonCard(expCtx, pos, node, false);
      }

      // Trigger download
      const link = document.createElement('a');
      link.download = `albero-${titleName.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = expCanvas.toDataURL('image/png');
      link.click();
    });
  }

  // Initialize
  computeLayout();
  resizeCanvas();
  centerOnFocusNode();
  // Il canvas non ridisegna da solo quando arrivano i font: aspettali e ridisegna
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load(`600 15px ${F_TITLE}`),
      document.fonts.load(`500 15px ${F_TITLE}`),
      document.fonts.load(`12px ${F_TYPE}`),
      document.fonts.load(`bold 10px ${F_TYPE}`),
      document.fonts.load(`italic 12px ${F_TEXT}`),
    ]).then(() => render(), () => {});
  }
  window.addEventListener('resize', () => {
    resizeCanvas();
  });
  if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
    const ro = new ResizeObserver(() => {
      resizeCanvas();
    });
    ro.observe(canvas.parentElement);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.openMarriageModal = function(edge) {
    const modal = document.getElementById('marriage-modal');
    if (!modal) return;

    const iconEl = document.getElementById('modal-icon');
    if (iconEl) iconEl.textContent = '';
    const linkSources = document.getElementById('modal-link-sources');
    if (linkSources) linkSources.style.display = 'none';
    const noSrc = document.getElementById('modal-marriage-no-source');
    if (noSrc) noSrc.innerText = 'Nessuna fonte archiviata per questa unione.';

    // Titles
    const titleEl = document.getElementById('modal-marriage-title');
    const subtitleEl = document.getElementById('modal-marriage-subtitle');
    const p1Name = edge.spouse1Name || 'Coniuge 1';
    const p2Name = edge.spouse2Name || 'Coniuge 2';
    if (titleEl) titleEl.innerText = `${p1Name} e ${p2Name}`;
    if (subtitleEl) subtitleEl.innerText = edge.marriageDate ? `Matrimonio · ${edge.marriageDate}` : 'Matrimonio';

    // Meta badges (Date, Place)
    const metaEl = document.getElementById('modal-marriage-meta');
    if (metaEl) {
      let badges = '';
      if (edge.marriageDate) {
        badges += `<span class="modal-meta">${escapeHtml(edge.marriageDate)}</span>`;
      }
      if (edge.marriagePlace) {
        badges += `<span class="modal-meta">${escapeHtml(edge.marriagePlace)}</span>`;
      }
      metaEl.innerHTML = badges;
    }

    // Notes
    const notesBox = document.getElementById('modal-marriage-notes-box');
    const notesEl = document.getElementById('modal-marriage-notes');
    if (edge.notes && edge.notes.length > 0) {
      if (notesEl) notesEl.innerHTML = edge.notes.map(n => `<p>${escapeHtml(n)}</p>`).join('');
      if (notesBox) notesBox.style.display = 'block';
    } else {
      if (notesBox) notesBox.style.display = 'none';
    }

    // Source Box
    const sourceBox = document.getElementById('modal-marriage-source-box');
    const noSourceBox = document.getElementById('modal-marriage-no-source');
    if (edge.sourceTitle || edge.sourceUrl) {
      if (sourceBox) sourceBox.style.display = 'block';
      if (noSourceBox) noSourceBox.style.display = 'none';

      const titleSrc = document.getElementById('modal-source-title');
      if (titleSrc) titleSrc.innerText = edge.sourceTitle || 'Atto di Matrimonio';

      const callNumberEl = document.getElementById('modal-source-callnumber');
      if (callNumberEl) {
        callNumberEl.innerText = edge.sourceCallNumber || '';
        callNumberEl.style.display = edge.sourceCallNumber ? 'inline-block' : 'none';
      }

      const pageEl = document.getElementById('modal-source-page');
      if (pageEl) {
        pageEl.innerText = edge.sourcePage ? `Dettagli: ${edge.sourcePage}` : '';
        pageEl.style.display = edge.sourcePage ? 'block' : 'none';
      }

      const portalLink = document.getElementById('modal-source-portal-link');
      if (portalLink) {
        if (edge.sourceUrl) {
          portalLink.href = edge.sourceUrl;
          portalLink.style.display = 'inline-block';
        } else {
          portalLink.style.display = 'none';
        }
      }

      const localLink = document.getElementById('modal-source-local-link');
      if (localLink) {
        if (edge.sourcePageUrl) {
          localLink.href = edge.sourcePageUrl;
          localLink.style.display = 'inline-block';
        } else {
          localLink.style.display = 'none';
        }
      }
    } else {
      if (sourceBox) sourceBox.style.display = 'none';
      if (noSourceBox) noSourceBox.style.display = 'block';
    }

    // Media Box
    const mediaBox = document.getElementById('modal-marriage-media-box');
    const mediaList = document.getElementById('modal-marriage-media-list');
    if (mediaList) mediaList.innerHTML = '';
    if (edge.media && edge.media.length > 0 && mediaList) {
      for (const m of edge.media) {
        const a = document.createElement('a');
        a.href = m.url;
        a.target = '_blank';
        a.title = m.title || '';
        if (m.isPdf) {
          a.className = 'media-pdf-tile';
          const icon = document.createElement('span');
          icon.className = 'media-pdf-icon';
          icon.textContent = 'PDF';
          const label = document.createElement('span');
          label.textContent = m.title || 'Apri documento PDF';
          a.append(icon, label);
        } else {
          a.className = 'marriage-media-item';
          const img = document.createElement('img');
          img.src = m.url;
          img.alt = m.title || 'Scansione atto di matrimonio';
          img.loading = 'lazy';
          a.appendChild(img);
          if (m.title) {
            const cap = document.createElement('span');
            cap.className = 'marriage-media-caption';
            cap.textContent = m.title;
            a.appendChild(cap);
          }
        }
        mediaList.appendChild(a);
      }
      if (mediaBox) mediaBox.style.display = 'block';
    } else {
      if (mediaBox) mediaBox.style.display = 'none';
    }

    // Pending requests: prominent banner at the top of the modal
    const pendingBox = document.getElementById('modal-marriage-pending-box');
    const pendingList = document.getElementById('modal-marriage-pending-list');
    const pending = (edge.research || []).filter((r) => r.outcome === 'awaiting_reply' || r.outcome === 'in_attesa');
    if (pending.length > 0) {
      if (pendingList) {
        pendingList.innerHTML = pending.map((r) => {
          const who = escapeHtml(r.source || r.place || 'Richiesta');
          const what = r.register ? ` — ${escapeHtml(r.register)}` : '';
          const when = r.date ? `<span class="pending-date">inviata il ${escapeHtml(r.date.split('-').reverse().join('/'))}</span>` : '';
          return `<li><strong>${who}</strong>${what} ${when}</li>`;
        }).join('');
      }
      if (pendingBox) pendingBox.style.display = 'block';
    } else if (pendingBox) {
      pendingBox.style.display = 'none';
    }

    // Research log (where we already searched)
    const researchBox = document.getElementById('modal-marriage-research-box');
    const researchList = document.getElementById('modal-marriage-research-list');
    if (edge.research && edge.research.length > 0) {
      const outcomeLabels = {
        found: 'Trovato',
        trovato: 'Trovato',
        not_found: 'Non trovato',
        non_trovato: 'Non trovato',
        partial: 'Parziale',
        parziale: 'Parziale',
        awaiting_reply: 'In attesa',
        in_attesa: 'In attesa',
        not_available: 'Registro non disponibile',
        non_disponibile: 'Registro non disponibile',
        withdrawn: 'Richiesta ritirata',
        ritirata: 'Richiesta ritirata',
        delivery_failed: 'Mail non recapitata',
        non_recapitata: 'Mail non recapitata',
        planned: 'Da cercare',
        pianificata: 'Da cercare',
      };
      // Paradati: da chi e come è stata fatta la ricerca.
      const actorLabels = {
        user: 'ricercatore',
        utente: 'ricercatore',
        assistant: 'assistente AI',
        assistente: 'assistente AI',
        user_and_assistant: 'ricercatore e assistente AI',
        utente_e_assistente: 'ricercatore e assistente AI',
        institution: 'ente interpellato',
        ente: 'ente interpellato',
        other: 'altro',
      };
      const methodLabels = {
        index: 'indice',
        indice: 'indice',
        full_reading: 'lettura completa',
        lettura_completa: 'lettura completa',
        targeted_reading: 'lettura mirata',
        lettura_mirata: 'lettura mirata',
        text_search: 'ricerca per nome',
        ricerca_testuale: 'ricerca per nome',
        inquiry: 'richiesta all’ente',
        richiesta: 'richiesta all’ente',
        reading_room: 'consultazione in sala',
        consultazione_in_sala: 'consultazione in sala',
        other: 'altro',
        altro: 'altro',
      };
      if (researchList) {
        researchList.innerHTML = edge.research.map(r => {
          const what = [r.place, r.register, r.years].filter(Boolean).map(escapeHtml).join(' · ');
          const meta = [r.source, r.date].filter(Boolean).map(escapeHtml).join(' — ');
          const how = [
            r.actor ? `Eseguita da: ${actorLabels[r.actor] || r.actor}` : '',
            r.method ? `Modalità: ${methodLabels[r.method] || r.method}` : '',
            r.terms && r.terms.length ? `Grafie cercate: ${r.terms.join(', ')}` : '',
            r.tools && r.tools.length ? `Strumenti: ${r.tools.join(', ')}` : '',
            r.coverage ? `Lacune della fonte: ${r.coverage}` : '',
          ].filter(Boolean).map(escapeHtml).join(' · ');
          const label = outcomeLabels[r.outcome] || r.outcome;
          return `<li class="research-item">
            <div class="research-item-head">
              <span class="research-what">${what || escapeHtml(r.goal)}</span>
              <span class="research-outcome outcome-${escapeHtml(r.outcome)}">${escapeHtml(label)}</span>
            </div>
            ${meta ? `<div class="research-meta">${meta}</div>` : ''}
            ${how ? `<div class="research-meta research-how">${how}</div>` : ''}
            ${r.note ? `<div class="research-note">${escapeHtml(r.note)}</div>` : ''}
            ${r.media && r.media.length > 0 ? `<div class="research-media">${r.media.map(m => m.isPdf
              ? `<a class="research-media-pdf" href="${escapeHtml(m.url)}" target="_blank">PDF · ${escapeHtml(m.title || 'Documento')}</a>`
              : `<a class="research-media-item" href="${escapeHtml(m.url)}" target="_blank" title="${escapeHtml(m.title || '')}"><img src="${escapeHtml(m.url)}" alt="${escapeHtml(m.title || 'Scansione consultata')}" loading="lazy"></a>`
            ).join('')}</div>` : ''}
          </li>`;
        }).join('');
      }
      if (researchBox) researchBox.style.display = 'block';
    } else {
      if (researchBox) researchBox.style.display = 'none';
    }

    modal.style.display = 'flex';
  };

  // Popup di una freccia genitore-figlio: i documenti che provano il legame
  window.openLinkModal = function(edge) {
    openMarriageModal({ notes: edge.notes, media: edge.media, research: edge.research });

    const iconEl = document.getElementById('modal-icon');
    if (iconEl) iconEl.textContent = '';
    const titleEl = document.getElementById('modal-marriage-title');
    if (titleEl) titleEl.innerText = `${edge.parentName || '?'} → ${edge.childName || '?'}`;
    const subtitleEl = document.getElementById('modal-marriage-subtitle');
    if (subtitleEl) subtitleEl.innerText = 'Legame genitore-figlio';

    const metaEl = document.getElementById('modal-marriage-meta');
    if (metaEl) {
      metaEl.innerHTML = edge.confidence
        ? `<span class="timbro" style="margin-left:0">Da confermare</span>`
        : `<span class="timbro inchiostro ok" style="margin-left:0">Documentato</span>`;
      if (!edge.evidence || edge.evidence.length === 0) {
        metaEl.innerHTML = edge.confidence ? metaEl.innerHTML : '';
      }
    }

    const sourceBox = document.getElementById('modal-marriage-source-box');
    if (sourceBox) sourceBox.style.display = 'none';
    const noSourceBox = document.getElementById('modal-marriage-no-source');
    const linkSources = document.getElementById('modal-link-sources');
    const evidence = edge.evidence || [];
    if (noSourceBox) {
      noSourceBox.style.display = evidence.length === 0 ? 'block' : 'none';
      if (evidence.length === 0) noSourceBox.innerText = 'Nessun documento collegato a questo legame.';
    }
    if (linkSources) {
      linkSources.innerHTML = evidence.map((ev) => `
        <div class="source-box">
          <div class="source-box-head">
            <span class="source-box-title">${escapeHtml(ev.sourceTitle)}</span>
            ${ev.callNumber ? `<span class="callnumber">${escapeHtml(ev.callNumber)}</span>` : ''}
          </div>
          ${ev.page ? `<div class="source-box-page">${escapeHtml(ev.page)}</div>` : ''}
          ${ev.quote ? `<blockquote>${escapeHtml(ev.quote)}</blockquote>` : ''}
          ${ev.notes ? ev.notes.map((n) => `<p>${escapeHtml(n)}</p>`).join('') : ''}
          <div class="source-box-actions">
            ${ev.sourceUrl ? `<a href="${escapeHtml(ev.sourceUrl)}" target="_blank" rel="noopener" class="btn btn-sm btn-primary">Apri l'originale</a>` : ''}
            ${ev.sourcePageUrl ? `<a href="${escapeHtml(ev.sourcePageUrl)}" class="btn btn-sm">Scheda della fonte</a>` : ''}
          </div>
        </div>`).join('');
      linkSources.style.display = evidence.length > 0 ? 'block' : 'none';
    }
  };

  // Popup del segnaposto "?": cosa servirebbe per trovare i genitori, e le ricerche già fatte
  window.openUnknownParentsModal = function(node) {
    const info = node.unknownParents;
    openMarriageModal({ research: info.research });
    const iconEl = document.getElementById('modal-icon');
    if (iconEl) iconEl.textContent = '';
    const what = info.missing === 'both' ? 'Genitori' : info.missing === 'father' ? 'Padre' : 'Madre';
    const titleEl = document.getElementById('modal-marriage-title');
    if (titleEl) titleEl.innerText = `${what} di ${info.childName}: da trovare`;
    const subtitleEl = document.getElementById('modal-marriage-subtitle');
    if (subtitleEl) subtitleEl.innerText = 'Prossimo passo della ricerca';
    const metaEl = document.getElementById('modal-marriage-meta');
    if (metaEl) metaEl.innerHTML = '';
    const sourceBox = document.getElementById('modal-marriage-source-box');
    if (sourceBox) sourceBox.style.display = 'none';
    const noSourceBox = document.getElementById('modal-marriage-no-source');
    if (noSourceBox) noSourceBox.style.display = 'none';
    const linkSources = document.getElementById('modal-link-sources');
    if (linkSources) {
      const step = info.nextStep
        ? info.nextStep.split(/\n+/).filter(Boolean).map((p) => `<p>${escapeHtml(p)}</p>`).join('')
        : '<p class="nota">Piano non ancora definito.</p>';
      linkSources.innerHTML = `
        <div class="next-step-box">
          <div class="next-step-title">Cosa servirebbe per scoprirlo</div>
          ${step}
        </div>
        <div style="margin-top: 1rem;"><a class="btn btn-sm" href="${escapeHtml(nodeUrl(info.childId))}">Fascicolo di ${escapeHtml(info.childName)}</a></div>`;
      linkSources.style.display = 'block';
    }
  };

  function nodeUrl(id) {
    const n = (graphData.nodes || []).find((x) => x.id === id);
    return n ? n.url : '#';
  }

  window.closeMarriageModal = function() {
    const modal = document.getElementById('marriage-modal');
    if (modal) modal.style.display = 'none';
  };

  const modalCloseBtn = document.querySelector('.marriage-modal-close');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeMarriageModal);
  }

  const modalOverlay = document.getElementById('marriage-modal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeMarriageModal();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMarriageModal();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFamilyTree);
} else {
  initFamilyTree();
}
