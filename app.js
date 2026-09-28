(function () {
  'use strict';

  /* ================= util ================= */
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
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
  const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const labelBulan = b => NAMA_BULAN[Number(b.slice(5, 7)) - 1] + ' ' + b.slice(2, 4);
  const labelTgl = t => Number(t.slice(8, 10)) + ' ' + NAMA_BULAN[Number(t.slice(5, 7)) - 1];
  const monthsBetween = (a, b) => { const out = []; let [y, m] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number); while (y < y2 || (y === y2 && m <= m2)) { out.push(y + '-' + pad(m)); m++; if (m > 12) { m = 1; y++; } } return out; };
  const shiftMonth = (b, n) => { let [y, m] = b.split('-').map(Number); m += n; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return y + '-' + pad(m); };
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* abaikan */ } };
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i); return (h >>> 0).toString(36); };
  let toastT;
  const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 3500); };
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const groupBy = (a, f) => Anomali.groupBy(a, f);
  const chg = (cur, prev) => (prev && cur != null) ? cur / prev - 1 : null;
  const chgHtml = (r, naikBagus) => r == null ? '<span class="hint">–</span>' :
    '<span class="' + ((naikBagus ? r < -0.02 : r > 0.02) ? 'up' : (naikBagus ? r > 0.02 : r < -0.02) ? 'down' : '') + '">' + (Math.abs(r) < 0.005 ? '≈ 0%' : (r >= 0 ? '▲ +' : '▼ ') + pct(r, 0)) + '</span>';
  const poinHtml = (d, naikBagus) => d == null ? '<span class="hint">–</span>' :
    '<span class="' + ((naikBagus ? d < -0.0005 : d > 0.0005) ? 'up' : (naikBagus ? d > 0.0005 : d < -0.0005) ? 'down' : '') + '">' + (d > 0 ? '+' : '') + num(d * 100, 1) + ' poin</span>';

  /* ================= state ================= */
  const K = { cfg: 'hppdash.cfg', ai: 'hppdash.ai', ui: 'hppdash.ui' };
  const st = {
    cfg: load(K.cfg, { url: '', key: '', demo: false }),
    data: null, anomali: [], scope: null,
    tab: 'ringkasan', dim: 'semua', q: '', qLog: '', logLimit: 100, qBeli: '', beliLimit: 50, charts: {}
  };
  const JENIS_LABEL = { item: 'Per bahan', store: 'Per outlet', bulan: 'Per bulan', data: 'Kualitas data' };
  const LEVEL = { tinggi: ['▲', 'Tinggi'], sedang: ['●', 'Sedang'], rendah: ['○', 'Rendah'] };
  const MARGIN_SEHAT = 0.10; // margin operasional di bawah ini = "perlu perhatian"

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
      belanja: raw.belanja.map(r => ({ tgl: r[0], bulan: r[1], brand: r[2], store: r[3], pic: r[4], kategori: r[5], bahan: r[6], qty: r[7], satuan: r[8],
        harga: r[9], total: r[10], supplier: r[11], flag: r[12], id: r[13], catatan: r[15] || '', foto: r[16] || '' })),
      omzet: raw.omzet.map(r => ({ tgl: r[0], bulan: r[1], brand: r[2], store: r[3], omzet: r[4], struk: r[5] })),
      pembelian: (raw.pembelian || []).map(r => ({ tgl: r[0], bulan: r[1], brand: r[2], store: r[3], pic: r[4], kategori: r[5], barang: r[6], qty: r[7], satuan: r[8],
        harga: r[9], total: r[10], dibayarDari: r[11], toko: r[12], catatan: r[13] || '', foto: r[14] || '', id: r[15] })),
      biaya: (raw.biaya || []).map(r => ({ bulan: r[0], store: r[1], kelompok: r[2], kategori: r[3], jumlah: Number(r[4]) || 0, orang: Number(r[5]) || 0 }))
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
  function pilihOutlet(kode) {
    const s = st.data.stores.find(x => x.kode === kode);
    if (!s) return;
    // brand filter dibiarkan (biar kartu outlet lain tetap kelihatan), kecuali filter brand lain yang aktif
    if ($('#fBrand').value && $('#fBrand').value !== s.brand) $('#fBrand').value = '';
    isiStore(kode); simpanUi();
    st.tab = 'outlet'; render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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
  /** 6 bulan terakhir s/d "sampai" (atau periode filter kalau lebih panjang), maks 12 */
  const bulanGrafik = sc => { const b = sc.bulan.length >= 6 ? sc.bulan : monthsBetween(shiftMonth(sc.sampai, -5), sc.sampai); return b.slice(-12); };

  /* ================= hitungan ================= */
  function agregat(fStore, dari, sampai) {
    const inR = r => r.bulan >= dari && r.bulan <= sampai && fStore(r.store);
    const B = st.data.belanja.filter(inR), O = st.data.omzet.filter(inR);
    const bel = sum(B.map(r => r.total)), omz = sum(O.map(r => r.omzet));
    const struk = sum(O.map(r => Number(r.struk) || 0));
    return { B, O, bel, omz, struk, fc: omz > 0 ? bel / omz : null, ticket: struk > 0 ? omz / struk : null };
  }
  const agScope = (sc, dari, sampai) => agregat(s => inStore(sc, s), dari, sampai);

  /**
   * Laba rugi. Bulan berjalan: biaya karyawan & tetap dipotong proporsional sesuai hari yang sudah lewat,
   * supaya sebanding dengan omzet yang baru masuk sebagian.
   */
  function hitungPL(fStore, dari, sampai) {
    const D = st.data, bulanIni = today().slice(0, 7);
    const faktorBerjalan = Math.max(1, Number(today().slice(8, 10)) - 1) / Anomali.daysInMonth(bulanIni);
    const inR = r => r.bulan >= dari && r.bulan <= sampai && fStore(r.store);
    const omz = sum(D.omzet.filter(inR).map(r => r.omzet)), hpp = sum(D.belanja.filter(inR).map(r => r.total));
    const by = (D.biaya || []).filter(inR).map(r => Object.assign({}, r, {
      jumlah: r.bulan === bulanIni && r.kelompok !== 'Operasional' ? r.jumlah * faktorBerjalan : r.jumlah
    }));
    // pembelian non-bahan (tab Pembelian di app HP): bukan HPP, tapi biaya → ikut mengurangi laba
    groupBy((D.pembelian || []).filter(inR), r => r.bulan + '|' + r.store + '|' + r.kategori).forEach(rs =>
      by.push({ bulan: rs[0].bulan, store: rs[0].store, kelompok: 'Pembelian', kategori: rs[0].kategori, jumlah: sum(rs.map(r => r.total)), orang: 0 }));
    const kel = k => sum(by.filter(r => r.kelompok === k).map(r => r.jumlah));
    const kary = kel('Karyawan'), tetap = kel('Tetap'), ops = kel('Operasional'), pemb = kel('Pembelian');
    const laba = omz - hpp - kary - tetap - ops - pemb;
    return {
      omz, hpp, kary, tetap, ops, pemb, laba, lk: omz - hpp, by,
      margin: omz > 0 ? laba / omz : null, lkPct: omz > 0 ? (omz - hpp) / omz : null, fc: omz > 0 ? hpp / omz : null,
      karyPct: omz > 0 ? kary / omz : null,
      adaBiaya: by.some(r => r.kelompok === 'Karyawan' || r.kelompok === 'Tetap')
    };
  }
  const plScope = (sc, dari, sampai) => hitungPL(s => inStore(sc, s), dari, sampai);
  const plOutlet = (kode, dari, sampai) => hitungPL(s => s === kode, dari, sampai);

  function statusOutlet(p, nAnomaliTinggi) {
    const batas = st.data.batasFoodCost || 0.35;
    if (!p.omz) return { cls: 'perhatian', ikon: '!', label: 'Belum ada omzet' };
    if ((p.adaBiaya && p.margin < 0) || p.fc > batas + 0.05) return { cls: 'kritis', ikon: '✕', label: p.adaBiaya && p.margin < 0 ? 'Rugi' : 'Food cost tinggi' };
    if ((p.adaBiaya && p.margin < MARGIN_SEHAT) || p.fc > batas || nAnomaliTinggi) return { cls: 'perhatian', ikon: '!', label: 'Perlu perhatian' };
    return { cls: 'sehat', ikon: '✓', label: 'Sehat' };
  }
  const statusHtml = s => '<span class="st ' + s.cls + '"><i>' + s.ikon + '</i>' + esc(s.label) + '</span>';

  function warnaStore() {
    const w = {}; st.data.stores.forEach((s, i) => { w[s.kode] = i < 8 ? css('--s' + (i + 1)) : css('--muted'); }); return w;
  }

  /* ================= render ================= */
  function render() {
    if (!st.data) return;
    const sc = st.scope = hitungScope();
    st.anomali = Anomali.deteksi(st.data, { bulanDari: sc.dari, bulanSampai: sc.sampai, storeSet: sc.storeSet, hariIni: today() });
    $('#cntAnomali').textContent = st.anomali.length;
    renderKpi();
    renderAiMeta();
    renderTab();
  }

  function renderKpi() {
    const sc = st.scope, batas = st.data.batasFoodCost || 0.35;
    const pl = plScope(sc, sc.dari, sc.sampai), plP = plScope(sc, sc.prevDari, sc.prevSampai);
    const a = agScope(sc, sc.dari, sc.sampai), aP = agScope(sc, sc.prevDari, sc.prevSampai);
    const tinggi = st.anomali.filter(x => x.level === 'tinggi').length, sedang = st.anomali.filter(x => x.level === 'sedang').length;
    const d = (html) => '<div class="d">' + html + ' vs periode sebelumnya</div>';
    const kpi = (label, nilai, sub, extra) => '<div class="kpi' + (extra && extra.tab ? ' klik" data-goto="' + extra.tab : '') + '"' + (extra && extra.title ? ' title="' + esc(extra.title) + '"' : '') + '>' +
      '<div class="l">' + label + '</div><div class="v' + (extra && extra.cls ? ' ' + extra.cls : '') + '">' + nilai + '</div>' + sub + '</div>';
    $('#kpis').innerHTML = [
      kpi('Omzet', rpS(a.omz), d(chgHtml(chg(a.omz, aP.omz), true)), { tab: 'penjualan' }),
      pl.adaBiaya
        ? kpi('Laba operasional', rpS(pl.laba), '<div class="d">margin <b>' + pct(pl.margin) + '</b> · ' + poinHtml(plP.adaBiaya ? pl.margin - plP.margin : null, true) + '</div>',
          { tab: 'profit', cls: pl.laba < 0 ? 'neg' : '', title: 'Omzet − bahan − karyawan − biaya tetap − biaya bulanan' })
        : kpi('Laba operasional', '–', '<div class="d">isi biaya karyawan & sewa di sheet</div>', { tab: 'profit' }),
      kpi('Food cost', pct(a.fc), d(poinHtml(a.fc != null && aP.fc != null ? a.fc - aP.fc : null, false)), { tab: 'bahan', cls: a.fc > batas ? 'over' : '' }),
      kpi('Biaya karyawan', pl.adaBiaya ? pct(pl.karyPct) : '–', pl.adaBiaya ? '<div class="d">' + rpS(pl.kary) + ' dari omzet</div>' : '<div class="d">belum diisi</div>', { tab: 'profit' }),
      kpi('Rata-rata per struk', a.ticket ? rpS(a.ticket) : '–', a.struk ? d(chgHtml(chg(a.ticket, aP.ticket), true)) : '<div class="d">jumlah struk belum diisi</div>', { tab: 'penjualan' }),
      kpi('Anomali', String(st.anomali.length), '<div class="d">' + tinggi + ' tinggi · ' + sedang + ' sedang</div>', { tab: 'anomali' })
    ].join('');
  }

  /* ---------- tabs ---------- */
  const TABS = ['ringkasan', 'outlet', 'penjualan', 'profit', 'bahan', 'anomali'];
  function keTab(t) { st.tab = t; renderTab(); }
  $$('.tabs button').forEach(b => b.addEventListener('click', () => keTab(b.dataset.tab)));
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-goto]');
    if (g) { e.preventDefault(); keTab(g.dataset.goto); window.scrollTo({ top: $('.tabs').offsetTop - 8, behavior: 'smooth' }); }
  });
  function renderTab() {
    $$('.tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === st.tab));
    TABS.forEach(t => $('#v-' + t).classList.toggle('hidden', t !== st.tab));
    ({ ringkasan: renderRingkasan, outlet: renderOutlet, penjualan: renderPenjualan, profit: renderProfit, bahan: renderBahan, anomali: renderAnomali })[st.tab]();
  }

  /* ================= RINGKASAN ================= */
  function renderRingkasan() {
    const sc = st.scope, D = st.data, W = warnaStore();
    const stores = D.stores.filter(s => inStore(sc, s.kode));
    const bulan = bulanGrafik(sc);

    // omzet per bulan, ditumpuk per outlet
    const tampil = stores.slice(0, 8);
    gambar('chOmzetBulan', 'bar', bulan.map(labelBulan), tampil.map(s => ({
      label: s.kode, backgroundColor: W[s.kode], borderColor: css('--surface'), borderWidth: { top: 2 },
      data: bulan.map(b => sum(D.omzet.filter(r => r.store === s.kode && r.bulan === b).map(r => r.omzet)) || null)
    })), { stacked: true });

    // rasio % omzet
    const pls = bulan.map(b => plScope(sc, b, b));
    const ds = [
      { label: 'Food cost', data: pls.map(p => p.fc), borderColor: css('--s2'), backgroundColor: css('--s2') },
      { label: 'Biaya karyawan', data: pls.map(p => p.adaBiaya ? p.karyPct : null), borderColor: css('--s5'), backgroundColor: css('--s5') },
      { label: 'Margin operasional', data: pls.map(p => p.adaBiaya ? p.margin : null), borderColor: css('--s1'), backgroundColor: css('--s1'), borderWidth: 3 }
    ];
    gambar('chRasio', 'line', bulan.map(labelBulan), ds, { persen: true });

    // performa outlet
    const rows = stores.map(s => {
      const p = plOutlet(s.kode, sc.dari, sc.sampai), pp = plOutlet(s.kode, sc.prevDari, sc.prevSampai);
      const a = agregat(x => x === s.kode, sc.dari, sc.sampai);
      const an = st.anomali.filter(x => x.store === s.kode);
      return { s, p, pp, a, an, status: statusOutlet(p, an.filter(x => x.level === 'tinggi').length) };
    }).sort((x, y) => y.p.omz - x.p.omz);
    const tot = plScope(sc, sc.dari, sc.sampai), totP = plScope(sc, sc.prevDari, sc.prevSampai), aTot = agScope(sc, sc.dari, sc.sampai);
    const batas = D.batasFoodCost || 0.35;
    const sel = (p, pp, a, extra) =>
      '<td class="n">' + rp(p.omz) + '</td><td class="n">' + chgHtml(chg(p.omz, pp.omz), true) + '</td>' +
      '<td class="n' + (p.fc > batas ? ' over' : '') + '">' + pct(p.fc) + '</td>' +
      '<td class="n">' + (p.adaBiaya ? pct(p.karyPct) : '–') + '</td>' +
      '<td class="n' + (p.adaBiaya && p.laba < 0 ? ' neg' : '') + '">' + (p.adaBiaya ? rp(p.laba) : '–') + '</td>' +
      '<td class="n' + (p.adaBiaya && p.margin < 0 ? ' neg' : '') + '"><b>' + (p.adaBiaya ? pct(p.margin) : '–') + '</b></td>' +
      '<td class="n">' + (a.ticket ? rp(a.ticket) : '–') + '</td>' + (extra || '');
    $('#tbPerforma').innerHTML = '<thead><tr><th>Outlet</th><th>Status</th><th class="n">Omzet</th><th class="n">vs sblm</th><th class="n">Food cost</th><th class="n">Karyawan</th>' +
      '<th class="n">Laba operasional</th><th class="n">Margin</th><th class="n">Per struk</th><th class="n">Anomali</th></tr></thead><tbody>' +
      (rows.length ? rows.map(r => '<tr class="klik" data-s="' + esc(r.s.kode) + '"><td><span class="sw" style="background:' + W[r.s.kode] + '"></span><b>' + esc(r.s.kode) + '</b> ' + esc(r.s.nama) + '</td>' +
        '<td>' + statusHtml(r.status) + '</td>' + sel(r.p, r.pp, r.a, '<td class="n"><span class="badge' + (r.an.some(x => x.level === 'tinggi') ? ' hot' : '') + '">' + r.an.length + '</span></td>') + '</tr>').join('')
        : '<tr><td colspan="10" class="hint">Tidak ada outlet untuk filter ini.</td></tr>') +
      '</tbody><tfoot><tr><td>Total ' + (sc.storeSet ? 'outlet dipilih' : 'semua outlet') + '</td><td></td>' + sel(tot, totP, aTot, '<td class="n">' + st.anomali.length + '</td>') + '</tr></tfoot>';
    $$('#tbPerforma tr.klik').forEach(tr => tr.addEventListener('click', () => pilihOutlet(tr.dataset.s)));

    // per brand
    const brands = [...new Set(stores.map(s => s.brand))];
    $('#tbBrand').innerHTML = '<thead><tr><th>Brand</th><th class="n">Outlet</th><th class="n">Omzet</th><th class="n">Porsi</th><th class="n">Food cost</th><th class="n">Margin</th></tr></thead><tbody>' +
      brands.map(b => {
        const ks = stores.filter(s => s.brand === b).map(s => s.kode);
        const p = hitungPL(x => ks.includes(x), sc.dari, sc.sampai);
        return '<tr><td><b>' + esc(b) + '</b></td><td class="n">' + ks.length + '</td><td class="n">' + rp(p.omz) + '</td><td class="n">' + pct(tot.omz ? p.omz / tot.omz : null) + '</td>' +
          '<td class="n' + (p.fc > batas ? ' over' : '') + '">' + pct(p.fc) + '</td><td class="n' + (p.adaBiaya && p.margin < 0 ? ' neg' : '') + '">' + (p.adaBiaya ? pct(p.margin) : '–') + '</td></tr>';
      }).join('') + '</tbody>';

    // perlu perhatian
    const top = st.anomali.filter(a => a.level !== 'rendah').slice(0, 4);
    $('#perhatian').innerHTML = top.length ? top.map((a, i) =>
      '<div class="ph"><span class="lvl ' + a.level + '"><i>' + LEVEL[a.level][0] + '</i>' + LEVEL[a.level][1] + '</span><div><div class="t">' + esc(a.judul) + '</div>' +
      '<div class="m">' + esc([a.bulan ? labelBulan(a.bulan) : '', a.dampak ? 'dampak ±' + rpS(a.dampak) : ''].filter(Boolean).join(' · ')) + '</div></div>' +
      (a.grafik ? '<button class="btn ghost small" data-ph="' + i + '">Grafik</button>' : '') + '</div>').join('')
      : '<div class="kosong">Tidak ada anomali tinggi/sedang untuk filter ini. 👍</div>';
    $$('#perhatian button[data-ph]').forEach(b => b.addEventListener('click', () => { const a = top[Number(b.dataset.ph)]; bukaGrafik(a.grafik, a); }));

    // tren bulanan
    const trenBulan = bulanGrafik(sc).slice().reverse();
    $('#tbTren').innerHTML = '<thead><tr><th>Bulan</th><th class="n">Omzet</th><th class="n">vs bln lalu</th><th class="n">Belanja bahan</th><th class="n">Food cost</th>' +
      '<th class="n">Karyawan</th><th class="n">Biaya lain</th><th class="n">Laba operasional</th><th class="n">Margin</th><th class="n">Struk</th></tr></thead><tbody>' +
      trenBulan.map(b => {
        const p = plScope(sc, b, b), pPrev = plScope(sc, shiftMonth(b, -1), shiftMonth(b, -1)), a = agScope(sc, b, b);
        return '<tr><td><b>' + labelBulan(b) + '</b>' + (b === today().slice(0, 7) ? ' <span class="hint">(berjalan)</span>' : '') + '</td>' +
          '<td class="n">' + rp(p.omz) + '</td><td class="n">' + chgHtml(chg(p.omz, pPrev.omz), true) + '</td><td class="n">' + rp(p.hpp) + '</td>' +
          '<td class="n' + (p.fc > batas ? ' over' : '') + '">' + pct(p.fc) + '</td><td class="n">' + (p.adaBiaya ? rp(p.kary) : '–') + '</td>' +
          '<td class="n">' + (p.adaBiaya || p.ops || p.pemb ? rp(p.tetap + p.ops + p.pemb) : '–') + '</td>' +
          '<td class="n' + (p.adaBiaya && p.laba < 0 ? ' neg' : '') + '">' + (p.adaBiaya ? rp(p.laba) : '–') + '</td>' +
          '<td class="n"><b>' + (p.adaBiaya ? pct(p.margin) : '–') + '</b></td><td class="n">' + (a.struk ? num(a.struk, 0) : '–') + '</td></tr>';
      }).join('') + '</tbody>';
  }

  /* ================= OUTLET ================= */
  function renderOutlet() {
    const sc = st.scope, D = st.data, W = warnaStore();
    const brand = $('#fBrand').value;
    const list = D.stores.filter(s => !brand || s.brand === brand);
    $('#outletGrid').innerHTML = list.map(s => {
      const p = plOutlet(s.kode, sc.dari, sc.sampai), pp = plOutlet(s.kode, sc.prevDari, sc.prevSampai);
      const a = agregat(x => x === s.kode, sc.dari, sc.sampai);
      const an = Anomali.deteksi(D, { bulanDari: sc.dari, bulanSampai: sc.sampai, storeSet: new Set([s.kode]), hariIni: today() });
      const stt = statusOutlet(p, an.filter(x => x.level === 'tinggi').length);
      return '<button class="ocard' + (sc.store === s.kode ? ' on' : '') + '" style="--c:' + W[s.kode] + '" data-s="' + esc(s.kode) + '">' +
        '<div class="oh"><div><div class="on1">' + esc(s.kode) + ' · ' + esc(s.nama.replace(s.brand + ' - ', '')) + '</div><div class="on2">' + esc(s.brand) + '</div></div>' + statusHtml(stt) + '</div>' +
        '<div class="om"><div><span>Omzet</span><b>' + rpS(p.omz) + '</b><small>' + chgHtml(chg(p.omz, pp.omz), true) + '</small></div>' +
        '<div><span>Margin</span><b class="' + (p.adaBiaya && p.margin < 0 ? 'neg' : '') + '">' + (p.adaBiaya ? pct(p.margin) : '–') + '</b></div>' +
        '<div><span>Food cost</span><b>' + pct(p.fc) + '</b></div>' +
        '<div><span>Anomali</span><b>' + an.length + '</b>' + (an.some(x => x.level === 'tinggi') ? '<small class="up">▲ ada tinggi</small>' : '') + '</div></div></button>';
    }).join('') || '<div class="kosong">Belum ada outlet.</div>';
    $$('#outletGrid .ocard').forEach(c => c.addEventListener('click', () => {
      if (st.scope.store === c.dataset.s) { $('#fStore').value = ''; simpanUi(); render(); } else pilihOutlet(c.dataset.s);
    }));

    const det = $('#outletDetail');
    if (!sc.store) {
      det.innerHTML = '<div class="card"><p class="kosong">Klik salah satu outlet di atas untuk lihat detail lengkapnya: penjualan harian, struktur biaya, tim, bahan terbesar, dan anomali. Klik lagi untuk kembali ke semua outlet.</p></div>';
      return;
    }
    const s = D.stores.find(x => x.kode === sc.store);
    const p = plOutlet(s.kode, sc.dari, sc.sampai);
    const a = agregat(x => x === s.kode, sc.dari, sc.sampai);
    const hari = [...new Set(a.O.map(r => r.tgl))].length;
    det.innerHTML =
      '<div class="detail-head"><h2><span class="sw" style="background:' + W[s.kode] + '"></span>' + esc(s.kode) + ' · ' + esc(s.nama) + '</h2>' +
      '<span class="hint">' + labelBulan(sc.dari) + (sc.dari !== sc.sampai ? '–' + labelBulan(sc.sampai) : '') + ' · ' + hari + ' hari omzet tercatat · rata-rata ' + rpS(hari ? p.omz / hari : 0) + '/hari</span></div>' +
      '<div class="grid2">' +
        '<div class="card"><div class="card-head"><h2>Omzet harian</h2></div><div class="chart-box short"><canvas id="chOHarian"></canvas></div></div>' +
        '<div class="card"><div class="card-head"><h2>Margin &amp; food cost per bulan</h2></div><div class="chart-box short"><canvas id="chOBulan"></canvas></div></div>' +
      '</div>' +
      '<div class="grid2">' +
        '<div class="card"><div class="card-head"><h2>Laba rugi</h2><span class="hint">periode filter</span></div><div class="table-wrap"><table id="tbOPL"></table></div></div>' +
        '<div class="card"><div class="card-head"><h2>Tim</h2><span class="hint">per jabatan · bulan ' + labelBulan(sc.sampai) + '</span></div><div class="table-wrap"><table id="tbOTim"></table></div></div>' +
      '</div>' +
      '<div class="grid2">' +
        '<div class="card"><div class="card-head"><h2>10 bahan terbesar</h2><span class="hint">klik untuk grafik harga</span></div><div class="table-wrap"><table id="tbOBahan"></table></div></div>' +
        '<div class="card"><div class="card-head"><h2>Anomali outlet ini</h2></div><div id="oAnomali"></div></div>' +
      '</div>';

    // omzet harian
    const tgl = [...new Set(a.O.map(r => r.tgl))].sort();
    const og = groupBy(a.O, r => r.tgl);
    gambar('chOHarian', 'line', tgl.map(labelTgl), [{ label: s.kode, data: tgl.map(t => sum(og.get(t).map(r => r.omzet))), borderColor: W[s.kode], backgroundColor: W[s.kode] }], { tanpaTitik: true });
    // margin & fc per bulan
    const bl = bulanGrafik(sc);
    const pb = bl.map(b => plOutlet(s.kode, b, b));
    gambar('chOBulan', 'line', bl.map(labelBulan), [
      { label: 'Margin operasional', data: pb.map(x => x.adaBiaya ? x.margin : null), borderColor: css('--s1'), backgroundColor: css('--s1'), borderWidth: 3 },
      { label: 'Food cost', data: pb.map(x => x.fc), borderColor: css('--s2'), backgroundColor: css('--s2') },
      { label: 'Karyawan', data: pb.map(x => x.adaBiaya ? x.karyPct : null), borderColor: css('--s5'), backgroundColor: css('--s5') }
    ], { persen: true });
    // P&L
    $('#tbOPL').innerHTML = tabelPL(p);
    // tim
    const tim = (D.biaya || []).filter(r => r.store === s.kode && r.kelompok === 'Karyawan' && r.bulan === sc.sampai);
    const omzBln = sum(D.omzet.filter(r => r.store === s.kode && r.bulan === sc.sampai).map(r => r.omzet));
    $('#tbOTim').innerHTML = tim.length
      ? '<thead><tr><th>Jabatan</th><th class="n">Orang</th><th class="n">Biaya/bln</th><th class="n">% omzet</th></tr></thead><tbody>' +
        tim.sort((x, y) => y.jumlah - x.jumlah).map(r => '<tr><td>' + esc(r.kategori) + '</td><td class="n">' + (r.orang || '–') + '</td><td class="n">' + rp(r.jumlah) + '</td><td class="n">' + pct(omzBln ? r.jumlah / omzBln : null) + '</td></tr>').join('') +
        '</tbody><tfoot><tr><td>Total</td><td class="n">' + (sum(tim.map(r => r.orang)) || '–') + '</td><td class="n">' + rp(sum(tim.map(r => r.jumlah))) + '</td><td class="n">' + pct(omzBln ? sum(tim.map(r => r.jumlah)) / omzBln : null) + '</td></tr></tfoot>'
      : '<tbody><tr><td class="hint">Belum ada data karyawan untuk outlet ini (isi MASTER_KARYAWAN).</td></tr></tbody>';
    // bahan
    const gb = [...groupBy(a.B, r => r.bahan).entries()].map(([b, rs]) => ({ b, sat: rs[0].satuan, qty: sum(rs.map(r => r.qty)), tot: sum(rs.map(r => r.total)) }))
      .sort((x, y) => y.tot - x.tot).slice(0, 10);
    $('#tbOBahan').innerHTML = '<thead><tr><th>Bahan</th><th class="n">Qty</th><th class="n">Belanja</th><th class="n">% omzet</th><th class="n">Harga rata²</th></tr></thead><tbody>' +
      (gb.length ? gb.map(x => '<tr class="klik" data-b="' + esc(x.b) + '"><td>' + esc(x.b) + '</td><td class="n">' + num(x.qty) + ' ' + esc(x.sat) + '</td><td class="n">' + rp(x.tot) + '</td><td class="n">' + pct(p.omz ? x.tot / p.omz : null) + '</td><td class="n">' + rp(x.qty ? x.tot / x.qty : 0) + '</td></tr>').join('')
        : '<tr><td colspan="5" class="hint">Belum ada belanja.</td></tr>') + '</tbody>';
    $$('#tbOBahan tr.klik').forEach(tr => tr.addEventListener('click', () => bukaGrafik({ tipe: 'harga', bahan: tr.dataset.b, store: s.kode })));
    // anomali
    const an = st.anomali.filter(x => x.store === s.kode || (x.jenis === 'harga-pasar' && x.detail.includes(s.kode)));
    $('#oAnomali').innerHTML = an.length ? '<div class="an-list one">' + an.map((x, i) => kartuAnomali(x, 'o' + i)).join('') + '</div>' : '<div class="kosong">Tidak ada anomali. 👍</div>';
    pasangGrafikAnomali('#oAnomali', an, 'o');
  }

  function tabelPL(p) {
    if (!p.omz) return '<tbody><tr><td class="hint">Belum ada omzet pada periode ini.</td></tr></tbody>';
    const b = (l, v, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + l + '</td><td class="n' + (v < 0 ? ' neg' : '') + '">' + rp(v) + '</td><td class="n">' + pct(v / p.omz) + '</td></tr>';
    return '<thead><tr><th>Pos</th><th class="n">Rupiah</th><th class="n">% omzet</th></tr></thead><tbody>' +
      b('Omzet', p.omz) + b('− HPP bahan baku', -p.hpp) + b('<b>Laba kotor</b>', p.lk) +
      (p.adaBiaya ? b('− Karyawan', -p.kary) + b('− Biaya tetap (sewa, dll)', -p.tetap) + b('− Biaya bulanan (listrik, dll)', -p.ops) : '') +
      (p.pemb ? b('− Pembelian lain (non-bahan)', -p.pemb) : '') +
      '</tbody><tfoot><tr><td>Laba operasional</td><td class="n' + (p.laba < 0 ? ' neg' : '') + '">' + (p.adaBiaya ? rp(p.laba) : '–') + '</td><td class="n' + (p.margin < 0 ? ' neg' : '') + '">' + (p.adaBiaya ? pct(p.margin) : 'isi biaya') + '</td></tr></tfoot>';
  }

  /* ================= PENJUALAN ================= */
  function renderPenjualan() {
    const sc = st.scope, D = st.data, W = warnaStore();
    const stores = D.stores.filter(s => inStore(sc, s.kode));
    const a = agScope(sc, sc.dari, sc.sampai);
    const tgl = [...new Set(a.O.map(r => r.tgl))].sort();
    const tampil = stores.slice(0, 8);
    const og = groupBy(a.O, r => r.store + '|' + r.tgl);
    gambar('chHarian', 'line', tgl.map(labelTgl), tampil.map(s => ({
      label: s.kode, borderColor: W[s.kode], backgroundColor: W[s.kode], spanGaps: false,
      data: tgl.map(t => { const r = og.get(s.kode + '|' + t); return r ? sum(r.map(x => x.omzet)) : null; })
    })), { tanpaTitik: true });
    $('#harianNote').textContent = tgl.length ? tgl.length + ' hari · titik kosong = omzet belum diinput' : 'belum ada omzet';

    // per hari dalam minggu: total omzet outlet dipilih per tanggal → rata-rata per hari
    const perTgl = groupBy(a.O, r => r.tgl);
    const byDow = [0, 1, 2, 3, 4, 5, 6].map(() => []);
    perTgl.forEach((rs, t) => byDow[new Date(t + 'T00:00:00Z').getUTCDay()].push(sum(rs.map(r => r.omzet))));
    const urut = [1, 2, 3, 4, 5, 6, 0];
    gambar('chHariMinggu', 'bar', urut.map(i => NAMA_HARI[i]), [{ label: 'Rata-rata omzet', data: urut.map(i => byDow[i].length ? sum(byDow[i]) / byDow[i].length : null), backgroundColor: css('--s1'), borderColor: css('--s1') }], {});

    // rata-rata per struk per bulan per outlet
    const bl = bulanGrafik(sc);
    gambar('chTicket', 'line', bl.map(labelBulan), tampil.map(s => ({
      label: s.kode, borderColor: W[s.kode], backgroundColor: W[s.kode], spanGaps: true,
      data: bl.map(b => agregat(x => x === s.kode, b, b).ticket)
    })), {});

    const rows = stores.map(s => {
      const x = agregat(k => k === s.kode, sc.dari, sc.sampai), xp = agregat(k => k === s.kode, sc.prevDari, sc.prevSampai);
      const hari = groupBy(x.O, r => r.tgl);
      let best = null; hari.forEach((rs, t) => { const v = sum(rs.map(r => r.omzet)); if (!best || v > best[1]) best = [t, v]; });
      return { s, x, xp, nHari: hari.size, best };
    }).sort((p, q) => q.x.omz - p.x.omz);
    $('#tbPenjualan').innerHTML = '<thead><tr><th>Outlet</th><th class="n">Omzet</th><th class="n">vs sblm</th><th class="n">Porsi</th><th class="n">Hari</th><th class="n">Rata²/hari</th>' +
      '<th class="n">Struk</th><th class="n">Per struk</th><th class="n">Hari terbaik</th></tr></thead><tbody>' +
      rows.map(r => '<tr class="klik" data-s="' + esc(r.s.kode) + '"><td><span class="sw" style="background:' + W[r.s.kode] + '"></span><b>' + esc(r.s.kode) + '</b> ' + esc(r.s.nama) + '</td>' +
        '<td class="n">' + rp(r.x.omz) + '</td><td class="n">' + chgHtml(chg(r.x.omz, r.xp.omz), true) + '</td><td class="n">' + pct(a.omz ? r.x.omz / a.omz : null) + '</td>' +
        '<td class="n">' + r.nHari + '</td><td class="n">' + rp(r.nHari ? r.x.omz / r.nHari : 0) + '</td><td class="n">' + (r.x.struk ? num(r.x.struk, 0) : '–') + '</td>' +
        '<td class="n">' + (r.x.ticket ? rp(r.x.ticket) : '–') + '</td><td class="n">' + (r.best ? labelTgl(r.best[0]) + ' · ' + rpS(r.best[1]) : '–') + '</td></tr>').join('') +
      '</tbody><tfoot><tr><td>Total</td><td class="n">' + rp(a.omz) + '</td><td class="n">' + chgHtml(chg(a.omz, agScope(sc, sc.prevDari, sc.prevSampai).omz), true) + '</td><td class="n">100%</td>' +
      '<td class="n">' + tgl.length + '</td><td class="n">' + rp(tgl.length ? a.omz / tgl.length : 0) + '</td><td class="n">' + (a.struk ? num(a.struk, 0) : '–') + '</td><td class="n">' + (a.ticket ? rp(a.ticket) : '–') + '</td><td></td></tr></tfoot>';
    $$('#tbPenjualan tr.klik').forEach(tr => tr.addEventListener('click', () => pilihOutlet(tr.dataset.s)));
  }

  /* ================= PROFIT ================= */
  function renderProfit() {
    const sc = st.scope, W = warnaStore(), D = st.data;
    const stores = D.stores.filter(s => inStore(sc, s.kode));
    const total = plScope(sc, sc.dari, sc.sampai);
    $('#profitKosong').classList.toggle('hidden', total.adaBiaya);

    const bulan = bulanGrafik(sc);
    const ds = stores.slice(0, 8).map(s => ({
      label: s.kode, borderColor: W[s.kode], backgroundColor: W[s.kode], spanGaps: true,
      data: bulan.map(b => { const p = plOutlet(s.kode, b, b); return p.adaBiaya ? p.margin : p.lkPct; })
    }));
    ds.push({ label: 'Impas (0%)', data: bulan.map(() => 0), borderColor: css('--muted'), borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0 });
    gambar('chProfit', 'line', bulan.map(labelBulan), ds, { persen: true });
    $('#profitNote').textContent = (total.adaBiaya ? 'laba operasional ÷ omzet' : 'belum ada biaya: yang tampil % laba kotor') +
      (bulan.includes(today().slice(0, 7)) ? ' · bulan berjalan: biaya tetap dihitung proporsional' : '');

    const rows = stores.map(s => Object.assign({ s }, plOutlet(s.kode, sc.dari, sc.sampai))).sort((a, b) => (b.margin ?? -9) - (a.margin ?? -9));
    const td = (v, neg) => '<td class="n' + (neg && v < 0 ? ' neg' : '') + '">' + (v == null ? '–' : rp(v)) + '</td>';
    const tdp = (v, neg) => '<td class="n' + (neg && v < 0 ? ' neg' : '') + '">' + pct(v) + '</td>';
    const baris = (r, label) => '<td>' + label + '</td>' + td(r.omz) + td(r.hpp) + td(r.lk, true) + tdp(r.lkPct) +
      td(r.kary) + td(r.tetap) + td(r.ops) + td(r.pemb) + td(r.adaBiaya ? r.laba : null, true) + tdp(r.adaBiaya ? r.margin : null, true) + tdp(r.adaBiaya ? r.karyPct : null);
    $('#tbProfit').innerHTML = '<thead><tr><th>Outlet</th><th class="n">Omzet</th><th class="n">HPP bahan</th><th class="n">Laba kotor</th><th class="n">%</th>' +
      '<th class="n">Karyawan</th><th class="n">Biaya tetap</th><th class="n">Biaya bulanan</th><th class="n">Pembelian lain</th><th class="n">Laba operasional</th><th class="n">Margin</th><th class="n">Karyawan %</th></tr></thead><tbody>' +
      rows.map(r => '<tr class="klik" data-s="' + esc(r.s.kode) + '">' + baris(r, '<span class="sw" style="background:' + W[r.s.kode] + '"></span><b>' + esc(r.s.kode) + '</b> ' + esc(r.s.nama)) + '</tr>').join('') +
      '</tbody><tfoot><tr>' + baris(total, 'Total ' + (sc.storeSet ? 'outlet dipilih' : 'semua outlet')) + '</tr></tfoot>';
    $$('#tbProfit tr.klik').forEach(tr => tr.addEventListener('click', () => bukaRincian(tr.dataset.s)));

    // biaya per pos (gabungan outlet terpilih)
    const pos = [['HPP bahan baku', 'Bahan', total.hpp]];
    const LBL = { Karyawan: 'Karyawan', Tetap: 'Tetap', Operasional: 'Bulanan', Pembelian: 'Pembelian lain' };
    ['Karyawan', 'Tetap', 'Operasional', 'Pembelian'].forEach(k => {
      groupBy(total.by.filter(r => r.kelompok === k), r => r.kategori).forEach((rs, kat) => pos.push([kat, LBL[k], sum(rs.map(r => r.jumlah))]));
    });
    pos.sort((x, y) => y[2] - x[2]);
    $('#tbPos').innerHTML = '<thead><tr><th>Pos biaya</th><th>Kelompok</th><th class="n">Rupiah</th><th class="n">% omzet</th></tr></thead><tbody>' +
      pos.map(x => '<tr><td>' + esc(x[0]) + '</td><td class="hint">' + x[1] + '</td><td class="n">' + rp(x[2]) + '</td><td class="n">' + pct(total.omz ? x[2] / total.omz : null) + '</td></tr>').join('') +
      '</tbody><tfoot><tr><td>Total biaya</td><td></td><td class="n">' + rp(sum(pos.map(x => x[2]))) + '</td><td class="n">' + pct(total.omz ? sum(pos.map(x => x[2])) / total.omz : null) + '</td></tr></tfoot>';
  }

  function bukaRincian(kode) {
    const sc = st.scope, s = st.data.stores.find(x => x.kode === kode);
    const p = plOutlet(kode, sc.dari, sc.sampai);
    const pos = [['HPP bahan baku', p.hpp], ['Karyawan (total)', p.kary]];
    const perKat = kelompok => [...groupBy(p.by.filter(r => r.kelompok === kelompok), r => r.kategori).entries()].map(([k, rs]) => [k, sum(rs.map(r => r.jumlah))]).sort((a, b) => b[1] - a[1]);
    perKat('Tetap').concat(perKat('Operasional'), perKat('Pembelian').map(x => [x[0] + ' (pembelian)', x[1]])).forEach(x => pos.push(x));
    $('#gTitle').textContent = 'Struktur biaya ' + kode + ' · ' + labelBulan(sc.dari) + (sc.dari !== sc.sampai ? '–' + labelBulan(sc.sampai) : '');
    $('#gSub').textContent = (s ? s.nama + ' · ' : '') + 'Semua biaya sebagai % dari omzet ' + rp(p.omz) + '. Laba operasional ' + rp(p.laba) + ' (' + pct(p.margin) + ').';
    const d = $('#dlgChart'); if (!d.open) d.showModal();
    gambar('chDetail', 'bar', pos.map(x => x[0]), [{ label: '% omzet', data: pos.map(x => p.omz ? x[1] / p.omz : null), backgroundColor: css('--s1'), borderColor: css('--s1') }], { persen: true, horizontal: true });
    const kary = perKat('Karyawan');
    $('#tbDetail').innerHTML = '<thead><tr><th>Pos biaya</th><th class="n">Rupiah</th><th class="n">% omzet</th></tr></thead><tbody>' +
      pos.map(x => '<tr><td>' + esc(x[0]) + '</td><td class="n">' + rp(x[1]) + '</td><td class="n">' + pct(p.omz ? x[1] / p.omz : null) + '</td></tr>').join('') +
      kary.map(x => '<tr><td class="hint">&nbsp;&nbsp;↳ ' + esc(x[0]) + '</td><td class="n hint">' + rp(x[1]) + '</td><td class="n hint">' + pct(p.omz ? x[1] / p.omz : null) + '</td></tr>').join('') +
      '</tbody><tfoot><tr><td>Laba operasional</td><td class="n' + (p.laba < 0 ? ' neg' : '') + '">' + rp(p.laba) + '</td><td class="n' + (p.laba < 0 ? ' neg' : '') + '">' + pct(p.margin) + '</td></tr></tfoot>';
    $('.tbl-detail').open = true;
  }

  /* ================= BELANJA & BAHAN ================= */
  $('#qItem').addEventListener('input', e => { st.q = e.target.value.toLowerCase(); renderItemTabel(); });
  $('#qLog').addEventListener('input', e => { st.qLog = e.target.value.toLowerCase(); st.logLimit = 100; renderLog(); });
  $('#btnLogMore').addEventListener('click', () => { st.logLimit += 200; renderLog(); });

  function renderBahan() {
    const sc = st.scope, D = st.data, W = warnaStore();
    const a = agScope(sc, sc.dari, sc.sampai);
    const kat = [...groupBy(a.B, r => r.kategori).entries()].map(([k, rs]) => [k, sum(rs.map(r => r.total))]).sort((x, y) => y[1] - x[1]);
    gambar('chKategori', 'bar', kat.map(x => x[0]), [{ label: '% omzet', data: kat.map(x => a.omz ? x[1] / a.omz : null), backgroundColor: css('--s2'), borderColor: css('--s2') }], { persen: true, horizontal: true });

    const batas = D.batasFoodCost || 0.35, bl = bulanGrafik(sc);
    const stores = D.stores.filter(s => inStore(sc, s.kode)).slice(0, 8);
    const ds = stores.map(s => ({ label: s.kode, borderColor: W[s.kode], backgroundColor: W[s.kode], spanGaps: true, data: bl.map(b => agregat(x => x === s.kode, b, b).fc) }));
    ds.push({ label: 'Batas', data: bl.map(() => batas), borderColor: css('--muted'), borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0 });
    gambar('chFc', 'line', bl.map(labelBulan), ds, { persen: true });
    $('#fcNote').textContent = 'garis putus-putus = batas ' + pct(batas, 0);
    renderItemTabel();
    renderLog();
    renderPembelian();
  }

  function renderPembelian() {
    const sc = st.scope, D = st.data, q = st.qBeli;
    const inR = (r, dari, sampai) => r.bulan >= dari && r.bulan <= sampai && inStore(sc, r.store);
    const cur = (D.pembelian || []).filter(r => inR(r, sc.dari, sc.sampai)), prev = (D.pembelian || []).filter(r => inR(r, sc.prevDari, sc.prevSampai));
    const omz = agScope(sc, sc.dari, sc.sampai).omz, tot = sum(cur.map(r => r.total));
    const gp = groupBy(prev, r => r.kategori);
    const kat = [...groupBy(cur, r => r.kategori).entries()].map(([k, rs]) => ({ k, n: rs.length, t: sum(rs.map(r => r.total)), tp: sum((gp.get(k) || []).map(r => r.total)) }))
      .sort((a, b) => b.t - a.t);
    $('#tbBeliKat').innerHTML = '<thead><tr><th>Kategori</th><th class="n">Transaksi</th><th class="n">Rupiah</th><th class="n">% omzet</th><th class="n">vs sebelumnya</th></tr></thead><tbody>' +
      (kat.length ? kat.map(x => '<tr><td>' + esc(x.k) + '</td><td class="n">' + x.n + '</td><td class="n">' + rp(x.t) + '</td><td class="n">' + pct(omz ? x.t / omz : null) + '</td><td class="n">' + chgHtml(chg(x.t, x.tp), false) + '</td></tr>').join('')
        : '<tr><td colspan="5" class="hint">Belum ada pembelian non-bahan di periode ini. Tim outlet mengisinya di tab Pembelian app HP.</td></tr>') +
      '</tbody>' + (kat.length ? '<tfoot><tr><td>Total</td><td class="n">' + cur.length + '</td><td class="n">' + rp(tot) + '</td><td class="n">' + pct(omz ? tot / omz : null) + '</td><td class="n">' + chgHtml(chg(tot, sum(prev.map(r => r.total))), false) + '</td></tr></tfoot>' : '');
    const dari = [...groupBy(cur, r => r.dibayarDari || '(kosong)').entries()].map(([k, rs]) => [k, sum(rs.map(r => r.total))]).sort((a, b) => b[1] - a[1]);
    $('#tbBeliDari').innerHTML = '<thead><tr><th>Dibayar dari</th><th class="n">Rupiah</th><th class="n">Porsi</th></tr></thead><tbody>' +
      (dari.length ? dari.map(x => '<tr><td>' + esc(x[0]) + '</td><td class="n">' + rp(x[1]) + '</td><td class="n">' + pct(tot ? x[1] / tot : null) + '</td></tr>').join('') : '<tr><td colspan="3" class="hint">–</td></tr>') + '</tbody>';

    const rows = cur.filter(r => !q || [r.barang, r.kategori, r.store, r.pic, r.toko, r.catatan, r.dibayarDari].join(' ').toLowerCase().includes(q))
      .sort((a, b) => a.tgl < b.tgl ? 1 : a.tgl > b.tgl ? -1 : 0);
    const tampil = rows.slice(0, st.beliLimit);
    $('#beliInfo').textContent = rows.length ? 'Menampilkan ' + tampil.length.toLocaleString('id-ID') + ' dari ' + rows.length.toLocaleString('id-ID') + ' baris · total ' + rp(sum(rows.map(r => r.total))) : '';
    $('#tbBeliLog').innerHTML = '<thead><tr><th>Tanggal</th><th>Outlet</th><th>Barang</th><th>Kategori</th><th class="n">Qty</th><th class="n">Harga</th><th class="n">Total</th><th>Dibayar dari</th><th>PIC</th><th>Toko</th><th>Catatan</th><th>Nota</th></tr></thead><tbody>' +
      tampil.map(r => '<tr><td>' + esc(r.tgl) + '</td><td>' + esc(r.store) + '</td><td>' + esc(r.barang) + '</td><td>' + esc(r.kategori) + '</td>' +
        '<td class="n">' + num(r.qty, 2) + ' ' + esc(r.satuan) + '</td><td class="n">' + rp(r.harga) + '</td><td class="n">' + rp(r.total) + '</td>' +
        '<td>' + esc(r.dibayarDari || '') + '</td><td>' + esc(r.pic) + '</td><td>' + esc(r.toko || '') + '</td><td>' + esc(r.catatan || '') + '</td>' +
        '<td>' + (r.foto && /^https:\/\//.test(r.foto) ? '<a href="' + esc(r.foto) + '" target="_blank" rel="noopener">📷 lihat</a>' : '') + '</td></tr>').join('') + '</tbody>';
    $('#btnBeliMore').classList.toggle('hidden', rows.length <= tampil.length);
  }
  $('#qBeli').addEventListener('input', e => { st.qBeli = e.target.value.toLowerCase(); st.beliLimit = 50; renderPembelian(); });
  $('#btnBeliMore').addEventListener('click', () => { st.beliLimit += 200; renderPembelian(); });

  function renderItemTabel() {
    const sc = st.scope;
    const cur = st.data.belanja.filter(r => r.bulan >= sc.dari && r.bulan <= sc.sampai && inStore(sc, r.store));
    const prev = st.data.belanja.filter(r => r.bulan >= sc.prevDari && r.bulan <= sc.prevSampai && inStore(sc, r.store));
    const g = groupBy(cur, r => r.bahan), gp = groupBy(prev, r => r.bahan);
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
        '<td class="n">' + rp(r.h) + '/' + esc(r.sat) + '</td><td class="n">' + chgHtml(r.chg, false) + '</td>' +
        '<td class="n"><span class="badge' + (r.n ? ' hot' : '') + '">' + r.n + '</span></td></tr>').join('')
        : '<tr><td colspan="8" class="hint">Tidak ada data belanja untuk filter ini.</td></tr>') + '</tbody>';
    $$('#tbItem tr.klik').forEach(tr => tr.addEventListener('click', () => bukaGrafik({ tipe: 'harga', bahan: tr.dataset.b, store: sc.store || null })));
  }

  function renderLog() {
    const sc = st.scope, q = st.qLog;
    const nama = {}; st.data.stores.forEach(s => { nama[s.kode] = s.nama; });
    const rows = st.data.belanja.filter(r => r.bulan >= sc.dari && r.bulan <= sc.sampai && inStore(sc, r.store) &&
      (!q || [r.bahan, r.store, nama[r.store], r.pic, r.supplier, r.kategori, r.catatan, r.flag].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => a.tgl < b.tgl ? 1 : a.tgl > b.tgl ? -1 : 0);
    const tampil = rows.slice(0, st.logLimit);
    $('#logInfo').textContent = rows.length ? 'Menampilkan ' + tampil.length.toLocaleString('id-ID') + ' dari ' + rows.length.toLocaleString('id-ID') + ' baris · total ' + rp(sum(rows.map(r => r.total))) : 'Tidak ada baris untuk filter ini.';
    $('#tbLog').innerHTML = '<thead><tr><th>Tanggal</th><th>Outlet</th><th>Bahan</th><th class="n">Qty</th><th class="n">Harga</th><th class="n">Total</th><th>PIC</th><th>Supplier</th><th>Catatan</th><th>Nota</th></tr></thead><tbody>' +
      tampil.map(r => '<tr><td>' + esc(r.tgl) + '</td><td>' + esc(r.store) + '</td><td>' + esc(r.bahan) + (r.flag ? ' <span class="up" title="' + esc(r.flag) + '">⚠</span>' : '') + '</td>' +
        '<td class="n">' + num(r.qty, 2) + ' ' + esc(r.satuan) + '</td><td class="n">' + rp(r.harga) + '</td><td class="n">' + rp(r.total) + '</td>' +
        '<td>' + esc(r.pic) + '</td><td>' + esc(r.supplier || '') + '</td><td>' + esc(r.catatan || '') + '</td>' +
        '<td>' + (r.foto && /^https:\/\//.test(r.foto) ? '<a href="' + esc(r.foto) + '" target="_blank" rel="noopener">📷 lihat</a>' : '') + '</td></tr>').join('') + '</tbody>';
    $('#btnLogMore').classList.toggle('hidden', rows.length <= tampil.length);
  }

  /* ================= ANOMALI ================= */
  function kartuAnomali(a, id) {
    return '<article class="an ' + a.level + '">' +
      '<div class="an-head"><span class="lvl ' + a.level + '"><i>' + LEVEL[a.level][0] + '</i>' + LEVEL[a.level][1] + '</span>' +
      '<span class="tag">' + JENIS_LABEL[a.dimensi] + '</span>' +
      '<span class="meta">' + esc([a.bulan ? labelBulan(a.bulan) : '', a.namaStore].filter(Boolean).join(' · ')) + '</span></div>' +
      '<h3>' + esc(a.judul) + '</h3><p>' + esc(a.detail) + '</p>' +
      '<div class="an-foot"><span class="dampak">' + (a.dampak ? 'Dampak ±<b>' + rpS(a.dampak) + '</b>' : '') + '</span>' +
      (a.grafik ? '<button class="btn ghost" data-g="' + id + '">Lihat grafik</button>' : '') + '</div></article>';
  }
  function pasangGrafikAnomali(root, list, prefix) {
    $$(root + ' button[data-g]').forEach(b => b.addEventListener('click', () => { const a = list[Number(b.dataset.g.slice(prefix.length))]; bukaGrafik(a.grafik, a); }));
  }
  function renderAnomali() {
    const cnt = d => st.anomali.filter(a => d === 'semua' || a.dimensi === d).length;
    $('#chips').innerHTML = ['semua', 'item', 'store', 'bulan', 'data'].map(d =>
      '<button class="chip' + (st.dim === d ? ' on' : '') + '" data-dim="' + d + '">' + (d === 'semua' ? 'Semua' : JENIS_LABEL[d]) + ' (' + cnt(d) + ')</button>').join('');
    $$('#chips .chip').forEach(c => c.addEventListener('click', () => { st.dim = c.dataset.dim; renderAnomali(); }));
    const list = st.anomali.filter(a => st.dim === 'semua' || a.dimensi === st.dim);
    if (!st.data.belanja.length) { $('#anList').innerHTML = '<div class="empty">Belum ada data belanja. Begitu tim outlet mulai input dari app HP, anomali akan muncul di sini.</div>'; return; }
    if (!list.length) { $('#anList').innerHTML = '<div class="empty">Tidak ada anomali untuk filter ini. 👍</div>'; return; }
    $('#anList').innerHTML = list.map((a, i) => kartuAnomali(a, 'a' + i)).join('');
    pasangGrafikAnomali('#anList', list, 'a');
  }

  /* ================= grafik ================= */
  function gambar(id, tipe, labels, datasets, o) {
    o = o || {};
    const el = document.getElementById(id);
    if (!el) return;
    if (st.charts[id]) st.charts[id].destroy();
    const grid = css('--grid'), muted = css('--muted'), ink2 = css('--ink-2');
    const fmt = v => v == null ? '–' : o.persen ? pct(v) : o.satuan ? rp(v) + '/' + o.satuan : o.qty ? num(v) + ' ' + (o.unit || '') : rp(v);
    datasets.forEach(d => {
      if (tipe === 'line') Object.assign(d, Object.assign({ borderWidth: 2, pointRadius: o.tanpaTitik ? 0 : 3, pointHoverRadius: 5, tension: 0, fill: false }, d));
      if (tipe === 'bar') Object.assign(d, Object.assign({ borderRadius: o.stacked ? 0 : 4, maxBarThickness: 36, borderSkipped: 'start' }, d));
    });
    st.charts[id] = new Chart(el, {
      type: tipe, data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        indexAxis: o.horizontal ? 'y' : 'x',
        plugins: {
          legend: { display: datasets.length > 1, position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, color: ink2, padding: 14 } },
          tooltip: {
            callbacks: {
              label: c => ' ' + c.dataset.label + ': ' + fmt(o.horizontal ? c.parsed.x : c.parsed.y),
              footer: o.stacked ? items => 'Total: ' + fmt(sum(items.map(i => i.parsed.y || 0))) : undefined
            }
          }
        },
        scales: (() => {
          const kat = { stacked: !!o.stacked, grid: { display: false }, border: { color: css('--line-strong') }, ticks: { color: muted, maxRotation: 0, autoSkip: !o.horizontal } };
          const nilai = { stacked: !!o.stacked, beginAtZero: !o.persen || o.horizontal, grid: { color: grid }, border: { display: false },
            ticks: { color: muted, callback: v => o.persen ? pct(v, 0) : rpS(v).replace('Rp', o.qty ? '' : 'Rp') } };
          return o.horizontal ? { x: nilai, y: kat } : { x: kat, y: nilai };
        })()
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
    $('.tbl-detail').open = false;

    if (g.tipe === 'harga') {
      const sat = (D.bahan.find(b => b.nama === g.bahan) || {}).satuan || '';
      title = 'Harga ' + g.bahan + ' per ' + sat;
      if (!sub) sub = 'Rata-rata mingguan per outlet' + (g.store ? ', ' + g.store + ' ditebalkan' : '') + '.';
      const rows = D.belanja.filter(r => r.bahan === g.bahan && r.bulan >= bulan6[0] && r.bulan <= sc.sampai);
      const minggu = r => { const d = new Date(r.tgl + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
      labels = [...new Set(rows.map(minggu))].sort();
      const perS = groupBy(rows, r => r.store);
      ds = D.stores.filter(s => perS.has(s.kode)).slice(0, 8).map(s => {
        const gm = groupBy(perS.get(s.kode), minggu);
        const tebal = !g.store || g.store === s.kode;
        return { label: s.kode, data: labels.map(w => { const r = gm.get(w); return r ? sum(r.map(x => x.total)) / sum(r.map(x => x.qty)) : null; }),
          borderColor: W[s.kode], backgroundColor: W[s.kode], borderWidth: tebal ? 2.5 : 1.5, pointRadius: tebal ? 2 : 0, spanGaps: true };
      });
      labels = labels.map(labelTgl);
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
      ds = [{ label: g.store, data: bulan6.map(b => agregat(x => x === g.store, b, b).fc), borderColor: W[g.store], backgroundColor: W[g.store], spanGaps: true },
        { label: 'Batas', data: bulan6.map(() => batas), borderColor: css('--muted'), borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0 }];
      opt = { persen: true }; fmt = v => pct(v);
      gambarDetail('line', labels, ds, opt);
    } else if (g.tipe === 'biaya') {
      title = 'Biaya ' + g.kategori + ' ' + g.store + ' per bulan';
      labels = bulan6.map(labelBulan);
      ds = [{ label: g.kategori, data: bulan6.map(b => sum((D.biaya || []).filter(r => r.store === g.store && r.kategori === g.kategori && r.bulan === b).map(r => r.jumlah)) || null), backgroundColor: W[g.store], borderColor: W[g.store] }];
      gambarDetail('bar', labels, ds, {});
    } else if (g.tipe === 'margin') {
      title = 'Margin operasional ' + g.store + ' per bulan';
      labels = bulan6.map(labelBulan);
      ds = [{ label: g.store, data: bulan6.map(b => { const p = plOutlet(g.store, b, b); return p.adaBiaya ? p.margin : null; }), borderColor: W[g.store], backgroundColor: W[g.store], spanGaps: true },
        { label: 'Impas (0%)', data: bulan6.map(() => 0), borderColor: css('--muted'), borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0 }];
      opt = { persen: true }; fmt = v => pct(v);
      gambarDetail('line', labels, ds, opt);
    } else if (g.tipe === 'kategori') {
      title = 'Porsi belanja ' + g.kategori + ' terhadap omzet';
      labels = bulan6.map(labelBulan);
      ds = [{ label: g.kategori, data: bulan6.map(b => { const a = agScope(sc, b, b); return a.omz > 0 ? sum(a.B.filter(r => r.kategori === g.kategori).map(r => r.total)) / a.omz : null; }), borderColor: css('--s1'), backgroundColor: css('--s1'), spanGaps: true }];
      opt = { persen: true }; fmt = v => pct(v);
      gambarDetail('line', labels, ds, opt);
    }
    $('#gTitle').textContent = title;
    $('#gSub').textContent = sub;
    tabelDetail(labels, ds.filter(d => d.label !== 'Batas' && d.label !== 'Impas (0%)'), fmt);
  }
  function gambarDetail(tipe, labels, ds, opt) {
    const d = $('#dlgChart'); if (!d.open) d.showModal();
    gambar('chDetail', tipe, labels, ds, opt);
  }
  $('#gTutup').addEventListener('click', () => $('#dlgChart').close());
  $('#dlgChart').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  /* ================= Analisis AI (hanya saat tombol diklik) ================= */
  const MAKS_ANOMALI_AI = 15;
  const HARGA = { 'claude-haiku-4-5-20251001': [1, 5], 'claude-sonnet-5': [2, 10], 'claude-opus-5-5': [4, 20] }; // USD per 1 juta token (input, output)

  function ringkasanAI() {
    const sc = st.scope, D = st.data, a = agScope(sc, sc.dari, sc.sampai), aP = agScope(sc, sc.prevDari, sc.prevSampai);
    const bulan3 = monthsBetween(shiftMonth(sc.sampai, -2), sc.sampai);
    const stores = D.stores.filter(s => inStore(sc, s.kode));
    const baris = [];
    baris.push('Periode: ' + sc.dari + ' s/d ' + sc.sampai + ' (dibanding ' + sc.prevDari + ' s/d ' + sc.prevSampai + ') · Outlet: ' + (sc.storeSet ? stores.map(s => s.kode).join(', ') : 'semua (' + stores.length + ')') + ' · Batas food cost: ' + pct(D.batasFoodCost || 0.35, 0));
    baris.push('Total: omzet ' + rp(a.omz) + ' (' + (chg(a.omz, aP.omz) == null ? 'n/a' : (chg(a.omz, aP.omz) >= 0 ? '+' : '') + pct(chg(a.omz, aP.omz), 0)) + ' vs periode sebelumnya), belanja bahan ' + rp(a.bel) + ', food cost ' + pct(a.fc) +
      (a.ticket ? ', rata-rata per struk ' + rp(a.ticket) : '') + '.');
    const plT = plScope(sc, sc.dari, sc.sampai);
    baris.push('', 'Performa per outlet (periode ini):');
    stores.forEach(s => {
      const p = plOutlet(s.kode, sc.dari, sc.sampai), pp = plOutlet(s.kode, sc.prevDari, sc.prevSampai), x = agregat(k => k === s.kode, sc.dari, sc.sampai);
      if (!p.omz) return;
      baris.push('- ' + s.kode + ' (' + s.brand + '): omzet ' + rpS(p.omz) + ' (' + (chg(p.omz, pp.omz) == null ? 'n/a' : (chg(p.omz, pp.omz) >= 0 ? '+' : '') + pct(chg(p.omz, pp.omz), 0)) + ') | bahan ' + pct(p.fc) +
        (p.adaBiaya ? ' | karyawan ' + pct(p.karyPct) + ' | tetap/sewa ' + pct(p.tetap / p.omz) + ' | bulanan ' + pct(p.ops / p.omz) + ' | pembelian non-bahan ' + pct(p.pemb / p.omz) + ' | margin ' + pct(p.margin) : ' | biaya belum diisi') +
        (x.ticket ? ' | per struk ' + rpS(x.ticket) : ''));
    });
    if (plT.adaBiaya) {
      baris.push('Margin total ' + pct(plT.margin) + ', laba operasional ' + rp(plT.laba) + '.');
      baris.push('Margin per outlet per bulan (' + bulan3.join('/') + '): ' + stores.map(s => s.kode + ' ' + bulan3.map(b => { const p = plOutlet(s.kode, b, b); return p.adaBiaya ? pct(p.margin) : '–'; }).join('/')).join('; ') + '.');
    }
    baris.push('Food cost per outlet per bulan (' + bulan3.join('/') + '): ' + stores.map(s => s.kode + ' ' + bulan3.map(b => pct(agregat(x => x === s.kode, b, b).fc)).join('/')).join('; ') + '.');
    baris.push('', 'Anomali terdeteksi: ' + st.anomali.length + ' (ditampilkan ' + Math.min(MAKS_ANOMALI_AI, st.anomali.length) + ' teratas, urut level lalu dampak):');
    st.anomali.slice(0, MAKS_ANOMALI_AI).forEach((x, i) => {
      baris.push((i + 1) + '. [' + x.level.toUpperCase() + '][' + JENIS_LABEL[x.dimensi] + '] ' + x.judul + ' (' + [x.bulan, x.store].filter(Boolean).join(', ') + '): ' + x.detail + (x.dampak ? ' Dampak ±' + rp(x.dampak) + '.' : ''));
    });
    const top = [...groupBy(a.B, r => r.bahan).entries()].map(([b, rs]) => [b, sum(rs.map(r => r.total))]).sort((x, y) => y[1] - x[1]).slice(0, 8);
    baris.push('', 'Bahan dengan belanja terbesar: ' + top.map(([b, t]) => b + ' ' + rpS(t)).join('; ') + '.');
    return baris.join('\n');
  }

  function estimasi(model) {
    const teks = ringkasanAI();
    const tokIn = Math.round((teks.length + 1300) / 3.2), tokOut = 900;
    const [pi, po] = HARGA[model];
    return { teks, tokIn, usd: (tokIn * pi + tokOut * po) / 1e6 };
  }

  function renderAiMeta() {
    const model = $('#aiModel').value, e = estimasi(model);
    const cache = load(K.ai, {})[hash(e.teks + model)];
    const demo = st.data && st.data.demo;
    $('#aiMeta').innerHTML = 'Rangkuman performa, profit & anomali untuk filter saat ini. Cuma jalan kalau tombol diklik (±' + e.tokIn.toLocaleString('id-ID') +
      ' token, perkiraan ±$' + e.usd.toFixed(3) + ' per analisis).' + (demo ? ' <b>Mode demo: sambungkan ke Google Sheet dulu untuk memakai AI.</b>' : '');
    $('#btnAI').disabled = !!demo;
    $('#btnAI').textContent = cache ? 'Analisis ulang' : 'Analisis sekarang';
    if (cache) tampilAI(cache, true); else { $('#aiOut').classList.add('hidden'); $('#aiOut').innerHTML = ''; }
  }
  $('#aiModel').addEventListener('change', renderAiMeta);

  $('#btnAI').addEventListener('click', async () => {
    const model = $('#aiModel').value, e = estimasi(model);
    const btn = $('#btnAI');
    btn.disabled = true; btn.textContent = 'Menganalisis…';
    $('#aiOut').classList.remove('hidden');
    $('#aiOut').innerHTML = '<p class="hint">Claude sedang membaca ringkasan performa…</p>';
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
    const d = new Date(h.waktu), u = h.usage || {};
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
