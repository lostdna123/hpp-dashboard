(function () {
  'use strict';

  /* ================= util ================= */
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rp = n => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
  const rpS = n => { // ringkas: Rp12,3 jt
    const a = Math.abs(n || 0);
    if (a >= 1e9) return 'Rp' + (n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' M';
    if (a >= 1e6) return 'Rp' + (n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';
    if (a >= 1e3) return 'Rp' + (n / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 }) + ' rb';
    return rp(n);
  };
  const pct = (x, d = 1) => (x == null || !isFinite(x)) ? '–' : (x * 100).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
  const num = (x, d = 1) => (x || 0).toLocaleString('id-ID', { maximumFractionDigits: d });
  const sum = a => a.reduce((s, x) => s + x, 0);
  const pad = n => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const labelBulan = b => NAMA_BULAN[Number(b.slice(5, 7)) - 1] + ' ' + b.slice(2, 4);
  const monthsBetween = (a, b) => { const out = []; let [y, m] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number); while (y < y2 || (y === y2 && m <= m2)) { out.push(y + '-' + pad(m)); m++; if (m > 12) { m = 1; y++; } } return out; };
  const shiftMonth = (b, n) => { let [y, m] = b.split('-').map(Number); m += n; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return y + '-' + pad(m); };
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* abaikan */ } };
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i); return (h >>> 0).toString(36); };
  let toastT;
  const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 3500); };
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  /* ================= state ================= */
  const K = { cfg: 'hppdash.cfg', ai: 'hppdash.ai', ui: 'hppdash.ui' };
  const st = {
    cfg: load(K.cfg, { url: '', key: '', demo: false }),
    data: null, anomali: [], scope: null,
    tab: 'anomali', dim: 'semua', q: '', charts: {}
  };
  const JENIS_LABEL = { item: 'Per bahan', store: 'Per outlet', bulan: 'Per bulan', data: 'Kualitas data' };
  const LEVEL = { tinggi: ['▲', 'Tinggi'], sedang: ['●', 'Sedang'], rendah: ['○', 'Rendah'] };

  /* ================= koneksi ================= */
  async function api(body) {
    const res = await fetch(st.cfg.url, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // "simple request" → tanpa preflight CORS
      body: JSON.stringify(Object.assign({ key: st.cfg.key }, body))
    });
    const txt = await res.text();
    let out;
    try { out = JSON.parse(txt); } catch (e) { throw new Error('Respon bukan JSON. Cek URL (harus berakhiran /exec) dan pastikan Apps Script sudah di-deploy versi terbaru.'); }
    if (!out.ok) throw new Error(out.error || 'Gagal');
    return out;
  }

  function normalisasi(raw) {
    if (raw.demo) return raw;
    return {
      namaFile: raw.namaFile, diambil: raw.diambil, batasFoodCost: raw.batasFoodCost,
      stores: raw.stores, bahan: raw.bahan,
      belanja: raw.belanja.map(r => ({ tgl: r[0], bulan: r[1], brand: r[2], store: r[3], pic: r[4], kategori: r[5], bahan: r[6], qty: r[7], satuan: r[8], harga: r[9], total: r[10], supplier: r[11], flag: r[12], id: r[13] })),
      omzet: raw.omzet.map(r => ({ tgl: r[0], bulan: r[1], brand: r[2], store: r[3], omzet: r[4], struk: r[5] }))
    };
  }

  async function muat() {
    const s = $('#status');
    if (st.cfg.demo) {
      st.data = buatDemo(today());
    } else if (st.cfg.url && st.cfg.key) {
      s.className = 'status'; s.textContent = 'Mengambil data…';
      try { st.data = normalisasi(await api({ api: 'data' })); }
      catch (e) { s.className = 'status err'; s.textContent = 'Gagal terhubung'; toast(e.message); bukaSetting(e.message); return; }
    } else { bukaSetting(); return; }
    setStatus();
    isiFilter();
    render();
  }

  function setStatus() {
    const s = $('#status');
    if (st.data.demo) { s.className = 'status demo'; s.textContent = 'Data demo (fiktif)'; }
    else { s.className = 'status live'; s.textContent = 'Live · ' + (st.data.namaFile || 'Google Sheet'); }
    const d = new Date(st.data.diambil);
    $('#diambil').textContent = 'diambil ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /* ================= pengaturan ================= */
  function bukaSetting(pesan) {
    $('#sUrl').value = st.cfg.url || '';
    $('#sKey').value = st.cfg.key || '';
    msg(pesan || '', pesan ? 'err' : '');
    const d = $('#dlgSetting'); if (!d.open) d.showModal();
  }
  function msg(t, cls) { const m = $('#sMsg'); m.textContent = t; m.className = 'msg ' + (cls || ''); m.classList.toggle('hidden', !t); }
  $('#btnSetting').addEventListener('click', () => bukaSetting());
  $('#sBatal').addEventListener('click', () => $('#dlgSetting').close());
  $('#sDemo').addEventListener('click', () => { st.cfg.demo = true; save(K.cfg, st.cfg); $('#dlgSetting').close(); muat(); });
  $('#sSimpan').addEventListener('click', async () => {
    const url = $('#sUrl').value.trim(), key = $('#sKey').value.trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) return msg('URL harus diawali https://script.google.com/macros/s/ dan berakhiran /exec', 'err');
    if (!key) return msg('Isi kunci dashboard dulu.', 'err');
    const lama = Object.assign({}, st.cfg);
    st.cfg = { url, key, demo: false };
    msg('Mengetes koneksi…', '');
    $('#sSimpan').disabled = true;
    try {
      const p = await api({ api: 'ping' });
      save(K.cfg, st.cfg);
      msg('Terhubung ke "' + p.namaFile + '"' + (p.aiAktif ? ' · Analisis AI aktif' : ' · Analisis AI belum aktif (API key Claude belum di-set)'), 'ok');
      setTimeout(() => { $('#dlgSetting').close(); muat(); }, 700);
    } catch (e) { st.cfg = lama; msg(e.message, 'err'); }
    finally { $('#sSimpan').disabled = false; }
  });
  $('#btnRefresh').addEventListener('click', () => muat());

  /* ================= filter ================= */
  function isiFilter() {
    const d = st.data;
    const semuaBulan = [...new Set(d.belanja.map(r => r.bulan).concat(d.omzet.map(r => r.bulan)).concat([today().slice(0, 7)]))].sort();
    const bulan = monthsBetween(semuaBulan[0], semuaBulan[semuaBulan.length - 1]);
    const ui = load(K.ui, {});
    const opt = (arr, lbl) => arr.map(b => '<option value="' + esc(b) + '">' + esc(lbl ? lbl(b) : b) + '</option>').join('');
    $('#fDari').innerHTML = opt(bulan, labelBulan);
    $('#fSampai').innerHTML = opt(bulan, labelBulan);
    const akhir = bulan[bulan.length - 1];
    $('#fSampai').value = bulan.includes(ui.sampai) ? ui.sampai : akhir;
    $('#fDari').value = bulan.includes(ui.dari) ? ui.dari : bulan[Math.max(0, bulan.length - 3)];
    const brands = [...new Set(d.stores.map(s => s.brand))];
    $('#fBrand').innerHTML = '<option value="">Semua brand</option>' + opt(brands);
    $('#fBrand').value = brands.includes(ui.brand) ? ui.brand : '';
    isiStore(ui.store);
  }
  function isiStore(pilih) {
    const b = $('#fBrand').value;
    const list = st.data.stores.filter(s => !b || s.brand === b);
    $('#fStore').innerHTML = '<option value="">Semua outlet</option>' + list.map(s => '<option value="' + esc(s.kode) + '">' + esc(s.kode + ' · ' + s.nama) + '</option>').join('');
    $('#fStore').value = list.some(s => s.kode === pilih) ? pilih : '';
  }
  ['#fDari', '#fSampai', '#fStore'].forEach(id => $(id).addEventListener('change', () => { simpanUi(); render(); }));
  $('#fBrand').addEventListener('change', () => { isiStore(''); simpanUi(); render(); });
  function simpanUi() { save(K.ui, { dari: $('#fDari').value, sampai: $('#fSampai').value, brand: $('#fBrand').value, store: $('#fStore').value }); }

  function hitungScope() {
    let dari = $('#fDari').value, sampai = $('#fSampai').value;
    if (dari > sampai) { const t = dari; dari = sampai; sampai = t; }
    const brand = $('#fBrand').value, store = $('#fStore').value;
    const storeList = st.data.stores.filter(s => (!brand || s.brand === brand) && (!store || s.kode === store)).map(s => s.kode);
    const storeSet = (brand || store) ? new Set(storeList) : null;
    const bulan = monthsBetween(dari, sampai);
    const n = bulan.length;
    return { dari, sampai, bulan, storeSet, storeList, brand, store, prevDari: shiftMonth(dari, -n), prevSampai: shiftMonth(dari, -1) };
  }
  const inStore = (sc, s) => !sc.storeSet || sc.storeSet.has(s);

  /* ================= render ================= */
  function render() {
    if (!st.data) return;
    const sc = st.scope = hitungScope();
    st.anomali = Anomali.deteksi(st.data, { bulanDari: sc.dari, bulanSampai: sc.sampai, storeSet: sc.storeSet, hariIni: today() });
    renderKpi();
    $('#cntAnomali').textContent = st.anomali.length;
    renderAiMeta();
    renderTab();
  }

  function agregat(sc, dari, sampai) {
    const B = st.data.belanja.filter(r => r.bulan >= dari && r.bulan <= sampai && inStore(sc, r.store));
    const O = st.data.omzet.filter(r => r.bulan >= dari && r.bulan <= sampai && inStore(sc, r.store));
    const bel = sum(B.map(r => r.total)), omz = sum(O.map(r => r.omzet));
    return { B, O, bel, omz, fc: omz > 0 ? bel / omz : null };
  }

  function renderKpi() {
    const sc = st.scope, a = agregat(sc, sc.dari, sc.sampai), p = agregat(sc, sc.prevDari, sc.prevSampai);
    const tinggi = st.anomali.filter(x => x.level === 'tinggi').length, sedang = st.anomali.filter(x => x.level === 'sedang').length;
    const bocor = sum(st.anomali.filter(x => x.dimensi === 'item' && x.jenis !== 'harga-pasar' || x.dimensi === 'data' && x.jenis === 'dobel').map(x => x.dampak));
    const delta = (cur, prev, pctPoin) => {
      if (prev == null || !prev || cur == null) return '<div class="d">vs periode sebelumnya: –</div>';
      if (pctPoin) { const d = (cur - prev) * 100; return '<div class="d ' + (d > 0.05 ? 'up' : d < -0.05 ? 'down' : '') + '">' + (d > 0 ? '▲ +' : d < 0 ? '▼ ' : '') + num(d, 1) + ' poin vs periode sebelumnya</div>'; }
      const r = cur / prev - 1; return '<div class="d">' + (r >= 0 ? '▲ +' : '▼ ') + pct(r, 0) + ' vs periode sebelumnya</div>';
    };
    const batas = st.data.batasFoodCost || 0.35;
    $('#kpis').innerHTML = [
      '<div class="kpi"><div class="l">Food cost</div><div class="v' + (a.fc > batas ? ' over' : '') + '">' + pct(a.fc) + '</div>' + delta(a.fc, p.fc, true) + '</div>',
      '<div class="kpi"><div class="l">Total belanja</div><div class="v">' + rpS(a.bel) + '</div>' + delta(a.bel, p.bel) + '</div>',
      '<div class="kpi"><div class="l">Omzet</div><div class="v">' + rpS(a.omz) + '</div>' + delta(a.omz, p.omz) + '</div>',
      '<div class="kpi"><div class="l">Anomali</div><div class="v">' + st.anomali.length + '</div><div class="d">' + tinggi + ' tinggi · ' + sedang + ' sedang</div></div>',
      '<div class="kpi" title="Jumlah estimasi selisih dari anomali harga, pemakaian & input dobel. Bisa tumpang tindih — pakai sebagai indikasi, bukan angka akuntansi."><div class="l">Potensi kebocoran ⓘ</div><div class="v">' + rpS(bocor) + '</div><div class="d">estimasi dari anomali per bahan</div></div>'
    ].join('');
  }

  /* ---------- tabs ---------- */
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
    st.tab = b.dataset.tab;
    document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    renderTab();
  }));
  function renderTab() {
    ['anomali', 'store', 'item', 'bulan'].forEach(t => $('#v-' + t).classList.toggle('hidden', t !== st.tab));
    if (st.tab === 'anomali') renderAnomali();
    if (st.tab === 'store') renderStore();
    if (st.tab === 'item') renderItem();
    if (st.tab === 'bulan') renderBulan();
  }

  /* ---------- anomali ---------- */
  function renderAnomali() {
    const cnt = d => st.anomali.filter(a => d === 'semua' || a.dimensi === d).length;
    $('#chips').innerHTML = ['semua', 'item', 'store', 'bulan', 'data'].map(d =>
      '<button class="chip' + (st.dim === d ? ' on' : '') + '" data-dim="' + d + '">' + (d === 'semua' ? 'Semua' : JENIS_LABEL[d]) + ' (' + cnt(d) + ')</button>').join('');
    $('#chips').querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { st.dim = c.dataset.dim; renderAnomali(); }));

    const list = st.anomali.filter(a => st.dim === 'semua' || a.dimensi === st.dim);
    if (!st.data.belanja.length) {
      $('#anList').innerHTML = '<div class="empty">Belum ada data belanja di Google Sheet. Begitu tim outlet mulai input dari app HP, anomali akan muncul di sini.<br><br>Mau lihat contohnya dulu? Buka <b>Pengaturan › Coba pakai data demo</b>.</div>';
      return;
    }
    if (!list.length) { $('#anList').innerHTML = '<div class="empty">Tidak ada anomali untuk filter ini. 👍<br>Deteksi butuh histori minimal ±3 bulan untuk perbandingan yang adil.</div>'; return; }
    $('#anList').innerHTML = list.map((a, i) =>
      '<article class="an ' + a.level + '">' +
        '<div class="an-head"><span class="lvl ' + a.level + '"><i>' + LEVEL[a.level][0] + '</i>' + LEVEL[a.level][1] + '</span>' +
        '<span class="tag">' + JENIS_LABEL[a.dimensi] + '</span>' +
        '<span class="meta">' + esc([a.bulan ? labelBulan(a.bulan) : '', a.namaStore].filter(Boolean).join(' · ')) + '</span></div>' +
        '<h3>' + esc(a.judul) + '</h3><p>' + esc(a.detail) + '</p>' +
        '<div class="an-foot"><span class="dampak">' + (a.dampak ? 'Dampak ±<b>' + rpS(a.dampak) + '</b>' : '') + '</span>' +
        (a.grafik ? '<button class="btn ghost" data-i="' + i + '">Lihat grafik</button>' : '') + '</div>' +
      '</article>').join('');
    $('#anList').querySelectorAll('button[data-i]').forEach(b => b.addEventListener('click', () => bukaGrafik(list[Number(b.dataset.i)].grafik, list[Number(b.dataset.i)])));
  }

  /* ---------- per outlet ---------- */
  function warnaStore() {
    const w = {}; st.data.stores.forEach((s, i) => { w[s.kode] = i < 8 ? css('--s' + (i + 1)) : css('--muted'); }); return w;
  }
  function renderStore() {
    const sc = st.scope, W = warnaStore(), batas = st.data.batasFoodCost || 0.35;
    const stores = st.data.stores.filter(s => inStore(sc, s.kode));
    const bulan = sc.bulan.length >= 6 ? sc.bulan : monthsBetween(shiftMonth(sc.sampai, -5), sc.sampai);
    const fcSB = (s, b) => {
      const bel = sum(st.data.belanja.filter(r => r.store === s && r.bulan === b).map(r => r.total));
      const omz = sum(st.data.omzet.filter(r => r.store === s && r.bulan === b).map(r => r.omzet));
      return omz > 0 ? bel / omz : null;
    };
    const tampil = stores.slice(0, 8);
    $('#storeChartNote').textContent = (stores.length > 8 ? '8 outlet pertama ditampilkan · ' : '') + 'garis putus-putus = batas ' + pct(batas, 0);
    const ds = tampil.map(s => ({ label: s.kode, data: bulan.map(b => fcSB(s.kode, b)), borderColor: W[s.kode], backgroundColor: W[s.kode], spanGaps: true }));
    ds.push({ label: 'Batas', data: bulan.map(() => batas), borderColor: css('--muted'), borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0 });
    gambar('chStore', 'line', bulan.map(labelBulan), ds, { persen: true });

    const rows = stores.map(s => {
      const f = r => r.store === s.kode;
      const bel = sum(st.data.belanja.filter(r => f(r) && r.bulan >= sc.dari && r.bulan <= sc.sampai).map(r => r.total));
      const omz = sum(st.data.omzet.filter(r => f(r) && r.bulan >= sc.dari && r.bulan <= sc.sampai).map(r => r.omzet));
      const belP = sum(st.data.belanja.filter(r => f(r) && r.bulan >= sc.prevDari && r.bulan <= sc.prevSampai).map(r => r.total));
      const omzP = sum(st.data.omzet.filter(r => f(r) && r.bulan >= sc.prevDari && r.bulan <= sc.prevSampai).map(r => r.omzet));
      const an = st.anomali.filter(a => a.store === s.kode);
      return { s, bel, omz, fc: omz > 0 ? bel / omz : null, fcP: omzP > 0 ? belP / omzP : null, n: an.length, nT: an.filter(a => a.level === 'tinggi').length, dampak: sum(an.map(a => a.dampak)) };
    }).sort((a, b) => (b.fc || 0) - (a.fc || 0));
    $('#tbStore').innerHTML = '<thead><tr><th>Outlet</th><th class="n">Belanja</th><th class="n">Omzet</th><th class="n">Food cost</th><th class="n">vs sebelumnya</th><th class="n">Anomali</th><th class="n">Dampak anomali</th></tr></thead><tbody>' +
      rows.map(r => {
        const d = r.fc != null && r.fcP != null ? (r.fc - r.fcP) * 100 : null;
        return '<tr class="klik" data-s="' + esc(r.s.kode) + '"><td><span class="sw" style="background:' + W[r.s.kode] + '"></span><b>' + esc(r.s.kode) + '</b> ' + esc(r.s.nama) + '</td>' +
          '<td class="n">' + rp(r.bel) + '</td><td class="n">' + rp(r.omz) + '</td>' +
          '<td class="n ' + (r.fc > batas ? 'over' : '') + '">' + pct(r.fc) + '</td>' +
          '<td class="n ' + (d > 0.05 ? 'up' : d < -0.05 ? 'down' : '') + '">' + (d == null ? '–' : (d > 0 ? '+' : '') + num(d, 1) + ' poin') + '</td>' +
          '<td class="n"><span class="badge' + (r.nT ? ' hot' : '') + '">' + r.n + '</span></td><td class="n">' + (r.dampak ? rpS(r.dampak) : '–') + '</td></tr>';
      }).join('') + '</tbody>';
    $('#tbStore').querySelectorAll('tr.klik').forEach(tr => tr.addEventListener('click', () => {
      const s = st.data.stores.find(x => x.kode === tr.dataset.s);
      $('#fBrand').value = s.brand; isiStore(s.kode); simpanUi(); render();
      toast('Filter: ' + s.kode + ' · ' + s.nama);
    }));
  }

  /* ---------- per bahan ---------- */
  $('#qItem').addEventListener('input', e => { st.q = e.target.value.toLowerCase(); renderItem(); });
  function renderItem() {
    const sc = st.scope;
    const cur = st.data.belanja.filter(r => r.bulan >= sc.dari && r.bulan <= sc.sampai && inStore(sc, r.store));
    const prev = st.data.belanja.filter(r => r.bulan >= sc.prevDari && r.bulan <= sc.prevSampai && inStore(sc, r.store));
    const g = Anomali.groupBy(cur, r => r.bahan), gp = Anomali.groupBy(prev, r => r.bahan);
    const rows = [...g.entries()].map(([bahan, rs]) => {
      const qty = sum(rs.map(r => r.qty)), tot = sum(rs.map(r => r.total));
      const p = gp.get(bahan) || [], qP = sum(p.map(r => r.qty)), tP = sum(p.map(r => r.total));
      const h = qty ? tot / qty : 0, hP = qP ? tP / qP : null;
      return { bahan, kat: rs[0].kategori, sat: rs[0].satuan, qty, tot, h, chg: hP ? h / hP - 1 : null, n: st.anomali.filter(a => a.bahan === bahan).length };
    }).filter(r => !st.q || r.bahan.toLowerCase().includes(st.q)).sort((a, b) => b.tot - a.tot);
    const total = sum(rows.map(r => r.tot));
    $('#tbItem').innerHTML = '<thead><tr><th>Bahan</th><th>Kategori</th><th class="n">Qty</th><th class="n">Belanja</th><th class="n">Porsi</th><th class="n">Harga rata²</th><th class="n">vs sebelumnya</th><th class="n">Anomali</th></tr></thead><tbody>' +
      (rows.length ? rows.map(r =>
        '<tr class="klik" data-b="' + esc(r.bahan) + '"><td><b>' + esc(r.bahan) + '</b></td><td>' + esc(r.kat) + '</td>' +
        '<td class="n">' + num(r.qty) + ' ' + esc(r.sat) + '</td><td class="n">' + rp(r.tot) + '</td><td class="n">' + pct(total ? r.tot / total : 0) + '</td>' +
        '<td class="n">' + rp(r.h) + '/' + esc(r.sat) + '</td>' +
        '<td class="n ' + (r.chg > 0.1 ? 'up' : r.chg < -0.05 ? 'down' : '') + '">' + (r.chg == null ? '–' : (r.chg >= 0 ? '+' : '') + pct(r.chg, 0)) + '</td>' +
        '<td class="n"><span class="badge' + (r.n ? ' hot' : '') + '">' + r.n + '</span></td></tr>').join('')
        : '<tr><td colspan="8" class="hint">Tidak ada data belanja untuk filter ini.</td></tr>') + '</tbody>';
    $('#tbItem').querySelectorAll('tr.klik').forEach(tr => tr.addEventListener('click', () => bukaGrafik({ tipe: 'harga', bahan: tr.dataset.b, store: sc.store || null })));
  }

  /* ---------- per bulan ---------- */
  function renderBulan() {
    const sc = st.scope, batas = st.data.batasFoodCost || 0.35;
    const bulan = monthsBetween(shiftMonth(sc.sampai, -11), sc.sampai).filter(b => st.data.belanja.some(r => r.bulan === b) || st.data.omzet.some(r => r.bulan === b) || b >= sc.dari);
    const rows = bulan.map(b => {
      const a = agregat(sc, b, b);
      const kat = Anomali.groupBy(a.B, r => r.kategori);
      let top = ['–', 0]; kat.forEach((rs, k) => { const t = sum(rs.map(r => r.total)); if (t > top[1]) top = [k, t]; });
      const an = Anomali.deteksi(st.data, { bulanDari: b, bulanSampai: b, storeSet: sc.storeSet, hariIni: today() });
      return { b, bel: a.bel, omz: a.omz, fc: a.fc, top, n: an.length };
    });
    gambar('chBulan', 'line', rows.map(r => labelBulan(r.b)), [
      { label: 'Food cost', data: rows.map(r => r.fc), borderColor: css('--s1'), backgroundColor: css('--s1'), spanGaps: true },
      { label: 'Batas', data: rows.map(() => batas), borderColor: css('--muted'), borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0 }
    ], { persen: true });
    $('#tbBulan').innerHTML = '<thead><tr><th>Bulan</th><th class="n">Belanja</th><th class="n">Omzet</th><th class="n">Food cost</th><th>Kategori terbesar</th><th class="n">Anomali</th></tr></thead><tbody>' +
      rows.slice().reverse().map(r => '<tr><td><b>' + labelBulan(r.b) + '</b>' + (r.b === today().slice(0, 7) ? ' <span class="hint">(berjalan)</span>' : '') + '</td>' +
        '<td class="n">' + rp(r.bel) + '</td><td class="n">' + rp(r.omz) + '</td><td class="n ' + (r.fc > batas ? 'over' : '') + '">' + pct(r.fc) + '</td>' +
        '<td>' + esc(r.top[0]) + (r.top[1] ? ' <span class="hint">' + rpS(r.top[1]) + '</span>' : '') + '</td><td class="n"><span class="badge">' + r.n + '</span></td></tr>').join('') + '</tbody>';
  }

  /* ================= grafik ================= */
  function gambar(id, tipe, labels, datasets, o) {
    o = o || {};
    if (st.charts[id]) st.charts[id].destroy();
    const grid = css('--grid'), muted = css('--muted'), ink2 = css('--ink-2');
    const fmt = v => v == null ? '–' : o.persen ? pct(v) : o.satuan ? rp(v) + '/' + o.satuan : o.qty ? num(v) + ' ' + (o.unit || '') : rp(v);
    datasets.forEach(d => {
      if (tipe === 'line') Object.assign(d, Object.assign({ borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0, fill: false }, d));
      if (tipe === 'bar') Object.assign(d, Object.assign({ borderRadius: 4, maxBarThickness: 32, borderSkipped: 'start' }, d));
    });
    st.charts[id] = new Chart(document.getElementById(id), {
      type: tipe, data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: datasets.length > 1, position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, color: ink2, padding: 14 } },
          tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + fmt(c.parsed.y) } }
        },
        scales: {
          x: { grid: { display: false }, border: { color: css('--line-strong') }, ticks: { color: muted, maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: !o.persen, grid: { color: grid }, border: { display: false }, ticks: { color: muted, callback: v => o.persen ? pct(v, 0) : rpS(v).replace('Rp', o.qty ? '' : 'Rp') } }
        }
      }
    });
  }

  function tabelDetail(labels, datasets, fmt) {
    $('#tbDetail').innerHTML = '<thead><tr><th>Periode</th>' + datasets.map(d => '<th class="n">' + esc(d.label) + '</th>').join('') + '</tr></thead><tbody>' +
      labels.map((l, i) => '<tr><td>' + esc(l) + '</td>' + datasets.map(d => '<td class="n">' + (d.data[i] == null ? '–' : fmt(d.data[i])) + '</td>').join('') + '</tr>').join('') + '</tbody>';
  }

  function bukaGrafik(g, anomali) {
    const W = warnaStore(), D = st.data, sc = st.scope;
    const bulan6 = monthsBetween(shiftMonth(sc.sampai, -5), sc.sampai);
    let title = '', sub = anomali ? anomali.detail : '', labels = [], ds = [], opt = {}, fmt = rp;

    if (g.tipe === 'harga') {
      const sat = (D.bahan.find(b => b.nama === g.bahan) || {}).satuan || '';
      title = 'Harga ' + g.bahan + ' per ' + sat;
      if (!sub) sub = 'Rata-rata mingguan per outlet' + (g.store ? ', ' + g.store + ' ditebalkan' : '') + '.';
      const rows = D.belanja.filter(r => r.bahan === g.bahan && r.bulan >= bulan6[0] && r.bulan <= sc.sampai);
      const minggu = r => { const d = new Date(r.tgl + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
      labels = [...new Set(rows.map(minggu))].sort();
      const perS = Anomali.groupBy(rows, r => r.store);
      ds = D.stores.filter(s => perS.has(s.kode)).slice(0, 8).map(s => {
        const gm = Anomali.groupBy(perS.get(s.kode), minggu);
        const tebal = !g.store || g.store === s.kode;
        return { label: s.kode, data: labels.map(w => { const r = gm.get(w); return r ? sum(r.map(x => x.total)) / sum(r.map(x => x.qty)) : null; }),
          borderColor: W[s.kode], backgroundColor: W[s.kode], borderWidth: tebal ? 2.5 : 1.5, pointRadius: tebal ? 2 : 0, spanGaps: true };
      });
      labels = labels.map(w => Number(w.slice(8, 10)) + ' ' + NAMA_BULAN[Number(w.slice(5, 7)) - 1]);
      opt = { satuan: sat }; fmt = v => rp(v) + '/' + sat;
      gambarDetail('line', labels, ds, opt);
    } else if (g.tipe === 'qty') {
      const sat = (D.bahan.find(b => b.nama === g.bahan) || {}).satuan || '';
      title = 'Pembelian ' + g.bahan + ' di ' + g.store + ' per bulan';
      labels = bulan6.map(labelBulan);
      ds = [{ label: g.store, data: bulan6.map(b => sum(D.belanja.filter(r => r.store === g.store && r.bahan === g.bahan && r.bulan === b).map(r => r.qty)) || null), backgroundColor: W[g.store], borderColor: W[g.store] }];
      opt = { qty: true, unit: sat }; fmt = v => num(v) + ' ' + sat;
      gambarDetail('bar', labels, ds, opt);
    } else if (g.tipe === 'fc') {
      title = 'Food cost ' + g.store + ' per bulan';
      labels = bulan6.map(labelBulan);
      const batas = D.batasFoodCost || 0.35;
      ds = [{ label: g.store, data: bulan6.map(b => { const bel = sum(D.belanja.filter(r => r.store === g.store && r.bulan === b).map(r => r.total)); const o = sum(D.omzet.filter(r => r.store === g.store && r.bulan === b).map(r => r.omzet)); return o > 0 ? bel / o : null; }), borderColor: W[g.store], backgroundColor: W[g.store], spanGaps: true },
        { label: 'Batas', data: bulan6.map(() => batas), borderColor: css('--muted'), borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0 }];
      opt = { persen: true }; fmt = v => pct(v);
      gambarDetail('line', labels, ds, opt);
    } else if (g.tipe === 'kategori') {
      title = 'Porsi belanja ' + g.kategori + ' terhadap omzet';
      labels = bulan6.map(labelBulan);
      ds = [{ label: g.kategori, data: bulan6.map(b => { const a = agregat(sc, b, b); return a.omz > 0 ? sum(a.B.filter(r => r.kategori === g.kategori).map(r => r.total)) / a.omz : null; }), borderColor: css('--s1'), backgroundColor: css('--s1'), spanGaps: true }];
      opt = { persen: true }; fmt = v => pct(v);
      gambarDetail('line', labels, ds, opt);
    }
    $('#gTitle').textContent = title;
    $('#gSub').textContent = sub;
    tabelDetail(labels, ds.filter(d => d.label !== 'Batas'), fmt);
  }
  function gambarDetail(tipe, labels, ds, opt) {
    const d = $('#dlgChart'); if (!d.open) d.showModal();
    gambar('chDetail', tipe, labels, ds, opt);
  }
  $('#gTutup').addEventListener('click', () => $('#dlgChart').close());
  $('#dlgChart').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  /* ================= Analisis AI (hanya saat tombol diklik) ================= */
  const MAKS_ANOMALI_AI = 15;
  const HARGA = { 'claude-haiku-4-5-20251001': [1, 5], 'claude-sonnet-5': [2, 10] }; // USD per 1 juta token (input, output)

  function ringkasanAI() {
    const sc = st.scope, D = st.data, a = agregat(sc, sc.dari, sc.sampai);
    const bulan3 = monthsBetween(shiftMonth(sc.sampai, -2), sc.sampai);
    const stores = D.stores.filter(s => inStore(sc, s.kode));
    const baris = [];
    baris.push('Periode: ' + sc.dari + ' s/d ' + sc.sampai + ' · Outlet: ' + (sc.storeSet ? stores.map(s => s.kode).join(', ') : 'semua (' + stores.length + ')') + ' · Batas food cost: ' + pct(D.batasFoodCost || 0.35, 0));
    baris.push('Total: belanja ' + rp(a.bel) + ', omzet ' + rp(a.omz) + ', food cost ' + pct(a.fc) + '.');
    baris.push('', 'Food cost per outlet (3 bulan terakhir):');
    stores.forEach(s => {
      baris.push('- ' + s.kode + ' (' + s.brand + '): ' + bulan3.map(b => {
        const bel = sum(D.belanja.filter(r => r.store === s.kode && r.bulan === b).map(r => r.total));
        const o = sum(D.omzet.filter(r => r.store === s.kode && r.bulan === b).map(r => r.omzet));
        return b + ' ' + (o > 0 ? pct(bel / o) : 'omzet kosong');
      }).join(' | '));
    });
    baris.push('', 'Anomali terdeteksi: ' + st.anomali.length + ' (ditampilkan ' + Math.min(MAKS_ANOMALI_AI, st.anomali.length) + ' teratas, urut level lalu dampak):');
    st.anomali.slice(0, MAKS_ANOMALI_AI).forEach((x, i) => {
      baris.push((i + 1) + '. [' + x.level.toUpperCase() + '][' + JENIS_LABEL[x.dimensi] + '] ' + x.judul + ' (' + [x.bulan, x.store].filter(Boolean).join(', ') + '): ' + x.detail + (x.dampak ? ' Dampak ±' + rp(x.dampak) + '.' : ''));
    });
    const cur = st.data.belanja.filter(r => r.bulan >= sc.dari && r.bulan <= sc.sampai && inStore(sc, r.store));
    const top = [...Anomali.groupBy(cur, r => r.bahan).entries()].map(([b, rs]) => [b, sum(rs.map(r => r.total))]).sort((x, y) => y[1] - x[1]).slice(0, 8);
    baris.push('', 'Bahan dengan belanja terbesar: ' + top.map(([b, t]) => b + ' ' + rpS(t)).join('; ') + '.');
    return baris.join('\n');
  }

  function estimasi(model) {
    const teks = ringkasanAI();
    const tokIn = Math.round((teks.length + 1100) / 3.2), tokOut = 800;
    const [pi, po] = HARGA[model];
    return { teks, tokIn, usd: (tokIn * pi + tokOut * po) / 1e6 };
  }

  function renderAiMeta() {
    const model = $('#aiModel').value, e = estimasi(model);
    const cache = load(K.ai, {})[hash(e.teks + model)];
    const demo = st.data && st.data.demo;
    $('#aiMeta').innerHTML = 'Cuma jalan kalau tombol diklik. Yang dikirim hanya ringkasan ' + Math.min(MAKS_ANOMALI_AI, st.anomali.length) +
      ' anomali teratas + food cost per outlet (±' + e.tokIn.toLocaleString('id-ID') + ' token, perkiraan ±$' + e.usd.toFixed(3) + ' per analisis).' +
      (demo ? ' <b>Mode demo: sambungkan ke Google Sheet dulu untuk memakai AI.</b>' : '');
    $('#btnAI').disabled = !!demo || !st.anomali.length;
    $('#btnAI').textContent = cache ? 'Analisis ulang' : 'Analisis sekarang';
    if (cache) tampilAI(cache, true); else { $('#aiOut').classList.add('hidden'); $('#aiOut').innerHTML = ''; }
  }
  $('#aiModel').addEventListener('change', renderAiMeta);

  $('#btnAI').addEventListener('click', async () => {
    const model = $('#aiModel').value, e = estimasi(model);
    const btn = $('#btnAI');
    btn.disabled = true; btn.textContent = 'Menganalisis…';
    $('#aiOut').classList.remove('hidden');
    $('#aiOut').innerHTML = '<p class="hint">Claude sedang membaca ringkasan anomali…</p>';
    try {
      const r = await api({ api: 'ai', model: model, ringkasan: e.teks });
      const hasil = { teks: r.teks, model: r.model, usage: r.usage, sisa: r.sisaHariIni, waktu: Date.now() };
      const all = load(K.ai, {}); all[hash(e.teks + model)] = hasil;
      const keys = Object.keys(all); if (keys.length > 20) delete all[keys[0]];
      save(K.ai, all);
      tampilAI(hasil, false);
      btn.textContent = 'Analisis ulang';
    } catch (err) {
      $('#aiOut').innerHTML = '<p class="ai-err">Gagal: ' + esc(err.message) + '</p>';
      btn.textContent = 'Analisis sekarang';
    } finally { btn.disabled = false; }
  });

  function tampilAI(h, dariCache) {
    const d = new Date(h.waktu);
    const u = h.usage || {};
    $('#aiOut').classList.remove('hidden');
    $('#aiOut').innerHTML = mdLite(h.teks) +
      '<div class="ai-foot">' + (dariCache ? 'Hasil tersimpan (data & filter belum berubah, jadi tidak perlu analisis ulang) · ' : '') +
      pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' · ' + esc(h.model) +
      (u.input_tokens ? ' · ' + u.input_tokens + ' token masuk, ' + u.output_tokens + ' token keluar' : '') +
      (h.sisa != null ? ' · sisa kuota hari ini ' + h.sisa : '') + '</div>';
  }

  function mdLite(md) {
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
    const out = []; let list = null;
    const tutup = () => { if (list) { out.push('</' + list + '>'); list = null; } };
    String(md || '').split('\n').forEach(line => {
      const t = line.trim();
      let m;
      if (!t) { tutup(); return; }
      if ((m = t.match(/^#{1,4}\s+(.*)/))) { tutup(); out.push('<h4>' + inline(m[1]) + '</h4>'); return; }
      if ((m = t.match(/^[-*•]\s+(.*)/))) { if (list !== 'ul') { tutup(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); return; }
      if ((m = t.match(/^\d+[.)]\s+(.*)/))) { if (list !== 'ol') { tutup(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(m[1]) + '</li>'); return; }
      tutup(); out.push('<p>' + inline(t) + '</p>');
    });
    tutup();
    return out.join('');
  }

  /* ================= init ================= */
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => st.data && renderTab());
  muat();
})();
