/* Tablero de proposiciones al PND 2018-2022 — lógica (JavaScript puro, sin dependencias) */
(function () {
  'use strict';

  const D = window.PND_DATA;
  if (!D || !Array.isArray(D.registros)) {
    document.getElementById('contenido').insertAdjacentHTML('afterbegin',
      '<p style="padding:1rem 0">No se pudieron cargar los datos. Verifique que exista <code>data/proposiciones.js</code> junto a <code>index.html</code>.</p>');
    return;
  }

  /* ------------------------------------------------------------------ utilidades */
  const R = D.registros;
  const ORDEN_FAV = D.meta.orden_favorabilidad;           // Favorable, Parcialmente favorable, Desfavorable, Pendiente, Retirada
  const FAV_IDX = Object.fromEntries(ORDEN_FAV.map((f, i) => [f, i + 1]));
  const FAV_VAR = (f) => `var(--fav-${FAV_IDX[f]})`;
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DAY = 86400000;
  const NS = 'http://www.w3.org/2000/svg';
  const collator = new Intl.Collator('es');
  const nf = new Intl.NumberFormat('es-CO');
  const $ = (sel, root = document) => root.querySelector(sel);

  function setAttrs(e, a) {
    if (!a) return;
    for (const k in a) {
      const v = a[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
  }
  function add(e, kids) {
    for (const k of kids.flat()) {
      if (k == null || k === false) continue;
      e.append(k.nodeType ? k : document.createTextNode(String(k)));   // textContent: los datos nunca se interpretan como HTML
    }
  }
  const h = (tag, attrs, ...kids) => { const e = document.createElement(tag); setAttrs(e, attrs); add(e, kids); return e; };
  const s = (tag, attrs, ...kids) => { const e = document.createElementNS(NS, tag); setAttrs(e, attrs); add(e, kids); return e; };

  const parseISO = (iso) => new Date(iso + 'T00:00:00Z');
  const isoDe = (ms) => new Date(ms).toISOString().slice(0, 10);
  const fecha = (iso) => { const d = parseISO(iso); return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const fechaCorta = (ms) => { const d = new Date(ms); return `${String(d.getUTCDate()).padStart(2, '0')} ${MESES[d.getUTCMonth()]}`; };
  const difDias = (a, b) => Math.round((parseISO(b) - parseISO(a)) / DAY);
  const lunesDe = (iso) => { const d = parseISO(iso); return d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY; };
  const camaraCorta = (c) => (c.startsWith('Senado') ? 'Senado' : 'Cámara');

  function cop(n) {
    if (!n) return 'Sin impacto estimado';
    const a = Math.abs(n), sg = n < 0 ? '−' : '';
    if (a >= 1e12) return `${sg}$${(a / 1e12).toLocaleString('es-CO', { maximumFractionDigits: 1 })} billones`;
    if (a >= 1e9) return `${sg}$${nf.format(Math.round(a / 1e9))} mil millones`;
    return `${sg}$${nf.format(Math.round(a / 1e6))} millones`;
  }

  function contarFav(rows) {
    const c = Object.fromEntries(ORDEN_FAV.map((f) => [f, 0]));
    rows.forEach((r) => { c[r.favorabilidad] += 1; });
    return c;
  }

  /* ------------------------------------------------------------------ estado y filtros */
  const state = { congresista: '', partido: '', posicion: '', camara: '', entidad: '', tipo: '', fav: '', desde: '', hasta: '' };
  const ETIQUETA = { congresista: 'Congresista', partido: 'Partido', posicion: 'Gobierno / Oposición', camara: 'Cámara', entidad: 'Entidad', tipo: 'Tipo', fav: 'Favorabilidad', desde: 'Desde', hasta: 'Hasta' };
  const expandidos = new Set();
  const vistaTabla = new Set();

  function coincide(r, st) {
    return (!st.congresista || r.congresista === st.congresista) &&
      (!st.partido || r.partido === st.partido) &&
      (!st.posicion || r.posicion === st.posicion) &&
      (!st.camara || r.camara === st.camara) &&
      (!st.entidad || r.entidad === st.entidad) &&
      (!st.tipo || r.tipo === st.tipo) &&
      (!st.fav || r.favorabilidad === st.fav) &&
      (!st.desde || r.fecha >= st.desde) &&
      (!st.hasta || r.fecha <= st.hasta);
  }
  const filtrar = (st = state) => R.filter((r) => coincide(r, st));
  const ordenCrono = (a, b) => (a.fecha + a.hora + a.id).localeCompare(b.fecha + b.hora + b.id);

  function poner(clave, valor) { state[clave] = valor; render(); }
  function alternar(clave, valor) { poner(clave, state[clave] === valor ? '' : valor); }

  /* ------------------------------------------------------------------ dimensiones (desgloses) */
  const DIMS = [
    { clave: 'posicion', titulo: 'Posición frente al Gobierno', campo: 'posicion', fijo: ['Gobierno', 'Independiente', 'Oposición'] },
    { clave: 'camara', titulo: 'Cámara', campo: 'camara' },
    { clave: 'partido', titulo: 'Partido', campo: 'partido' },
    { clave: 'tipo', titulo: 'Tipo de proposición', campo: 'tipo' },
    { clave: 'entidad', titulo: 'Entidad líder del análisis', campo: 'entidad', etiqueta: 'entidad_corta' },
    { clave: 'congresista', titulo: 'Congresista', campo: 'congresista' },
  ];
  DIMS.forEach((d) => {
    const tot = {};
    R.forEach((r) => { tot[r[d.campo]] = (tot[r[d.campo]] || 0) + 1; });
    d.categorias = d.fijo || Object.keys(tot).sort((a, b) => tot[b] - tot[a] || collator.compare(a, b));
    d.maxGlobal = Math.max(...d.categorias.map((c) => tot[c] || 0), 1);
    d.etiquetaDe = (valor) => (d.etiqueta ? (R.find((r) => r[d.campo] === valor) || {})[d.etiqueta] || valor : valor);
  });

  /* ------------------------------------------------------------------ tooltip */
  const tip = $('#tip');
  function nodosTip(titulo, filas, pie) {
    return [h('div', { class: 'tip-t' }, titulo),
      ...filas.map((f) => h('div', { class: 'tip-r' }, h('i', { class: 'key', style: `background:${f.color}` }), h('b', {}, String(f.valor)), h('span', {}, f.etiqueta))),
      pie ? h('div', { class: 'tip-p' }, pie) : null];
  }
  function mostrarTip(nodos, x, y) {
    tip.replaceChildren(...nodos.filter(Boolean));
    tip.hidden = false;
    const w = tip.offsetWidth, hh = tip.offsetHeight;
    let left = x + 14, top = y + 14;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top + hh > window.innerHeight - 8) top = y - hh - 14;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = Math.max(8, top) + 'px';
  }
  const ocultarTip = () => { tip.hidden = true; };
  function ligarTip(el, generar) {
    el.addEventListener('pointermove', (ev) => mostrarTip(generar(), ev.clientX, ev.clientY));
    el.addEventListener('pointerleave', ocultarTip);
    el.addEventListener('focus', () => { const b = el.getBoundingClientRect(); mostrarTip(generar(), b.left + b.width / 2, b.top); });
    el.addEventListener('blur', ocultarTip);
  }
  const filasFav = (counts) => ORDEN_FAV.filter((f) => counts[f] > 0).map((f) => ({ color: FAV_VAR(f), valor: counts[f], etiqueta: f }));

  /* ------------------------------------------------------------------ controles de filtro */
  function opcionesSelect(sel, valores, textoTodos) {
    sel.replaceChildren(h('option', { value: '' }, textoTodos), ...valores.map((v) => h('option', { value: v.valor }, v.texto)));
  }
  function contar(campo) { const t = {}; R.forEach((r) => { t[r[campo]] = (t[r[campo]] || 0) + 1; }); return t; }

  function iniciarControles() {
    const cCong = contar('congresista'), cPart = contar('partido'), cEnt = contar('entidad'), cTipo = contar('tipo');
    const partidoDe = Object.fromEntries(R.map((r) => [r.congresista, r.partido]));
    opcionesSelect($('#f-congresista'), Object.keys(cCong).sort(collator.compare).map((n) => ({ valor: n, texto: `${n} · ${partidoDe[n]} (${cCong[n]})` })), 'Todos los congresistas');
    opcionesSelect($('#f-partido'), Object.keys(cPart).sort(collator.compare).map((n) => ({ valor: n, texto: `${n} (${cPart[n]})` })), 'Todos los partidos');
    opcionesSelect($('#f-entidad'), Object.keys(cEnt).sort(collator.compare).map((n) => ({ valor: n, texto: `${n} (${cEnt[n]})` })), 'Todas las entidades');
    opcionesSelect($('#f-tipo'), Object.keys(cTipo).sort(collator.compare).map((n) => ({ valor: n, texto: `${n} (${cTipo[n]})` })), 'Todos los tipos');
    [['congresista', '#f-congresista'], ['partido', '#f-partido'], ['entidad', '#f-entidad'], ['tipo', '#f-tipo']]
      .forEach(([k, sel]) => $(sel).addEventListener('change', (e) => poner(k, e.target.value)));

    const segmentos = (idCont, clave, opciones) => {
      const cont = $(`${idCont} .segs`);
      opciones.forEach((o) => cont.append(h('button', { type: 'button', 'data-v': o.valor, onclick: () => poner(clave, o.valor) }, o.texto)));
    };
    segmentos('#f-posicion', 'posicion', [{ valor: '', texto: 'Todas' }, ...DIMS[0].fijo.map((v) => ({ valor: v, texto: v }))]);
    segmentos('#f-camara', 'camara', [{ valor: '', texto: 'Ambas' }, ...DIMS[1].categorias.map((v) => ({ valor: v, texto: camaraCorta(v) }))]);

    const fechas = R.map((r) => r.fecha).concat(D.hitos.map((x) => x.fecha)).sort();
    ['#f-desde', '#f-hasta'].forEach((id) => { $(id).min = fechas[0]; $(id).max = fechas[fechas.length - 1]; });
    $('#f-desde').addEventListener('change', (e) => poner('desde', e.target.value));
    $('#f-hasta').addEventListener('change', (e) => poner('hasta', e.target.value));
    $('#limpiar').addEventListener('click', () => { Object.keys(state).forEach((k) => { state[k] = ''; }); render(); });
    $('#exportar').addEventListener('click', exportarCSV);
  }

  function sincronizarControles() {
    $('#f-congresista').value = state.congresista;
    $('#f-partido').value = state.partido;
    $('#f-entidad').value = state.entidad;
    $('#f-tipo').value = state.tipo;
    $('#f-desde').value = state.desde;
    $('#f-hasta').value = state.hasta;
    ['posicion', 'camara'].forEach((k) => {
      document.querySelectorAll(`#f-${k} .segs button`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state[k])));
    });
  }

  function renderEstado(rows) {
    const est = $('#estado-filtros');
    est.replaceChildren('Mostrando ', h('strong', {}, String(rows.length)), ` de ${R.length} proposiciones`);
    const chips = $('#chips');
    chips.replaceChildren();
    Object.keys(state).filter((k) => state[k]).forEach((k) => {
      const valor = ['desde', 'hasta'].includes(k) ? fecha(state[k]) : state[k];
      chips.append(h('li', {}, h('button', { type: 'button', 'aria-label': `Quitar filtro ${ETIQUETA[k]}: ${valor}`, onclick: () => poner(k, '') },
        `${ETIQUETA[k]}: ${valor}`, h('span', { class: 'x', 'aria-hidden': 'true' }, '×'))));
    });
  }

  /* ------------------------------------------------------------------ KPI: conteo de favorabilidad */
  function renderKPIs(rows) {
    const sinFav = filtrar({ ...state, fav: '' });          // las categorías siguen visibles aunque se filtre por una
    const cuentas = contarFav(sinFav);
    const neto = rows.reduce((a, r) => a + r.impacto, 0);
    const cont = $('#kpis');
    cont.replaceChildren(
      h('div', { class: 'hero' },
        h('div', {}, h('div', { class: 'v' }, nf.format(rows.length)), h('div', { class: 'l' }, rows.length === 1 ? 'proposición en la selección' : 'proposiciones en la selección')),
        h('div', { class: 's' }, `de ${R.length} en el registro · impacto fiscal neto estimado: ${cop(neto)}`)),
      ...ORDEN_FAV.map((f) => {
        const pct = sinFav.length ? Math.round((cuentas[f] / sinFav.length) * 100) : 0;
        return h('button', { type: 'button', class: 'tile', style: `--c:${FAV_VAR(f)}`, 'aria-pressed': String(state.fav === f),
          'aria-label': `${f}: ${cuentas[f]} proposiciones. ${state.fav === f ? 'Quitar filtro' : 'Filtrar'}`, onclick: () => alternar('fav', f) },
          h('span', { class: 'v' }, String(cuentas[f])), h('span', { class: 'l' }, f), h('span', { class: 'p' }, sinFav.length ? `${pct} % de la selección` : 'Sin datos'));
      }));
  }

  /* ------------------------------------------------------------------ línea de tiempo */
  const hitos = D.hitos.map((x, i) => ({ ...x, n: i + 1, ms: parseISO(x.fecha).getTime() }));
  const todasFechas = R.map((r) => parseISO(r.fecha).getTime()).concat(hitos.map((x) => x.ms));
  const semIni = lunesDe(isoDe(Math.min(...todasFechas)));
  const semFin = lunesDe(isoDe(Math.max(...todasFechas))) + 7 * DAY;
  const semanas = []; for (let t = semIni; t < semFin; t += 7 * DAY) semanas.push(t);
  const porSemana = (rows) => { const m = new Map(semanas.map((t) => [t, []])); rows.forEach((r) => m.get(lunesDe(r.fecha)).push(r)); return m; };
  const maxSemGlobal = Math.max(...[...porSemana(R).values()].map((v) => v.length));
  const paso = maxSemGlobal <= 8 ? 2 : maxSemGlobal <= 20 ? 5 : 10;
  const yMax = Math.ceil(maxSemGlobal / paso) * paso;
  const rangoSemana = (t) => { const a = new Date(t), b = new Date(t + 6 * DAY); return `${a.getUTCDate()} ${MESES[a.getUTCMonth()]} – ${b.getUTCDate()} ${MESES[b.getUTCMonth()]} ${b.getUTCFullYear()}`; };

  function trazoSup(x, y, w, hh, r) {                       // barra con extremo superior redondeado, base recta
    const rr = Math.min(r, hh, w / 2);
    return `M${x},${y + hh}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + hh}Z`;
  }

  function renderTimeline(rows) {
    const cont = $('#timeline');
    cont.replaceChildren();
    const W = Math.max(cont.clientWidth || 960, 760), H = 300;
    const m = { l: 40, r: 14, t: 48, b: 40 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const X = (ms) => m.l + ((ms - semIni) / (semFin - semIni)) * pw;
    const Y = (v) => m.t + ph - (v / yMax) * ph;
    const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'group',
      'aria-label': 'Columnas apiladas: proposiciones recibidas por semana según favorabilidad, con los hitos del trámite' });

    for (let v = 0; v <= yMax; v += paso) {
      svg.append(s('line', { class: v === 0 ? 'base' : 'ygrid', x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }),
        s('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, String(v)));
    }
    const wkPx = pw / semanas.length, cada = wkPx < 52 ? 2 : 1;
    semanas.forEach((t, i) => {
      svg.append(s('line', { class: 'base', x1: X(t), x2: X(t), y1: Y(0), y2: Y(0) + 4 }));
      if (i % cada === 0) svg.append(s('text', { x: X(t + 3.5 * DAY), y: Y(0) + 18, 'text-anchor': 'middle' }, fechaCorta(t)));
    });
    svg.append(s('text', { x: W - m.r, y: H - 6, 'text-anchor': 'end' }, 'Semanas, con inicio el lunes indicado'));

    hitos.forEach((x) => svg.append(s('line', { class: 'hito-l', x1: X(x.ms), x2: X(x.ms), y1: 36, y2: Y(0) })));

    const bw = Math.min(24, wkPx - 8);
    const rHito = Math.min(11, Math.max(8, (pw / ((semFin - semIni) / DAY)) * 1.5 - 0.5));
    const mapa = porSemana(rows);
    semanas.forEach((t) => {
      const rs = mapa.get(t), cuentas = contarFav(rs), total = rs.length;
      const iso0 = isoDe(t), iso1 = isoDe(t + 6 * DAY);
      const g = s('g', { class: 'col' + (state.desde === iso0 && state.hasta === iso1 ? ' sel' : ''),
        tabindex: total ? 0 : null, role: total ? 'button' : null,
        'aria-label': total ? `Semana del ${rangoSemana(t)}: ${total} proposiciones. Seleccionar para filtrar por fecha.` : null });
      g.append(s('rect', { class: 'wk-bg', x: X(t), y: m.t - 4, width: X(t + 7 * DAY) - X(t), height: ph + 4 }));
      let base = Y(0);
      const activos = ORDEN_FAV.filter((f) => cuentas[f] > 0);
      activos.forEach((f, i) => {
        const alto = (cuentas[f] / yMax) * ph;
        const ultimo = i === activos.length - 1, primero = i === 0;
        const y = base - alto, hh = alto - (primero ? 0 : 2), x = X(t + 3.5 * DAY) - bw / 2;
        g.append(ultimo ? s('path', { d: trazoSup(x, y, bw, hh, 4), fill: FAV_VAR(f) }) : s('rect', { x, y, width: bw, height: hh, fill: FAV_VAR(f) }));
        base = y;
      });
      if (total) {
        g.addEventListener('click', () => { if (state.desde === iso0 && state.hasta === iso1) { state.desde = ''; state.hasta = ''; render(); } else { state.desde = iso0; state.hasta = iso1; render(); } });
        g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); g.dispatchEvent(new Event('click')); } });
        ligarTip(g, () => nodosTip(`Semana del ${rangoSemana(t)}`, [{ color: 'var(--axis)', valor: total, etiqueta: 'proposiciones recibidas' }, ...filasFav(cuentas)]));
        g.style.cursor = 'pointer';
      }
      svg.append(g);
    });

    hitos.forEach((x) => {
      const g = s('g', { class: 'hito-c', tabindex: 0, role: 'img', 'aria-label': `Hito ${x.n}: ${x.etiqueta}, ${fecha(x.fecha)}` });
      g.append(s('circle', { cx: X(x.ms), cy: 20, r: rHito, fill: 'var(--navy)', stroke: '#fff', 'stroke-width': 2 }),
        s('text', { class: 'num', x: X(x.ms), y: 24, 'text-anchor': 'middle' }, String(x.n)));
      ligarTip(g, () => nodosTip(`${x.n}. ${x.etiqueta}`, [], `${fecha(x.fecha)} — ${x.detalle}`));
      svg.append(g);
    });

    if (!rows.length) svg.append(s('text', { class: 'empty', x: W / 2, y: m.t + ph / 2, 'text-anchor': 'middle' }, 'Sin proposiciones para los filtros actuales'));
    cont.append(svg);
  }

  function renderTimelineTabla(rows) {
    const mapa = porSemana(rows);
    const t = h('table', {}, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Semana'), ...ORDEN_FAV.map((f) => h('th', { scope: 'col' }, f)), h('th', { scope: 'col' }, 'Total'))),
      h('tbody', {}, ...semanas.map((w) => { const c = contarFav(mapa.get(w)); return h('tr', {}, h('th', { scope: 'row' }, rangoSemana(w)), ...ORDEN_FAV.map((f) => h('td', {}, String(c[f]))), h('td', {}, String(mapa.get(w).length))); })));
    $('#timeline-tabla').replaceChildren(t);
  }

  function iniciarHitos() {
    $('#hitos').replaceChildren(...hitos.map((x) => h('li', {}, h('span', { class: 'n' }, String(x.n)), h('span', {}, h('b', {}, `${fecha(x.fecha)} · ${x.etiqueta}. `), x.detalle))));
  }

  /* ------------------------------------------------------------------ registro cronológico */
  const chev = () => s('svg', { width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': 'true' }, s('path', { d: 'M5 2.5l4.5 4.5L5 11.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));

  function detalle(r) {
    const pasos = r.trazabilidad.map((p, i) => h('li', { class: 'paso' },
      h('span', { class: 'n', 'aria-hidden': 'true' }, String(i + 1)), h('b', {}, p.hito),
      h('span', { class: 'd' }, `${fecha(p.fecha)}${i ? (difDias(r.fecha, p.fecha) === 0 ? ' · mismo día' : ` · +${difDias(r.fecha, p.fecha)} días`) : ''}`),
      h('div', { class: 't' }, p.detalle)));
    const dato = (k, v) => [h('dt', {}, k), h('dd', {}, v)];
    const bloque = (k, v) => (v ? h('div', { class: 'texto-b' }, h('span', { class: 'k' }, k), h('p', {}, v)) : null);
    const enlace = /^https:\/\//.test(r.url) ? h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, 'Documento de referencia del trámite (se abre en otra pestaña)') : null;
    return h('tr', { class: 'det', id: `det-${r.id}` }, h('td', { colspan: 8 },
      h('div', { class: 'det-grid' },
        h('div', {}, h('h4', {}, 'Trazabilidad'), h('ol', { class: 'paso-lista' }, pasos)),
        h('div', {},
          h('h4', {}, 'Contenido y análisis'),
          bloque('Texto original de la proposición', r.texto), bloque('Objeto / intención', r.objeto),
          bloque('Justificación presentada', r.justificacion), bloque('Observaciones', r.observaciones),
          h('dl', { class: 'campos' },
            ...dato('Eje líder', r.eje), ...dato('Tema', r.tema), ...dato('Circunscripción', r.circunscripcion), ...dato('Coponentes / apoyos', r.apoyos),
            ...dato('Recomendación del Gobierno', r.recomendacion), ...dato('Prioridad', r.prioridad), ...dato('Riesgo jurídico', r.riesgo),
            ...dato('Conceptos (técnico / jurídico / fiscal)', `${r.c_tecnico} / ${r.c_juridico} / ${r.c_fiscal}`),
            ...dato('Impacto fiscal estimado', cop(r.impacto)), ...dato('Entidad líder', r.entidad), ...dato('Responsable de seguimiento', r.responsable),
            ...dato('Fuente de la propuesta', r.fuente)),
          enlace))));
  }

  function renderRegistro(rows) {
    const tb = $('#registro-cuerpo');
    tb.replaceChildren();
    if (!rows.length) {
      tb.append(h('tr', { class: 'vacio-fila' }, h('td', { colspan: 8 }, 'Ninguna proposición coincide con los filtros actuales. Quite algún filtro o use «Limpiar filtros».')));
      return;
    }
    [...rows].sort(ordenCrono).forEach((r) => {
      const abierto = expandidos.has(r.id);
      tb.append(h('tr', { class: 'fila' },
        h('td', { class: 'exp' }, h('button', { type: 'button', class: 'exp-b', 'aria-expanded': String(abierto), 'aria-controls': `det-${r.id}`, 'aria-label': `${abierto ? 'Ocultar' : 'Ver'} trazabilidad de ${r.id}`,
          onclick: () => { if (expandidos.has(r.id)) expandidos.delete(r.id); else expandidos.add(r.id); renderRegistro(filtrar()); } }, chev())),
        h('td', { class: 'fecha' }, fecha(r.fecha), h('small', {}, `${r.hora} h`)),
        h('td', { class: 'prop' }, h('b', {}, r.id), h('small', {}, r.radicado)),
        h('td', { class: 'cong' }, r.congresista, h('small', {}, `${r.partido} · ${camaraCorta(r.camara)}`)),
        h('td', {}, r.posicion),
        h('td', { class: 'art' }, r.articulo),
        h('td', {}, r.tipo),
        h('td', {}, h('span', { class: 'estado-b' }, h('i', { class: `f${FAV_IDX[r.favorabilidad]}`, 'aria-hidden': 'true' }), r.estado))));
      if (abierto) tb.append(detalle(r));
    });
  }

  /* ------------------------------------------------------------------ desgloses apilados por favorabilidad */
  function iniciarDesgloses() {
    const grid = $('#desgloses-grid');
    DIMS.forEach((d) => {
      grid.append(h('article', { class: 'card', id: `card-${d.clave}` },
        h('header', { class: 'card-h' }, h('h3', {}, d.titulo),
          h('button', { type: 'button', class: 'link', 'aria-pressed': 'false', 'data-vista': d.clave, onclick: () => { if (vistaTabla.has(d.clave)) vistaTabla.delete(d.clave); else vistaTabla.add(d.clave); renderDesglose(d, filtrar()); } }, 'Ver tabla')),
        h('div', { class: 'bars', 'data-barras': d.clave }), h('div', { class: 'tabla-alt', 'data-tabla': d.clave, hidden: true })));
    });
  }

  function renderDesglose(d, rows) {
    const tabla = vistaTabla.has(d.clave);
    const card = $(`#card-${d.clave}`);
    const barras = $(`[data-barras="${d.clave}"]`, card), alt = $(`[data-tabla="${d.clave}"]`, card), btn = $('[data-vista]', card);
    btn.textContent = tabla ? 'Ver barras' : 'Ver tabla';
    btn.setAttribute('aria-pressed', String(tabla));
    barras.hidden = tabla; alt.hidden = !tabla;
    const porCat = new Map(d.categorias.map((c) => [c, []]));
    rows.forEach((r) => { if (porCat.has(r[d.campo])) porCat.get(r[d.campo]).push(r); });

    barras.replaceChildren(...d.categorias.map((c) => {
      const rs = porCat.get(c), cuentas = contarFav(rs), total = rs.length, sel = state[d.clave] === c, etiqueta = d.etiquetaDe(c);
      const fill = h('span', { class: 'bf', style: `width:${(total / d.maxGlobal) * 100}%` },
        ...ORDEN_FAV.filter((f) => cuentas[f] > 0).map((f) => h('span', { class: `seg f${FAV_IDX[f]}`, style: `flex-grow:${cuentas[f]}` })));
      const fila = h('button', { type: 'button', class: 'brow' + (sel ? ' sel' : '') + (total ? '' : ' vacio'), 'aria-pressed': String(sel),
        'aria-label': `${c}: ${total} proposiciones. ${sel ? 'Quitar filtro' : 'Filtrar'}`, onclick: () => alternar(d.clave, c) },
        h('span', { class: 'bl', title: c }, etiqueta), h('span', { class: 'bt' }, fill), h('span', { class: 'bv' }, String(total)));
      ligarTip(fila, () => nodosTip(c, total ? [{ color: 'var(--axis)', valor: total, etiqueta: 'proposiciones' }, ...filasFav(cuentas)] : [], total ? null : 'Sin proposiciones con los filtros actuales'));
      return fila;
    }));

    alt.replaceChildren(h('table', {},
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, d.titulo), ...ORDEN_FAV.map((f) => h('th', { scope: 'col' }, f)), h('th', { scope: 'col' }, 'Total'))),
      h('tbody', {}, ...d.categorias.map((c) => { const cu = contarFav(porCat.get(c)); return h('tr', {}, h('th', { scope: 'row' }, c), ...ORDEN_FAV.map((f) => h('td', {}, String(cu[f]))), h('td', {}, String(porCat.get(c).length))); }))));
  }

  /* ------------------------------------------------------------------ exportación */
  function exportarCSV() {
    const rows = [...filtrar()].sort(ordenCrono);
    const cols = [['id', 'ID'], ['fecha', 'Fecha recepción'], ['hora', 'Hora'], ['congresista', 'Congresista'], ['camara', 'Cámara'], ['partido', 'Partido'], ['posicion', 'Posición frente al Gobierno'],
      ['circunscripcion', 'Circunscripción'], ['tipo', 'Tipo de proposición'], ['articulo', 'Artículo afectado'], ['eje', 'Eje líder'], ['tema', 'Tema'], ['estado', 'Estado'], ['favorabilidad', 'Favorabilidad'],
      ['recomendacion', 'Recomendación Gobierno'], ['prioridad', 'Prioridad'], ['riesgo', 'Riesgo jurídico'], ['impacto', 'Impacto fiscal estimado COP'], ['entidad', 'Entidad líder'],
      ['fecha_limite', 'Fecha límite respuesta'], ['ultima_actualizacion', 'Última actualización'], ['radicado', 'Radicado'], ['texto', 'Texto de la proposición']];
    const esc = (v) => { let t = String(v ?? ''); if (/^[=+\-@]/.test(t) && isNaN(Number(t))) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; };
    const csv = '﻿' + [cols.map((c) => esc(c[1])).join(',')].concat(rows.map((r) => cols.map((c) => esc(r[c[0]])).join(','))).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = h('a', { href: url, download: 'proposiciones_PND_filtradas.csv' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ------------------------------------------------------------------ ciclo de render */
  function render() {
    ocultarTip();
    const rows = filtrar();
    sincronizarControles();
    renderEstado(rows);
    renderKPIs(rows);
    renderTimeline(rows);
    renderTimelineTabla(rows);
    renderRegistro(rows);
    DIMS.forEach((d) => renderDesglose(d, rows));
  }

  function iniciarLeyendas() {
    document.querySelectorAll('[data-legend]').forEach((el) => {
      el.replaceChildren(...ORDEN_FAV.map((f) => h('span', {}, h('i', { class: `f${FAV_IDX[f]}`, 'aria-hidden': 'true' }), f)));
    });
  }

  iniciarControles();
  iniciarLeyendas();
  iniciarHitos();
  iniciarDesgloses();
  $('#generado').textContent = `Datos generados el ${D.meta.generado} · ${D.meta.n_registros} registros simulados.`;
  $('#vista-timeline').addEventListener('click', (e) => {
    const t = $('#timeline-tabla').hidden;
    $('#timeline-tabla').hidden = !t; $('#timeline').hidden = t;
    e.currentTarget.textContent = t ? 'Ver gráfico' : 'Ver tabla';
    e.currentTarget.setAttribute('aria-pressed', String(t));
  });
  render();

  let anchoPrevio = $('#timeline').clientWidth, temporizador;
  window.addEventListener('resize', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { const w = $('#timeline').clientWidth; if (w && w !== anchoPrevio) { anchoPrevio = w; renderTimeline(filtrar()); } }, 150);
  });
})();
