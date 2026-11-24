(function(){
  'use strict';

  const PINNED = ['XÃ GÀNH HÀO', 'XÃ LONG ĐIỀN'];
  const PAGE_SIZE = 100;

  const VT = [
    {id:1, label:'VT1', range:'0–30m', pct:100},
    {id:2, label:'VT2', range:'30–60m', pct:60},
    {id:3, label:'VT3', range:'60–90m', pct:40},
    {id:4, label:'VT4', range:'>90m', pct:20},
  ];
  const LOAI_DAT = [
    {id:'o', label:'Đất ở', pct:100},
    {id:'tmdv', label:'Đất thương mại, dịch vụ', pct:80},
    {id:'sx', label:'Đất cơ sở SX phi nông nghiệp, KCN, CCN, khu công nghệ cao', pct:60},
    {id:'tsc', label:'Trụ sở cơ quan, công trình sự nghiệp, tôn giáo/tín ngưỡng, nghĩa trang', pct:80},
    {id:'mn', label:'Sông, kênh, rạch, mặt nước chuyên dùng', pct:50},
  ];

  const ICONS = {
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>',
    leaf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
    calc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/></svg>',
    book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  };
  const NAV = [
    {route:'home', href:'#/', label:'Tra cứu đất ở', short:'Tra cứu', icon:'search'},
    {route:'nong-nghiep', href:'#/nong-nghiep', label:'Đất nông nghiệp', short:'Nông nghiệp', icon:'leaf'},
    {route:'may-tinh', href:'#/may-tinh', label:'Máy tính giá đất', short:'Tính giá', icon:'calc'},
    {route:'quy-dinh', href:'#/quy-dinh', label:'Quy định vị trí', short:'Quy định', icon:'book'},
  ];

  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
  const view = $('#view');
  const input = $('#searchInput');
  const clearBtn = $('#clearBtn');

  let DATA = null;
  let INDEX = [];          // mọi dòng giá đã chuẩn hóa để tìm kiếm
  let REGION_BY_SLUG = {};
  let preSearchHash = '#/';
  let searchLimit = PAGE_SIZE;
  let inAppNav = false;
  let searchPushed = false; // ô tìm kiếm đã thêm một mục vào lịch sử trình duyệt    // đã điều hướng trong app hay vào thẳng từ link chia sẻ

  /* ---------- Tiện ích chuỗi ---------- */
  function esc(s){
    if(s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  // Bỏ dấu từng ký tự, giữ nguyên độ dài chuỗi để tô sáng đúng vị trí.
  function foldChar(c){
    if(c === 'đ' || c === 'Đ') return 'd';
    return c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().charAt(0) || c;
  }
  function fold(s){
    if(!s) return '';
    let out = '';
    for(const c of s.normalize('NFC')) out += foldChar(c);
    return out;
  }
  function tokens(q){ return fold(q).split(/\s+/).filter(Boolean); }
  function highlight(text, toks){
    if(!text) return '';
    text = text.normalize('NFC');
    if(!toks.length) return esc(text);
    const chars = Array.from(text);
    const f = chars.map(foldChar).join('');
    const marks = new Array(chars.length).fill(false);
    toks.forEach(t => {
      let i = f.indexOf(t);
      while(i !== -1){ for(let j=i; j<i+t.length; j++) marks[j] = true; i = f.indexOf(t, i + t.length); }
    });
    let html = '', open = false;
    chars.forEach((c, i) => {
      if(marks[i] && !open){ html += '<mark>'; open = true; }
      if(!marks[i] && open){ html += '</mark>'; open = false; }
      html += esc(c);
    });
    if(open) html += '</mark>';
    return html;
  }
  function niceName(n){
    return n.toLowerCase().split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ');
  }
  function slug(n){ return fold(n).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function fmt(n){ return Math.round(n).toLocaleString('vi-VN'); }
  function kindLabel(k){ return k.loai === 'xa' ? 'Xã' : 'Phường'; }

  /* ---------- Giao diện sáng / tối ---------- */
  function setTheme(t, save){
    document.documentElement.dataset.theme = t;
    $$('.theme-toggle').forEach(x => { x.checked = t === 'dark'; });
    if(save){ try { localStorage.setItem('theme', t); } catch(e){} }
  }
  $$('.theme-toggle').forEach(x => x.addEventListener('change', () => setTheme(x.checked ? 'dark' : 'light', true)));
  setTheme(document.documentElement.dataset.theme, false);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    let saved = null; try { saved = localStorage.getItem('theme'); } catch(err){}
    if(!saved) setTheme(e.matches ? 'dark' : 'light', false);
  });

  function toast(msg){
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
  }
  async function share(title){
    const url = location.href;
    if(navigator.share){ try { await navigator.share({title, url}); } catch(e){} return; }
    try { await navigator.clipboard.writeText(url); toast('Đã sao chép liên kết'); }
    catch(e){ prompt('Sao chép liên kết:', url); }
  }

  /* ---------- Định tuyến ---------- */
  function parseRoute(){
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const params = new URLSearchParams(qs || '');
    if(parts[0] === 'khu' && parts[1]) return {name:'khu', slug:decodeURIComponent(parts[1]), params};
    if(parts[0] === 'tim') return {name:'tim', q:decodeURIComponent(parts.slice(1).join('/')), params};
    if(['nong-nghiep','quy-dinh','may-tinh'].includes(parts[0])) return {name:parts[0], params};
    return {name:'home', params};
  }

  function render(){
    if(!DATA) return;
    const r = parseRoute();
    const q = r.name === 'tim' ? r.q : '';
    if(document.activeElement !== input) input.value = q;
    clearBtn.hidden = !input.value;
    if(r.name !== 'tim') preSearchHash = location.hash || '#/';

    let html;
    if(r.name === 'khu') html = renderDetail(r.slug);
    else if(r.name === 'tim') html = renderSearch(q);
    else if(r.name === 'nong-nghiep') html = renderAgri();
    else if(r.name === 'quy-dinh') html = renderRef();
    else if(r.name === 'may-tinh') html = renderCalc(r.params);
    else html = renderHome();
    view.innerHTML = html;
    afterRender(r);
    updateNav(r);
  }

  function updateNav(r){
    const active = (r.name === 'khu' || r.name === 'tim') ? 'home' : r.name;
    $$('[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === active));
    $$('#sideList a').forEach(a => a.classList.toggle('active', r.name === 'khu' && a.dataset.slug === r.slug));
    const titles = {home:'', tim:'Tìm kiếm', 'nong-nghiep':'Đất nông nghiệp', 'quy-dinh':'Quy định vị trí', 'may-tinh':'Máy tính giá đất'};
    let t = titles[r.name] || '';
    if(r.name === 'khu' && REGION_BY_SLUG[r.slug]) t = niceName(REGION_BY_SLUG[r.slug].ten);
    document.title = (t ? t + ' · ' : '') + 'Bảng giá đất Cà Mau 2026';
  }

  /* ---------- Thành phần dùng chung ---------- */
  function priceRow(item, opts){
    const toks = opts.toks || [];
    const k = item.khu, r = item.row;
    const [duong, tu, den, gia, , group] = r;
    const calcHref = '#/may-tinh?' + new URLSearchParams({gia, ten: duong + (tu ? ' (' + tu + ')' : '') + ' · ' + niceName(k.ten)}).toString();
    return `<div class="price-row">
      <div class="prow-left">
        ${opts.showKhu ? `<div class="prow-ctx">${esc(niceName(k.ten))}</div>` : ''}
        ${opts.showKhu && group ? `<div class="prow-group">${highlight(group, toks)}</div>` : ''}
        <div class="prow-street">${highlight(duong, toks)}</div>
        ${(tu || den) ? `<div class="prow-seg">${highlight(tu, toks)}${tu && den ? ' → ' : ''}${highlight(den, toks)}</div>` : ''}
      </div>
      <div class="prow-right">
        <div class="prow-price">${fmt(gia)}</div>
        <div class="prow-unit">nghìn đ/m²</div>
        <div class="prow-full">${fmt(gia * 1000)} đ/m²</div>
        <a class="calc-link" href="${esc(calcHref)}">Tính giá</a>
      </div>
    </div>`;
  }

  /* ---------- Trang chủ ---------- */
  function renderHome(){
    const khus = DATA.khu_vuc;
    const pinned = khus.filter(k => PINNED.includes(k.ten));
    const rest = khus.filter(k => !PINNED.includes(k.ten));
    const regionLink = k => `<a class="region-row" href="#/khu/${slug(k.ten)}">
        <span class="name">${esc(niceName(k.ten))}</span><span class="meta">${k.rows.length} mức ›</span></a>`;
    return `
      <div class="hero">
        <h1>Bảng giá đất Cà Mau 2026</h1>
        <p>Theo Nghị quyết 16/2025/NQ-HĐND ngày 09/12/2025, áp dụng từ 01/01/2026. Gõ tên đường, xã hoặc phường vào ô tìm kiếm phía trên.</p>
        <div class="stats">
          <div><b>${khus.filter(k => k.loai === 'phuong').length}</b><span>phường</span></div>
          <div><b>${khus.filter(k => k.loai === 'xa').length}</b><span>xã</span></div>
          <div><b>${fmt(INDEX.length)}</b><span>mức giá</span></div>
        </div>
      </div>
      <div class="section-label">Khu vực ưu tiên</div>
      <div class="pin-row">${pinned.map(k => `<a class="pin-card" href="#/khu/${slug(k.ten)}">
          <span class="badge">${kindLabel(k)}</span>
          <span class="name">${esc(niceName(k.ten))}</span>
          <span class="count">${k.rows.length} mức giá</span></a>`).join('')}</div>
      <div class="section-label">Phường (đất ở đô thị)</div>
      <div class="grid">${rest.filter(k => k.loai === 'phuong').map(regionLink).join('')}</div>
      <div class="section-label">Xã (đất ở nông thôn)</div>
      <div class="grid">${rest.filter(k => k.loai === 'xa').map(regionLink).join('')}</div>`;
  }

  /* ---------- Chi tiết xã / phường ---------- */
  function renderDetailRows(khu, filter){
    const toks = tokens(filter || '');
    let html = '', curSub = undefined, curGroup = undefined, open = false, count = 0;
    khu.rows.forEach((r, i) => {
      const item = INDEX[khu._start + i];
      if(toks.length && !toks.every(t => item.hay.includes(t))) return;
      count++;
      const sub = r[4], group = r[5];
      if(sub !== curSub || group !== curGroup){
        if(open){ html += '</div>'; open = false; }
        if(sub !== curSub && sub) html += `<div class="subsection-title">${esc(sub)}</div>`;
        if(group) html += `<div class="group-title">${esc(group)}</div>`;
        curSub = sub; curGroup = group;
      }
      if(!open){ html += '<div class="row-list">'; open = true; }
      html += priceRow(item, {toks});
    });
    if(open) html += '</div>';
    if(!count) html = `<div class="empty"><div class="big">∅</div>Không có tuyến đường phù hợp trong khu vực này.</div>`;
    return html;
  }
  function renderDetail(s){
    const khu = REGION_BY_SLUG[s];
    if(!khu) return `<div class="empty"><div class="big">?</div>Không tìm thấy khu vực. <a href="#/">Về trang chủ</a></div>`;
    return `
      <div class="detail-head">
        <button class="icon-btn" id="backBtn" type="button" aria-label="Quay lại">←</button>
        <div class="detail-title">${esc(niceName(khu.ten))}</div>
        <button class="icon-btn" id="shareBtn" type="button">Chia sẻ</button>
      </div>
      <div class="detail-meta">${esc(khu.muc)} · ${khu.rows.length} mức giá · Đơn vị: 1.000 đồng/m²</div>
      <input class="local-filter" id="localFilter" type="search" placeholder="Lọc trong ${esc(niceName(khu.ten))}…" aria-label="Lọc trong khu vực">
      <div id="detailRows">${renderDetailRows(khu, '')}</div>`;
  }

  /* ---------- Tìm kiếm ---------- */
  function search(q){
    const toks = tokens(q);
    if(!toks.length) return {toks, rows:[], regions:[]};
    const regions = DATA.khu_vuc.filter(k => toks.every(t => k._fold.includes(t)));
    const rows = [];
    INDEX.forEach(item => {
      if(!toks.every(t => item.hayAll.includes(t))) return;
      const inStreet = toks.every(t => item.hay.includes(t));
      const score = (inStreet ? 0 : 2) + (item.pinned ? 0 : 1);
      rows.push({item, score});
    });
    rows.sort((a, b) => a.score - b.score);
    return {toks, rows, regions};
  }
  function renderSearch(q){
    const {toks, rows, regions} = search(q);
    let html = '';
    if(regions.length){
      html += `<div class="section-label">Khu vực</div><div class="chips">${regions.map(k =>
        `<a class="chip" href="#/khu/${slug(k.ten)}">${esc(niceName(k.ten))} ›</a>`).join('')}</div>`;
    }
    html += `<div class="section-label">${fmt(rows.length)} mức giá cho “${esc(q)}”</div>`;
    if(!rows.length){
      html += `<div class="empty"><div class="big">∅</div>Không tìm thấy tuyến đường phù hợp. Thử gõ ít từ hơn.</div>`;
      return html;
    }
    html += `<div class="row-list">${rows.slice(0, searchLimit).map(x => priceRow(x.item, {toks, showKhu:true})).join('')}</div>`;
    if(rows.length > searchLimit) html += `<button class="more-btn" id="moreBtn" type="button">Xem thêm (${fmt(rows.length - searchLimit)} còn lại)</button>`;
    return html;
  }

  /* ---------- Đất nông nghiệp ---------- */
  function renderAgri(){
    return `<div class="page-title">Đất nông nghiệp</div>
      <div class="page-sub">Giá năm 2026, đơn vị 1.000 đồng/m², mức Vị trí 1.</div>
      <div class="agri-table">
        <div class="agri-head"><div>Loại đất</div><div style="text-align:right">Khu vực 1</div><div style="text-align:right">Khu vực 2</div></div>
        ${DATA.nong_nghiep.map(r => `<div class="agri-row"><div>${esc(r.loai_dat)}</div>
          <div class="val">${fmt(r.khu_vuc_1)}</div><div class="val">${fmt(r.khu_vuc_2)}</div></div>`).join('')}
      </div>
      <div class="note">
        <b>Khu vực 1</b>: các phường trên địa bàn tỉnh Cà Mau.<br>
        <b>Khu vực 2</b>: các xã trên địa bàn tỉnh Cà Mau (gồm Xã Gành Hào và Xã Long Điền).<br><br>
        <b>Vị trí đất nông nghiệp</b> (giá trên là mức Vị trí 1):<br>
        • Vị trí 1 (60m đầu từ chỉ giới đường đỏ / ranh GPMB / mép đường hiện hữu): 100%<br>
        • Vị trí 2 (trên 60m đến 120m): 80% so với Vị trí 1<br>
        • Vị trí 3 (các vị trí còn lại): 60% so với Vị trí 1
      </div>`;
  }

  /* ---------- Quy định ---------- */
  function renderRef(){
    return `<div class="page-title">Quy định vị trí</div>
      <div class="page-sub">Tóm tắt các quy định áp dụng giá trong Nghị quyết.</div>
      <div class="ref-card">
        <h3>Vị trí đất ở (Điều 5, Khoản 2b)</h3>
        <p>Đất ở đô thị/nông thôn đã có cơ sở hạ tầng được chia 4 vị trí, tính theo % giá Vị trí 1 (giá gốc trong bảng):</p>
        <div class="vt-grid">${VT.map(v => `<div class="vt-cell"><div class="n">${v.label} · ${esc(v.range)}</div><div class="p">${v.pct}%</div></div>`).join('')}</div>
        <p>Nếu giá VT2/VT3/VT4 tính ra thấp hơn giá đất ở <i>chưa có cơ sở hạ tầng thuận lợi giao thông</i> của xã/phường đó, thì lấy theo giá đất ở chưa có cơ sở hạ tầng thuận lợi.</p>
      </div>
      <div class="ref-card"><h3>Đất giáp sông, kênh, rạch</h3>
        <p>Tính bằng giá đất ở <b>chưa có cơ sở hạ tầng thuận lợi giao thông</b> (vị trí tính từ mép sông/kênh/rạch). Nếu có lộ giao thông cặp sông/kênh/rạch thì tính theo giá đất ở của tuyến đường đó.</p></div>
      <div class="ref-card"><h3>Thửa đất giáp 2 mặt tiền trở lên</h3>
        <p>Lấy giá của tuyến đường có mức giá <b>cao nhất</b>, nhân hệ số <b>1,2 lần</b>.</p></div>
      <div class="ref-card"><h3>Đoạn đường chênh lệch giá (Điều 5đ)</h3>
        <p>Đoạn giá thấp liền kề đoạn giá cao: giảm dần đều 5%/10m — 10m đầu = 95% giá cao, 10m tiếp = 90%, tiếp theo 85%... đến khi bằng mức giá đoạn thấp nhất.</p></div>
      <div class="ref-card"><h3>Đất phi nông nghiệp khác — % giá đất ở cùng vị trí</h3>
        <ul>
          <li>Thương mại, dịch vụ: <b>80%</b></li>
          <li>Cơ sở SX phi nông nghiệp (không phải TM-DV): <b>60%</b></li>
          <li>Khu công nghiệp, cụm công nghiệp: <b>60%</b></li>
          <li>Khu công nghệ cao: <b>60%</b></li>
          <li>Trụ sở cơ quan, công trình sự nghiệp, tôn giáo/tín ngưỡng, nghĩa trang: <b>80%</b></li>
          <li>Đất công cộng có/không kinh doanh, đất phi NN khác: bằng giá đất cơ sở SX phi NN cùng vị trí</li>
          <li>Sông, kênh, rạch, mặt nước chuyên dùng: <b>50%</b></li>
        </ul>
        <p>Nếu vị trí đó không có giá đất ở, lấy theo giá đất ở của đoạn/tuyến đường lân cận gần nhất có mức giá cao nhất.</p></div>`;
  }

  /* ---------- Máy tính giá đất ---------- */
  function calcState(p){
    const num = (v, d) => { const n = parseFloat(v); return isFinite(n) && n >= 0 ? n : d; };
    return {
      gia: num(p.get('gia'), ''),
      ten: p.get('ten') || '',
      vt: Math.min(4, Math.max(1, parseInt(p.get('vt'), 10) || 1)),
      dt: num(p.get('dt'), ''),
      mt2: p.get('mt2') === '1',
      loai: LOAI_DAT.some(l => l.id === p.get('loai')) ? p.get('loai') : 'o',
    };
  }
  function renderCalc(p){
    const s = calcState(p);
    return `<div class="page-title">Máy tính giá đất</div>
      <div class="page-sub">${s.ten ? 'Tuyến: <b>' + esc(s.ten) + '</b>' : 'Nhập giá Vị trí 1, hoặc bấm “Tính giá” ở một tuyến đường bất kỳ.'}</div>
      <div class="calc-grid">
        <form class="calc" id="calcForm" onsubmit="return false">
          <div class="field"><label for="cGia">Giá Vị trí 1 (nghìn đồng/m²)</label>
            <input id="cGia" name="gia" type="number" inputmode="decimal" min="0" step="any" value="${esc(s.gia)}" placeholder="Ví dụ 5400"></div>
          <div class="field"><label>Vị trí thửa đất</label>
            <div class="seg" role="radiogroup">${VT.map(v => `<button type="button" role="radio" aria-checked="${v.id === s.vt}" data-vt="${v.id}" class="${v.id === s.vt ? 'on' : ''}">${v.label}<br><small>${v.pct}%</small></button>`).join('')}</div>
            <div class="hint">VT1 0–30m · VT2 30–60m · VT3 60–90m · VT4 trên 90m tính từ mặt tiền.</div></div>
          <div class="field"><label for="cLoai">Loại đất</label>
            <select id="cLoai" name="loai">${LOAI_DAT.map(l => `<option value="${l.id}" ${l.id === s.loai ? 'selected' : ''}>${esc(l.label)} (${l.pct}%)</option>`).join('')}</select></div>
          <div class="field"><label for="cDt">Diện tích (m²)</label>
            <input id="cDt" name="dt" type="number" inputmode="decimal" min="0" step="any" value="${esc(s.dt)}" placeholder="Ví dụ 100"></div>
          <label class="switch-row"><span>Thửa đất giáp 2 mặt tiền trở lên (×1,2)</span>
            <span class="ios-switch"><input type="checkbox" id="cMt2" ${s.mt2 ? 'checked' : ''}><span class="track"><span class="knob"></span></span></span></label>
        </form>
        <div>
          <div class="result" id="calcResult"></div>
          <div class="note">Kết quả chỉ để tham khảo. Với VT2–VT4, nếu giá tính ra thấp hơn giá đất ở <i>chưa có cơ sở hạ tầng thuận lợi giao thông</i> của xã/phường thì lấy theo mức đó. Với 2 mặt tiền, nhập giá của tuyến có mức cao nhất.</div>
          <button class="more-btn" id="calcShare" type="button">Chia sẻ kết quả</button>
        </div>
      </div>`;
  }
  function updateCalc(){
    const gia = parseFloat($('#cGia').value);
    const dt = parseFloat($('#cDt').value);
    const vt = VT.find(v => v.id === +($('.seg .on') || {dataset:{vt:1}}).dataset.vt);
    const loai = LOAI_DAT.find(l => l.id === $('#cLoai').value);
    const mt2 = $('#cMt2').checked;
    const out = $('#calcResult');
    if(!(gia > 0)){
      out.innerHTML = `<div class="lbl">Đơn giá</div><div class="big">—</div><div class="formula">Nhập giá Vị trí 1 để tính.</div>`;
    } else {
      const heso = mt2 ? 1.2 : 1;
      const don = gia * 1000 * vt.pct / 100 * heso * loai.pct / 100;
      let f = `${fmt(gia * 1000)} × ${vt.pct}% (${vt.label})${mt2 ? ' × 1,2' : ''}${loai.pct !== 100 ? ' × ' + loai.pct + '%' : ''}`;
      out.innerHTML = `<div class="lbl">Đơn giá</div><div class="big">${fmt(don)} đ/m²</div>
        ${dt > 0 ? `<div class="lbl">Thành tiền (${fmt(dt)} m²)</div><div class="big">${fmt(don * dt)} đ</div>` : ''}
        <div class="formula">${f} = ${fmt(don)} đ/m²${dt > 0 ? '<br>' + fmt(don) + ' × ' + fmt(dt) + ' m² = ' + fmt(don * dt) + ' đ' : ''}</div>`;
    }
    // Ghi trạng thái vào địa chỉ để chia sẻ được, không tạo thêm lịch sử.
    const p = new URLSearchParams();
    if($('#cGia').value) p.set('gia', $('#cGia').value);
    const ten = parseRoute().params.get('ten'); if(ten) p.set('ten', ten);
    if(vt.id !== 1) p.set('vt', vt.id);
    if(loai.id !== 'o') p.set('loai', loai.id);
    if($('#cDt').value) p.set('dt', $('#cDt').value);
    if(mt2) p.set('mt2', '1');
    const qs = p.toString();
    history.replaceState(null, '', '#/may-tinh' + (qs ? '?' + qs : ''));
  }

  /* ---------- Gắn sự kiện sau mỗi lần vẽ ---------- */
  function afterRender(r){
    const back = $('#backBtn');
    if(back) back.addEventListener('click', () => {
      if(inAppNav) history.back();
      else location.hash = '#/';
    });
    const sh = $('#shareBtn');
    if(sh) sh.addEventListener('click', () => share(document.title));
    const lf = $('#localFilter');
    if(lf){
      const khu = REGION_BY_SLUG[r.slug];
      lf.addEventListener('input', () => { $('#detailRows').innerHTML = renderDetailRows(khu, lf.value); });
    }
    const more = $('#moreBtn');
    if(more) more.addEventListener('click', () => { searchLimit += PAGE_SIZE * 2; const y = scrollY; render(); scrollTo(0, y); });
    if(r.name === 'may-tinh'){
      $('#calcForm').addEventListener('input', updateCalc);
      $('#calcForm').addEventListener('change', updateCalc);
      $$('.seg button').forEach(b => b.addEventListener('click', () => {
        $$('.seg button').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
        b.classList.add('on'); b.setAttribute('aria-checked', 'true'); updateCalc();
      }));
      $('#calcShare').addEventListener('click', () => share('Máy tính giá đất Cà Mau 2026'));
      updateCalc();
    }
  }

  /* ---------- Ô tìm kiếm ---------- */
  let typing;
  input.addEventListener('input', () => {
    clearBtn.hidden = !input.value;
    clearTimeout(typing);
    typing = setTimeout(() => {
      const q = input.value.trim();
      searchLimit = PAGE_SIZE;
      if(q){
        const target = '#/tim/' + encodeURIComponent(q);
        if(parseRoute().name === 'tim') history.replaceState(null, '', target);
        else { history.pushState(null, '', target); inAppNav = true; searchPushed = true; }
      } else { leaveSearch(); return; }
      render();
      scrollTo(0, 0);
    }, 150);
  });
  clearBtn.addEventListener('click', () => {
    input.value = ''; clearBtn.hidden = true;
    leaveSearch(); input.focus();
  });
  // Rời trang tìm kiếm: quay về trang trước đó mà không để lại mục lịch sử thừa.
  function leaveSearch(){
    if(parseRoute().name !== 'tim') return;
    if(searchPushed){ searchPushed = false; history.back(); }
    else { history.replaceState(null, '', preSearchHash); render(); }
  }
  input.addEventListener('keydown', e => { if(e.key === 'Enter') input.blur(); });
  window.addEventListener('hashchange', () => { inAppNav = true; if(parseRoute().name !== 'tim') searchPushed = false; searchLimit = PAGE_SIZE; render(); scrollTo(0, 0); });

  /* ---------- Thanh điều hướng & sidebar ---------- */
  function buildNav(){
    $('#sideNav').innerHTML = NAV.map(n => `<a href="${n.href}" data-route="${n.route}">${ICONS[n.icon]}<span>${n.label}</span></a>`).join('');
    $('#tabBar').innerHTML = NAV.map(n => `<a href="${n.href}" data-route="${n.route}">${ICONS[n.icon]}<span>${n.short}</span></a>`).join('');
    const list = $('#sideList');
    const draw = f => {
      const toks = tokens(f);
      const ok = k => toks.every(t => k._fold.includes(t));
      let html = '';
      [['phuong', 'Phường'], ['xa', 'Xã']].forEach(([loai, lbl]) => {
        const ks = DATA.khu_vuc.filter(k => k.loai === loai && ok(k));
        if(!ks.length) return;
        html += `<div class="grp">${lbl}</div>` + ks.map(k => `<a href="#/khu/${slug(k.ten)}" data-slug="${slug(k.ten)}"><span>${esc(niceName(k.ten).replace(/^(Xã|Phường) /, ''))}</span><small>${k.rows.length}</small></a>`).join('');
      });
      list.innerHTML = html || '<div class="grp">Không có kết quả</div>';
      const r = parseRoute();
      $$('a', list).forEach(a => a.classList.toggle('active', r.name === 'khu' && a.dataset.slug === r.slug));
    };
    $('#sideFilter').addEventListener('input', e => draw(e.target.value));
    draw('');
  }

  /* ---------- Khởi động ---------- */
  function prepare(data){
    DATA = data;
    INDEX = [];
    data.khu_vuc.forEach(k => {
      k._start = INDEX.length;
      k._fold = fold(k.ten) + ' ' + fold(niceName(k.ten).replace(/^(Xã|Phường) /, ''));
      REGION_BY_SLUG[slug(k.ten)] = k;
      const pinned = PINNED.includes(k.ten);
      k.rows.forEach(row => {
        const hay = fold([row[0], row[1], row[2]].filter(Boolean).join(' '));
        INDEX.push({khu:k, row, pinned, hay, hayAll: hay + ' ' + fold(row[5] || '') + ' ' + k._fold});
      });
    });
    if(data.meta && data.meta.cap_nhat){
      const [y, m, d] = data.meta.cap_nhat.split('-');
      $('#dataDate').textContent = `Dữ liệu cập nhật ngày ${d}/${m}/${y}.`;
    }
  }

  fetch('data.json')
    .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => { prepare(data); buildNav(); render(); })
    .catch(() => { view.innerHTML = '<div class="empty"><div class="big">⚠︎</div>Không tải được dữ liệu. Kiểm tra kết nối mạng rồi tải lại trang.</div>'; });

  if('serviceWorker' in navigator && location.protocol === 'https:'){
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
