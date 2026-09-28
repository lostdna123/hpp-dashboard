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
  // kolom tabel: satuan seragam "jt" supaya mudah dibandingkan; angka lengkap di tooltip (title)
  const rpJ = n => { const a = Math.abs(n || 0); return a >= 1e6 ? (n < 0 ? '-' : '') + 'Rp' + (a / 1e6).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' jt' : rp(n); };
  const tdJ = (v, cls) => '<td class="n' + (cls ? ' ' + cls : '') + '" title="' + rp(v) + '">' + rpJ(v) + '</td>';
  const alpha = (hex, a) => { const h = String(hex).replace('#', ''); if (h.length !== 6) return hex; return 'rgba(' + [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(',') + ',' + a + ')'; };
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
  const MARGIN_SEHAT = 0.10; // margin operasional di bawah ini = "perlu perhatian" (kalau outlet tidak punya target margin)
  const PRIME_MAKS = 0.65;   // prime cost (bahan + karyawan) di atas ini = terlalu berat — patokan umum industri FnB

  /* ================= koneksi ================= */
  /** Panggil Apps Script. Gangguan sesaat dari Google (halaman error HTML / koneksi putus) dicoba ulang otomatis. */
  async function api(body, percobaan) {
    percobaan = percobaan || 1;
    const MAKS = 3;
    let res, txt;
    try {
      res = await fetch(st.cfg.url, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // "simple request" → tanpa preflight CORS
        body: JSON.stringify(Object.assign({ key: st.cfg.key }, body))
      });
      txt = await res.text();
    } catch (e) {
      if (percobaan < MAKS) { await new Promise(r => setTimeout(r, 1500 * percobaan)); return api(body, percobaan + 1); }
      throw new Error('Tidak bisa menghubungi Google (' + e.message + '). Cek internet, lalu klik Refresh.');
    }
    let out;
    try { out = JSON.parse(txt); } catch (e) {
      if (percobaan < MAKS) { await new Promise(r => setTimeout(r, 1500 * percobaan)); return api(body, percobaan + 1); }
      const cuplikan = String(txt || '').replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
      throw new Error('Google tidak mengirim data (HTTP ' + (res && res.status) + ', sudah dicoba ' + MAKS + '×). ' +
        (cuplikan ? 'Pesan Google: "' + cuplikan + '". ' : 'Responnya kosong. ') + 'Pastikan URL berakhiran /exec, lalu coba lagi beberapa saat.');
    }
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
      target: (raw.target || []).map(r => ({ store: r[0], omzet: r[1], fc: r[2], margin: r[3] })),
      kasAwal: (raw.kasAwal || []).map(r => ({ store: r[0], tgl: r[1], jumlah: Number(r[2]) || 0 })),
      mutasiKas: (raw.mutasiKas || []).map(r => ({ tgl: r[0], store: r[1], jenis: r[2], ket: r[3], jumlah: Number(r[4]) || 0 })),
      biaya: (raw.biaya || []).map(r => ({ bulan: r[0], store: r[1], kelompok: r[2], kategori: r[3], jumlah: Number(r[4]) || 0, orang: Number(r[5]) || 0 }))
    };
  }

  async function muat() {
    const s = $('#status');
    if (st.cfg.demo) {
      st.data = buatDemo(today());
    } else if (st.cfg.url && st.cfg.key) {
      s.className = 'status'; s.textContent = 'Mengambil data…';
      $('main').classList.add('loading'); // bingkai lama tetap tampil (redup) selama memuat
      try { st.data = normalisasi(await api({ api: 'data' })); }
      catch (e) { s.className = 'status err'; s.textContent = 'Gagal terhubung'; toast(e.message); bukaSetting(e.message); return; }
      finally { $('main').classList.remove('loading'); }
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
    // filter dari link (#t=profit&d=2026-07&s=2026-09&b=…&o=…) menang atas yang tersimpan di browser
    const h = bacaHash(), simpan = load(K.ui, {});
    const ui = h.d || h.s || h.b || h.o ? { dari: h.d, sampai: h.s, brand: h.b, store: h.o } : simpan;
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
    const n = bulan.length, prevDari = shiftMonth(dari, -n), prevSampai = shiftMonth(dari, -1);
    // Perbandingan setara: kalau periode mencakup bulan berjalan (belum selesai), periode pembanding dipotong
    // di tanggal yang sama (mis. 1–28 Sep dibanding 1–28 Jun), bukan dibanding bulan yang penuh.
    const bulanIni = today().slice(0, 7);
    let cap = null, capHari = null;
    if (dari <= bulanIni && sampai >= bulanIni) {
      const kemarin = hariSebelum(today()), set = new Set(storeList);
      let last = null; st.data.omzet.forEach(r => { if (r.bulan === bulanIni && set.has(r.store) && (!last || r.tgl > last)) last = r.tgl; });
      const acuan = last && last > kemarin ? last : kemarin;
      capHari = acuan.slice(0, 7) === bulanIni ? Number(acuan.slice(8, 10)) : 1;
      cap = prevSampai + '-' + pad(Math.min(capHari, Anomali.daysInMonth(prevSampai)));
    }
    return { dari, sampai, bulan, storeSet, storeList, brand, store, prevDari, prevSampai, cap, capHari };
  }
  const inStore = (sc, s) => !sc.storeSet || sc.storeSet.has(s);
  /** 6 bulan terakhir s/d "sampai" (atau periode filter kalau lebih panjang), maks 12 */
  const rata7 = arr => arr.map((_, i) => { const w = arr.slice(Math.max(0, i - 6), i + 1).filter(x => x != null); return i >= 6 && w.length ? sum(w) / w.length : null; });
  const bulanGrafik = sc => { const b = sc.bulan.length >= 6 ? sc.bulan : monthsBetween(shiftMonth(sc.sampai, -5), sc.sampai); return b.slice(-12); };

  /* ================= hitungan ================= */
  function agregat(fStore, dari, sampai, cap) {
    const inR = r => r.bulan >= dari && r.bulan <= sampai && fStore(r.store) && (!cap || r.tgl <= cap);
    const B = st.data.belanja.filter(inR), O = st.data.omzet.filter(inR);
    const bel = sum(B.map(r => r.total)), omz = sum(O.map(r => r.omzet));
    const struk = sum(O.map(r => Number(r.struk) || 0));
    return { B, O, bel, omz, struk, fc: omz > 0 ? bel / omz : null, ticket: struk > 0 ? omz / struk : null };
  }
  const agScope = (sc, dari, sampai, cap) => agregat(s => inStore(sc, s), dari, sampai, cap);
  /** batas tanggal pembanding untuk "bulan lalu" dari bulan b (hanya kalau b bulan berjalan) */
  const capBulanLalu = (sc, b) => b === today().slice(0, 7) && sc.capHari ? shiftMonth(b, -1) + '-' + pad(Math.min(sc.capHari, Anomali.daysInMonth(shiftMonth(b, -1)))) : null;

  /**
   * Laba rugi. Bulan berjalan: biaya karyawan & tetap dipotong proporsional sesuai hari yang sudah lewat,
   * supaya sebanding dengan omzet yang baru masuk sebagian.
   */
  function hitungPL(fStore, dari, sampai, cap) {
    const D = st.data, bulanIni = today().slice(0, 7);
    const faktorBerjalan = Math.max(1, Number(today().slice(8, 10)) - 1) / Anomali.daysInMonth(bulanIni);
    // cap: periode pembanding dipotong di tanggal tertentu → biaya bulanan bulan itu ikut proporsional
    const capBln = cap ? cap.slice(0, 7) : null, capFrak = cap ? Number(cap.slice(8, 10)) / Anomali.daysInMonth(capBln) : 1;
    const inR = r => r.bulan >= dari && r.bulan <= sampai && fStore(r.store) && (!cap || !r.tgl || r.tgl <= cap);
    const omz = sum(D.omzet.filter(inR).map(r => r.omzet)), hpp = sum(D.belanja.filter(inR).map(r => r.total));
    const by = (D.biaya || []).filter(inR).map(r => Object.assign({}, r, {
      jumlah: r.bulan === bulanIni && r.kelompok !== 'Operasional' ? r.jumlah * faktorBerjalan : r.bulan === capBln ? r.jumlah * capFrak : r.jumlah
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
      prime: omz > 0 && by.some(r => r.kelompok === 'Karyawan') ? (hpp + kary) / omz : null,
      adaBiaya: by.some(r => r.kelompok === 'Karyawan' || r.kelompok === 'Tetap')
    };
  }
  const plScope = (sc, dari, sampai, cap) => hitungPL(s => inStore(sc, s), dari, sampai, cap);
  const plOutlet = (kode, dari, sampai, cap) => hitungPL(s => s === kode, dari, sampai, cap);

  /* ================= kas per outlet =================
     Saldo = saldo awal + omzet − belanja bahan − pembelian lain − gaji − biaya tetap − tagihan ± mutasi manual.
     Gaji, biaya tetap & tagihan bulanan dianggap dibayar di hari terakhir bulan itu (bulan berjalan: belum). */
  const akhirBulan = b => b + '-' + pad(Anomali.daysInMonth(b));
  const arahMutasi = j => /keluar/i.test(j) ? -1 : /masuk/i.test(j) ? 1 : 0;
  function bukuKas(kode) {
    const D = st.data;
    st.kasCache = st.kasCache && st.kasCache.data === D ? st.kasCache : { data: D, per: {} };
    if (st.kasCache.per[kode]) return st.kasCache.per[kode];
    const awal = (D.kasAwal || []).find(x => x.store === kode);
    const mulai = awal ? awal.tgl : null, bulanIni = today().slice(0, 7), ev = [];
    if (mulai) {
      ev.push({ tgl: mulai, jenis: 'modal', v: awal.jumlah });
      const ok = t => t >= mulai;
      D.omzet.forEach(r => { if (r.store === kode && ok(r.tgl)) ev.push({ tgl: r.tgl, jenis: 'omzet', v: r.omzet }); });
      D.belanja.forEach(r => { if (r.store === kode && ok(r.tgl)) ev.push({ tgl: r.tgl, jenis: 'bahan', v: -r.total }); });
      (D.pembelian || []).forEach(r => { if (r.store === kode && ok(r.tgl)) ev.push({ tgl: r.tgl, jenis: 'pembelian', v: -r.total }); });
      const J = { Karyawan: 'gaji', Tetap: 'tetap', Operasional: 'tagihan' };
      (D.biaya || []).forEach(r => { if (r.store === kode && r.bulan < bulanIni && ok(akhirBulan(r.bulan))) ev.push({ tgl: akhirBulan(r.bulan), jenis: J[r.kelompok] || 'tagihan', v: -r.jumlah }); });
      (D.mutasiKas || []).forEach(r => {
        if (r.store !== kode || !ok(r.tgl)) return;
        const a = arahMutasi(r.jenis);
        ev.push({ tgl: r.tgl, jenis: 'mutasi', v: a ? a * Math.abs(r.jumlah) : r.jumlah });
      });
    }
    ev.sort((x, y) => x.tgl < y.tgl ? -1 : x.tgl > y.tgl ? 1 : 0);
    let c = 0; const cum = ev.map(e => (c += e.v));
    const out = { mulai, ev, cum,
      saldo: t => { let lo = 0, hi = ev.length - 1, ans = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (ev[m].tgl <= t) { ans = m; lo = m + 1; } else hi = m - 1; } return ans < 0 ? 0 : cum[ans]; },
      // biaya bulan berjalan yang belum dibayar (perkiraan penuh sebulan)
      tertunda: sum((D.biaya || []).filter(r => r.store === kode && r.bulan === bulanIni).map(r => r.jumlah)) };
    st.kasCache.per[kode] = out;
    return out;
  }
  const hariSebelum = t => { const d = new Date(t + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
  const batasHariIni = t => t > today() ? today() : t;
  const saldoScope = (sc, t) => sum(sc.storeList.map(k => bukuKas(k).saldo(t)));
  const adaKas = () => (st.data.kasAwal || []).length > 0;
  /** Arus kas satu bulan untuk sekumpulan outlet (basis kas). Saldo awal = akhir − arus bersih (modal awal masuk ke saldo awal). */
  function arusBulan(kodes, b) {
    const r = { omzet: 0, masukLain: 0, bahan: 0, pembelian: 0, gaji: 0, tetap: 0, tagihan: 0, keluarLain: 0, tertunda: 0, akhir: 0 };
    const tAkhir = batasHariIni(akhirBulan(b)), berjalan = b === today().slice(0, 7);
    kodes.forEach(k => {
      const bk = bukuKas(k);
      if (!bk.mulai) return;
      r.akhir += bk.saldo(tAkhir);
      if (berjalan) r.tertunda += bk.tertunda;
      bk.ev.forEach(e => {
        if (e.tgl.slice(0, 7) !== b || e.jenis === 'modal') return;
        if (e.jenis === 'mutasi') { if (e.v >= 0) r.masukLain += e.v; else r.keluarLain -= e.v; return; }
        if (e.jenis === 'omzet') r.omzet += e.v; else r[e.jenis] -= e.v;
      });
    });
    r.masuk = r.omzet + r.masukLain;
    r.keluar = r.bahan + r.pembelian + r.gaji + r.tetap + r.tagihan + r.keluarLain;
    r.bersih = r.masuk - r.keluar;
    r.awal = r.akhir - r.bersih;
    r.berjalan = berjalan && r.tertunda > 0;
    return r;
  }

  /* ---------- target per outlet (sheet TARGET_OUTLET) ---------- */
  const targetOf = kode => (st.data.target || []).find(t => t.store === kode) || null;
  const batasFc = kode => (targetOf(kode) || {}).fc || st.data.batasFoodCost || 0.35;
  const targetMargin = kode => { const t = targetOf(kode); return t && t.margin != null ? t.margin : MARGIN_SEHAT; };
  /** jumlah bulan setara dalam periode: bulan penuh = 1, bulan berjalan = hari berjalan ÷ hari sebulan */
  const bulanSetara = sc => sum(sc.bulan.filter(b => b <= today().slice(0, 7)).map(b => b === today().slice(0, 7) ? (sc.capHari || 1) / Anomali.daysInMonth(b) : 1));
  /** capaian omzet vs target (hanya outlet yang punya target) → { capaian, target, omzet } atau null */
  function capaianTarget(sc, kodes) {
    const ks = kodes.filter(k => (targetOf(k) || {}).omzet);
    if (!ks.length) return null;
    const target = sum(ks.map(k => targetOf(k).omzet)) * bulanSetara(sc);
    const omzet = agregat(s => ks.includes(s), sc.dari, sc.sampai).omz;
    return { capaian: target ? omzet / target : null, target, omzet };
  }
  const capHtml = c => c == null ? '<span class="hint">–</span>' :
    '<span class="cap" title="' + pct(c) + ' dari target"><span class="cap-bar"><i style="width:' + Math.min(100, c * 100).toFixed(1) + '%"></i></span><b class="' + (c >= 1 ? 'down' : c < 0.9 ? 'up' : '') + '">' + pct(c, 0) + '</b></span>';

  /**
   * Titik impas (break-even): omzet per hari minimal supaya laba operasional = 0.
   * Biaya tetap = gaji + sewa/tetap + tagihan (kecuali komisi ojol); biaya variabel = bahan + pembelian lain + komisi ojol.
   */
  function titikImpas(fStore, sc) {
    const p = hitungPL(fStore, sc.dari, sc.sampai), bulanIni = today().slice(0, 7);
    if (!p.omz || !p.adaBiaya) return null;
    const komisi = sum(p.by.filter(r => r.kelompok === 'Operasional' && /komisi/i.test(r.kategori)).map(r => r.jumlah));
    const variabel = p.hpp + p.pemb + komisi, tetap = p.kary + p.tetap + p.ops - komisi, rasioVar = variabel / p.omz;
    const hari = sum(sc.bulan.filter(b => b <= bulanIni).map(b => b === bulanIni ? (sc.capHari || 1) : Anomali.daysInMonth(b)));
    if (rasioVar >= 1 || !hari) return null;
    const impasHari = tetap / hari / (1 - rasioVar), omzHari = p.omz / hari;
    return { impasHari, omzHari, jarak: omzHari / impasHari - 1, rasioVar, tetapHari: tetap / hari };
  }
  const jarakHtml = j => j == null ? '–' : '<span class="st ' + (j < 0 ? 'kritis' : j < 0.2 ? 'perhatian' : 'sehat') + '"><i>' + (j < 0 ? '✕' : j < 0.2 ? '!' : '✓') + '</i>' + (j >= 0 ? '+' : '') + pct(j, 0) + '</span>';

  function statusOutlet(p, nAnomaliTinggi, kode) {
    const batas = kode ? batasFc(kode) : st.data.batasFoodCost || 0.35, mMin = kode ? targetMargin(kode) : MARGIN_SEHAT;
    if (!p.omz) return { cls: 'perhatian', ikon: '!', label: 'Belum ada omzet' };
    if ((p.adaBiaya && p.margin < 0) || p.fc > batas + 0.05) return { cls: 'kritis', ikon: '✕', label: p.adaBiaya && p.margin < 0 ? 'Rugi' : 'Food cost tinggi' };
    if ((p.adaBiaya && p.margin < mMin) || p.fc > batas || nAnomaliTinggi) return { cls: 'perhatian', ikon: '!', label: 'Perlu perhatian' };
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
    $('#cntAnomali').textContent = st.anomali.filter(a => a.level === 'tinggi').length || '';
    renderScope();
    renderKpi();
    tulisHash();
    renderAiMeta();
    renderTab();
  }

  /** Sparkline SVG: seluruh tren warna redup, periode terpilih warna aksen, titik terakhir bercincin. */
  function sparkSvg(vals, mulai, o) {
    o = o || {};
    const v = vals.map(x => (x == null || !isFinite(x)) ? null : x), ada = v.filter(x => x != null);
    if (ada.length < 2) return '';
    const W = 100, H = o.h || 28, pd = 4, min = Math.min(...ada), max = Math.max(...ada);
    const X = i => i * W / (v.length - 1), Y = x => max === min ? H / 2 : pd + (H - 2 * pd) * (1 - (x - min) / (max - min));
    const jalur = (a, b) => { let d = '', pen = false; for (let i = a; i <= b; i++) { if (v[i] == null) { pen = false; continue; } d += (pen ? 'L' : 'M') + X(i).toFixed(2) + ' ' + Y(v[i]).toFixed(2); pen = true; } return d; };
    let akhir = v.length - 1; while (akhir > 0 && v[akhir] == null) akhir--;
    const warna = o.warna || 'var(--accent)', ns = ' vector-effect="non-scaling-stroke" fill="none" stroke-linecap="round" stroke-linejoin="round"';
    const titik = 'M' + X(akhir).toFixed(2) + ' ' + Y(v[akhir]).toFixed(2) + 'h0';
    return '<svg class="' + (o.cls || 'spark') + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(o.label || 'tren') + '">' +
      '<path d="' + jalur(0, v.length - 1) + '" stroke="var(--axis)" stroke-width="1.5"' + ns + '/>' +
      '<path d="' + jalur(Math.max(0, mulai), v.length - 1) + '" stroke="' + warna + '" stroke-width="2"' + ns + '/>' +
      '<path d="' + titik + '" stroke="var(--surface)" stroke-width="10"' + ns + '/><path d="' + titik + '" stroke="' + warna + '" stroke-width="6"' + ns + '/></svg>';
  }

  function renderKpi() {
    const sc = st.scope, batas = st.data.batasFoodCost || 0.35;
    const pl = plScope(sc, sc.dari, sc.sampai), plP = plScope(sc, sc.prevDari, sc.prevSampai, sc.cap);
    const a = agScope(sc, sc.dari, sc.sampai), aP = agScope(sc, sc.prevDari, sc.prevSampai, sc.cap);
    const lv = l => st.anomali.filter(x => x.level === l).length, tinggi = lv('tinggi'), sedang = lv('sedang'), rendah = lv('rendah');
    // tren bulanan untuk sparkline
    const bl = bulanGrafik(sc), mulai = Math.max(0, bl.indexOf(sc.dari)), aB = bl.map(b => agScope(sc, b, b)), pB = bl.map(b => plScope(sc, b, b));
    const lblTren = (nama, arr, f) => nama + ' per bulan: ' + bl.map((b, i) => labelBulan(b) + ' ' + (arr[i] == null ? '–' : f(arr[i]))).join(', ');
    const spark = (nama, arr, f) => '<div class="spark-w">' + sparkSvg(arr, mulai, { label: lblTren(nama, arr, f) }) + '</div>';
    const d = html => '<div class="d">' + html + ' vs periode sebelumnya</div>';
    const kpi = (label, nilai, sub, extra) => '<button type="button" class="kpi' + (extra && extra.tab ? ' klik" data-goto="' + extra.tab : '') + '"' + (extra && extra.title ? ' title="' + esc(extra.title) + '"' : '') + '>' +
      '<div class="l">' + label + '</div><div class="v' + (extra && extra.cls ? ' ' + extra.cls : '') + '">' + nilai + '</div>' + sub + (extra && extra.bawah || '') + '</button>';
    const total = tinggi + sedang + rendah;
    const meter = total ? '<div class="meter-wrap"><div class="meter" role="img" aria-label="' + tinggi + ' tinggi, ' + sedang + ' sedang, ' + rendah + ' rendah">' +
      [[tinggi, '--crit-mark'], [sedang, '--serious'], [rendah, '--warn-mark']].filter(x => x[0]).map(x => '<i style="flex:' + x[0] + ';background:var(' + x[1] + ')"></i>').join('') + '</div></div>' : '';
    $('#kpis').innerHTML = [
      kpi('Omzet', rpS(a.omz), d(chgHtml(chg(a.omz, aP.omz), true)), { tab: 'penjualan', title: rp(a.omz), bawah: spark('Omzet', aB.map(x => x.omz || null), rpS) }),
      pl.adaBiaya
        ? kpi('Laba operasional', rpS(pl.laba), '<div class="d">margin <b>' + pct(pl.margin) + '</b> · ' + poinHtml(plP.adaBiaya ? pl.margin - plP.margin : null, true) + '</div>',
          { tab: 'profit', cls: pl.laba < 0 ? 'neg' : '', title: rp(pl.laba) + ' = omzet − bahan − karyawan − biaya tetap − biaya bulanan − pembelian lain', bawah: spark('Laba operasional', pB.map(x => x.adaBiaya && x.omz ? x.laba : null), rpS) })
        : kpi('Laba operasional', '–', '<div class="d">isi biaya karyawan & sewa di sheet</div>', { tab: 'profit' }),
      kpi('Food cost', pct(a.fc), d(poinHtml(a.fc != null && aP.fc != null ? a.fc - aP.fc : null, false)), { tab: 'bahan', cls: a.fc > batas ? 'over' : '', title: 'Belanja bahan ÷ omzet · batas ' + pct(batas, 0), bawah: spark('Food cost', aB.map(x => x.fc), x => pct(x)) }),
      kpi('Prime cost', pl.prime != null ? pct(pl.prime) : '–', pl.prime != null ? '<div class="d">bahan <b>' + pct(pl.fc) + '</b> + karyawan <b>' + pct(pl.karyPct) + '</b></div>' : '<div class="d">isi MASTER_KARYAWAN di sheet</div>',
        { tab: 'profit', cls: pl.prime > PRIME_MAKS ? 'over' : '', title: 'Prime cost = (belanja bahan + biaya karyawan) ÷ omzet. Patokan umum FnB: ≤ ' + pct(PRIME_MAKS, 0) + '. Karyawan ' + rp(pl.kary),
          bawah: pl.prime != null ? spark('Prime cost', pB.map(x => x.prime), x => pct(x)) : '' }),
      (() => {
        if (!adaKas()) return kpi('Cashflow', '–', '<div class="d">isi SALDO_AWAL_KAS di sheet</div>', { tab: 'kas' });
        // arus kas bersih periode; bulan berjalan dikurangi gaji/sewa/tagihan yang belum dibayar supaya tidak menggelembung
        const net = b => { const r = arusBulan(sc.storeList, b); return r.bersih - r.tertunda; };
        const bersih = sum(sc.bulan.filter(b => b + '-01' <= today()).map(net));
        const akhir = saldoScope(sc, batasHariIni(akhirBulan(sc.sampai)));
        return kpi('Cashflow', (bersih < 0 ? '−' : '+') + rpS(Math.abs(bersih)), '<div class="d">saldo kas <b>' + rpS(akhir) + '</b></div>',
          { tab: 'kas', cls: bersih < 0 ? 'neg' : '', title: 'Arus kas bersih ' + rp(bersih) + ' (kas masuk − kas keluar, termasuk gaji/sewa/tagihan bulan berjalan yang belum dibayar)',
            bawah: spark('Arus kas bersih per bulan', bl.map(b => b + '-01' <= today() ? net(b) : null), rpS) });
      })(),
      kpi('Anomali', String(total), '<div class="d">' + (total ? '<b>' + tinggi + '</b> tinggi · <b>' + sedang + '</b> sedang · ' + rendah + ' rendah' : 'tidak ada temuan') + '</div>', { tab: 'anomali', bawah: meter })
    ].join('');
  }

  /* ---------- judul cakupan & preset periode ---------- */
  const labelPeriode = (a, b) => {
    const nb = x => NAMA_BULAN[Number(x.slice(5, 7)) - 1], th = x => x.slice(0, 4);
    if (a === b) return nb(a) + ' ' + th(a);
    return th(a) === th(b) ? nb(a) + ' – ' + nb(b) + ' ' + th(b) : nb(a) + ' ' + th(a) + ' – ' + nb(b) + ' ' + th(b);
  };
  function renderScope() {
    const sc = st.scope, D = st.data, bulanIni = today().slice(0, 7);
    const nama = sc.store ? (D.stores.find(s => s.kode === sc.store) || {}).nama || sc.store : sc.brand ? sc.brand + ' · ' + sc.storeList.length + ' outlet' : 'Semua outlet · ' + D.stores.length + ' outlet';
    $('#scopeTitle').textContent = labelPeriode(sc.dari, sc.sampai);
    $('#scopeSub').textContent = nama + ' · dibanding ' + labelPeriode(sc.prevDari, sc.prevSampai) + (sc.cap ? ' (s/d tgl ' + Number(sc.cap.slice(8, 10)) + ', biar setara)' : '') +
      (sc.sampai >= bulanIni && sc.dari <= bulanIni ? ' · ' + NAMA_BULAN[Number(bulanIni.slice(5, 7)) - 1] + ' masih berjalan (hari ke-' + Number(today().slice(8, 10)) + ')' : '');
    const opsi = [...$('#fSampai').options].map(o => o.value), akhir = opsi[opsi.length - 1];
    $$('#presets button').forEach(b => b.classList.toggle('on', sc.sampai === akhir && sc.bulan.length === Number(b.dataset.n)));
  }
  $$('#presets button').forEach(b => b.addEventListener('click', () => {
    if (!st.data) return;
    const opsi = [...$('#fSampai').options].map(o => o.value), akhir = opsi[opsi.length - 1];
    let dari = shiftMonth(akhir, -(Number(b.dataset.n) - 1));
    if (dari < opsi[0]) dari = opsi[0];
    $('#fSampai').value = akhir; $('#fDari').value = dari; simpanUi(); render();
  }));

  /* ---------- tema ---------- */
  const mqGelap = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const temaAktif = () => document.documentElement.dataset.theme || (mqGelap && mqGelap.matches ? 'dark' : 'light');
  const IKON_TEMA = { dark: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    light: '<svg class="i" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/></svg>' };
  function setIkonTema() { $('#btnTema').innerHTML = IKON_TEMA[temaAktif()]; $('#btnTema').title = temaAktif() === 'dark' ? 'Pakai tema terang' : 'Pakai tema gelap'; }
  $('#btnTema').addEventListener('click', () => {
    const baru = temaAktif() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = baru;
    try { localStorage.setItem('hppdash.tema', baru); } catch (e) { /* abaikan */ } // dibaca juga oleh skrip kecil di <head>
    setIkonTema(); render();
  });
  if (mqGelap && mqGelap.addEventListener) mqGelap.addEventListener('change', () => { if (!document.documentElement.dataset.theme) { setIkonTema(); render(); } });
  setIkonTema();

  /* ---------- tabs ---------- */
  const TABS = ['ringkasan', 'outlet', 'penjualan', 'profit', 'kas', 'bahan', 'anomali'];
  function keTab(t) { st.tab = t; renderTab(); tulisHash(); }
  function bacaHash() { try { return Object.fromEntries(new URLSearchParams(location.hash.slice(1))); } catch (e) { return {}; } }
  function tulisHash() {
    if (!st.scope) return;
    const q = new URLSearchParams();
    q.set('t', st.tab); q.set('d', st.scope.dari); q.set('s', st.scope.sampai);
    if (st.scope.brand) q.set('b', st.scope.brand);
    if (st.scope.store) q.set('o', st.scope.store);
    try { history.replaceState(null, '', '#' + q.toString()); } catch (e) { /* abaikan */ }
  }
  { const t = bacaHash().t; if (t && ['ringkasan', 'outlet', 'penjualan', 'profit', 'kas', 'bahan', 'anomali'].includes(t)) st.tab = t; }
  $$('.tabs button').forEach(b => b.addEventListener('click', () => keTab(b.dataset.tab)));
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-goto]');
    if (g) { e.preventDefault(); keTab(g.dataset.goto); window.scrollTo({ top: $('.tabs').offsetTop - 8, behavior: 'smooth' }); }
  });
  function renderTab() {
    $$('.tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === st.tab));
    TABS.forEach(t => $('#v-' + t).classList.toggle('hidden', t !== st.tab));
    ({ ringkasan: renderRingkasan, outlet: renderOutlet, penjualan: renderPenjualan, profit: renderProfit, kas: renderKas, bahan: renderBahan, anomali: renderAnomali })[st.tab]();
  }

  /* ================= RINGKASAN ================= */
  /* ---------- panel "Kemarin & bulan ini" (selalu relatif ke hari ini, ikut filter brand/outlet) ---------- */
  const HARI_PANJANG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const geserHari = (t, n) => { const d = new Date(t + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const hariKe = t => new Date(t + 'T00:00:00Z').getUTCDay();
  const labelHari = t => HARI_PANJANG[hariKe(t)] + ', ' + labelTgl(t);
  /** omzet bulan berjalan untuk sekumpulan outlet + pembanding setara + proyeksi akhir bulan (pola hari dalam minggu 4 minggu terakhir) */
  function bulanBerjalan(kodes) {
    const D = st.data, set = new Set(kodes), bulanIni = today().slice(0, 7), bulanLalu = shiftMonth(bulanIni, -1), dim = Anomali.daysInMonth(bulanIni);
    const O = D.omzet.filter(r => set.has(r.store) && r.bulan === bulanIni);
    const last = O.reduce((m, r) => r.tgl > m ? r.tgl : m, '');
    const dEl = last ? Number(last.slice(8, 10)) : 0, mtd = sum(O.map(r => r.omzet));
    const prev = sum(D.omzet.filter(r => set.has(r.store) && r.bulan === bulanLalu && Number(r.tgl.slice(8, 10)) <= dEl).map(r => r.omzet));
    const acuan = last || hariSebelum(today()), harian = new Map();
    D.omzet.forEach(r => { if (set.has(r.store) && r.tgl <= acuan && r.tgl > geserHari(acuan, -28)) harian.set(r.tgl, (harian.get(r.tgl) || 0) + r.omzet); });
    const perHari = [0, 1, 2, 3, 4, 5, 6].map(() => []); harian.forEach((v, t) => perHari[hariKe(t)].push(v));
    const rataAll = harian.size ? sum([...harian.values()]) / harian.size : 0;
    const rata = perHari.map(a => a.length ? sum(a) / a.length : rataAll);
    let sisa = 0; for (let d = dEl + 1; d <= dim; d++) sisa += rata[hariKe(bulanIni + '-' + pad(d))];
    return { mtd, prev, dEl, dim, proyeksi: mtd + sisa, bulanIni, bulanLalu };
  }

  function renderPulse() {
    const sc = st.scope, D = st.data, W = warnaStore();
    const stores = D.stores.filter(s => inStore(sc, s.kode)), kodes = stores.map(s => s.kode), set = new Set(kodes);
    const kemarin = hariSebelum(today()), mgLalu = geserHari(kemarin, -7);
    const oBy = groupBy(D.omzet.filter(r => set.has(r.store) && (r.tgl === kemarin || r.tgl === mgLalu)), r => r.store + '|' + r.tgl);
    const nilai = (k, t) => { const r = oBy.get(k + '|' + t); return r ? sum(r.map(x => x.omzet)) : null; };

    // kolom 1: kemarin vs hari yang sama minggu lalu (hanya outlet yang sudah input, biar setara)
    const rk = stores.map(s => ({ s, v: nilai(s.kode, kemarin), p: nilai(s.kode, mgLalu) }));
    const sudah = rk.filter(r => r.v != null), totK = sum(sudah.map(r => r.v)), totP = sum(sudah.map(r => r.p || 0));
    const kol1 = '<div class="plabel">Kemarin · ' + labelHari(kemarin) + '</div>' +
      '<div class="pbig">' + (sudah.length ? rpS(totK) : '–') + '</div>' +
      '<div class="d">' + (sudah.length ? chgHtml(chg(totK, totP), true) + ' vs ' + labelHari(mgLalu) : 'belum ada omzet masuk') + (sudah.length < rk.length && sudah.length ? ' · ' + sudah.length + '/' + rk.length + ' outlet' : '') + '</div>' +
      '<ul class="plist">' + rk.sort((a, b) => (b.v || -1) - (a.v || -1)).map(r => '<li><span><span class="sw" style="background:' + W[r.s.kode] + '"></span>' + esc(r.s.kode) + '</span>' +
        (r.v == null ? '<span class="st perhatian"><i>!</i>belum input</span>' : '<span class="pv"><b>' + rpS(r.v) + '</b>' + chgHtml(chg(r.v, r.p), true) + '</span>') + '</li>').join('') + '</ul>';

    // kolom 2: bulan ini sampai sejauh ini + proyeksi + target
    const bb = bulanBerjalan(kodes), nb = NAMA_BULAN[Number(bb.bulanIni.slice(5, 7)) - 1], nbl = NAMA_BULAN[Number(bb.bulanLalu.slice(5, 7)) - 1];
    const ks = kodes.filter(k => (targetOf(k) || {}).omzet);
    let targetHtml = '<p class="hint ptip">Isi target omzet per outlet di sheet <b>TARGET_OUTLET</b> untuk melihat capaian &amp; jalur target.</p>';
    if (ks.length && bb.dEl) {
      const bt = ks.length === kodes.length ? bb : bulanBerjalan(ks), tgt = sum(ks.map(k => targetOf(k).omzet));
      const cap = bt.mtd / tgt, jalur = bt.dEl / bt.dim, capP = bt.proyeksi / tgt, sesuai = cap >= jalur * 0.98;
      targetHtml = '<div class="bullet" role="img" aria-label="Capaian ' + pct(cap, 0) + ', jalur seharusnya ' + pct(jalur, 0) + '"><i class="fill ' + (sesuai ? 'ok' : 'lambat') + '" style="width:' + Math.min(100, cap * 100).toFixed(1) + '%"></i><i class="pace" style="left:' + (jalur * 100).toFixed(1) + '%"></i></div>' +
        '<div class="pmeta"><span><b>' + pct(cap, 0) + '</b> dari target ' + rpS(tgt) + (ks.length < kodes.length ? ' (' + ks.length + ' outlet)' : '') + '</span><span class="st ' + (sesuai ? 'sehat' : 'perhatian') + '"><i>' + (sesuai ? '✓' : '!') + '</i>' + (sesuai ? 'Sesuai jalur' : 'Di bawah jalur') + '</span></div>' +
        '<p class="hint">Garis tegak = seharusnya ' + pct(jalur, 0) + ' (hari ke-' + bt.dEl + ' dari ' + bt.dim + '). Proyeksi akhir bulan <b>' + pct(capP, 0) + '</b> dari target.</p>';
    }
    const kol2 = '<div class="plabel">Bulan ini · 1–' + (bb.dEl || 1) + ' ' + nb + '</div>' +
      '<div class="pbig">' + rpS(bb.mtd) + '</div>' +
      '<div class="d">' + chgHtml(chg(bb.mtd, bb.prev), true) + ' vs 1–' + (bb.dEl || 1) + ' ' + nbl + '</div>' +
      '<div class="pproj"><span>Proyeksi akhir ' + nb + '</span><b>' + rpS(bb.proyeksi) + '</b></div>' + targetHtml;

    // kolom 3: status input per outlet
    const bulanIni = today().slice(0, 7), sampaiHari = kemarin.slice(0, 7) === bulanIni ? Number(kemarin.slice(8, 10)) : 0;
    const terakhir = (arr, k) => arr.reduce((m, r) => r.store === k && r.tgl > m ? r.tgl : m, '');
    const kol3 = '<div class="plabel">Status input</div><ul class="plist inputs">' + stores.map(s => {
      const lo = terakhir(D.omzet, s.kode), lb = terakhir(D.belanja, s.kode);
      const hariAda = new Set(D.omzet.filter(r => r.store === s.kode && r.bulan === bulanIni).map(r => r.tgl));
      let bolong = 0; for (let d = 1; d <= sampaiHari; d++) if (!hariAda.has(bulanIni + '-' + pad(d))) bolong++;
      const st1 = lo >= kemarin && !bolong ? ['sehat', '✓', 'Lengkap'] : lo < kemarin ? ['perhatian', '!', 'Omzet kemarin belum'] : ['perhatian', '!', bolong + ' hari bolong'];
      return '<li><div><span class="sw" style="background:' + W[s.kode] + '"></span><b>' + esc(s.kode) + '</b><div class="hint">omzet s/d ' + (lo ? labelTgl(lo) : '–') + ' · belanja s/d ' + (lb ? labelTgl(lb) : '–') + '</div></div>' +
        '<span class="st ' + st1[0] + '"><i>' + st1[1] + '</i>' + st1[2] + '</span></li>';
    }).join('') + '</ul>';

    $('#pulse').innerHTML = '<div class="card-head"><h2>Kemarin &amp; bulan ini</h2><span class="hint">selalu dihitung dari hari ini (tidak ikut filter periode) · ikut filter brand &amp; outlet</span></div>' +
      '<div class="pulse-grid"><section class="pcol">' + kol1 + '</section><section class="pcol">' + kol2 + '</section><section class="pcol">' + kol3 + '</section></div>';
  }

  function renderRingkasan() {
    const sc = st.scope, D = st.data, W = warnaStore();
    renderPulse();
    const stores = D.stores.filter(s => inStore(sc, s.kode));
    const bulan = bulanGrafik(sc);

    // omzet per bulan, ditumpuk per outlet
    const tampil = stores.slice(0, 8);
    gambar('chOmzetBulan', 'bar', bulan.map(labelBulan), tampil.map(s => ({
      label: s.kode, backgroundColor: W[s.kode],
      data: bulan.map(b => sum(D.omzet.filter(r => r.store === s.kode && r.bulan === b).map(r => r.omzet)) || null)
    })), { stacked: true });

    // rasio % omzet
    const pls = bulan.map(b => plScope(sc, b, b));
    const ds = [
      { label: 'Food cost', data: pls.map(p => p.fc), borderColor: css('--s2'), backgroundColor: css('--s2') },
      { label: 'Biaya karyawan', data: pls.map(p => p.adaBiaya ? p.karyPct : null), borderColor: css('--s5'), backgroundColor: css('--s5') },
      { label: 'Prime cost', data: pls.map(p => p.prime), borderColor: css('--s7'), backgroundColor: css('--s7') },
      { label: 'Margin operasional', data: pls.map(p => p.adaBiaya ? p.margin : null), borderColor: css('--s1'), backgroundColor: css('--s1') }
    ];
    gambar('chRasio', 'line', bulan.map(labelBulan), ds, { persen: true });

    // performa outlet
    const rows = stores.map(s => {
      const p = plOutlet(s.kode, sc.dari, sc.sampai), pp = plOutlet(s.kode, sc.prevDari, sc.prevSampai, sc.cap);
      const a = agregat(x => x === s.kode, sc.dari, sc.sampai);
      const an = st.anomali.filter(x => x.store === s.kode);
      return { s, p, pp, a, an, cap: capaianTarget(sc, [s.kode]), status: statusOutlet(p, an.filter(x => x.level === 'tinggi').length, s.kode) };
    }).sort((x, y) => y.p.omz - x.p.omz);
    const tot = plScope(sc, sc.dari, sc.sampai), totP = plScope(sc, sc.prevDari, sc.prevSampai, sc.cap), aTot = agScope(sc, sc.dari, sc.sampai);
    const batas = D.batasFoodCost || 0.35;
    const capTot = capaianTarget(sc, stores.map(s => s.kode));
    const sel = (p, pp, cap, bFc, extra) =>
      tdJ(p.omz) + '<td class="n">' + chgHtml(chg(p.omz, pp.omz), true) + '</td>' +
      '<td class="n">' + capHtml(cap ? cap.capaian : null) + '</td>' +
      '<td class="n' + (p.fc > bFc ? ' over' : '') + '">' + pct(p.fc) + '</td>' +
      '<td class="n' + (p.prime > PRIME_MAKS ? ' over' : '') + '" title="bahan ' + pct(p.fc) + ' + karyawan ' + pct(p.karyPct) + '">' + pct(p.prime) + '</td>' +
      (p.adaBiaya ? tdJ(p.laba, p.laba < 0 ? 'neg' : '') : '<td class="n">–</td>') +
      '<td class="n' + (p.adaBiaya && p.margin < 0 ? ' neg' : '') + '"><b>' + (p.adaBiaya ? pct(p.margin) : '–') + '</b></td>' + (extra || '');
    $('#tbPerforma').innerHTML = '<thead><tr><th>Outlet</th><th>Status</th><th class="n">Omzet</th><th class="n">vs sblm</th><th class="n">Target</th><th class="n">Food cost</th>' +
      '<th class="n" title="bahan + karyawan, patokan ≤ ' + pct(PRIME_MAKS, 0) + '">Prime cost</th><th class="n">Laba operasional</th><th class="n">Margin</th><th class="n">Anomali</th></tr></thead><tbody>' +
      (rows.length ? rows.map(r => '<tr class="klik" data-s="' + esc(r.s.kode) + '" title="' + esc(r.s.nama) + '"><td><span class="sw" style="background:' + W[r.s.kode] + '"></span><b>' + esc(r.s.kode) + '</b> <span class="hint">' + esc(r.s.brand) + '</span></td>' +
        '<td>' + statusHtml(r.status) + '</td>' + sel(r.p, r.pp, r.cap, batasFc(r.s.kode), '<td class="n"><span class="badge' + (r.an.some(x => x.level === 'tinggi') ? ' hot' : '') + '">' + r.an.length + '</span></td>') + '</tr>').join('')
        : '<tr><td colspan="10" class="hint">Tidak ada outlet untuk filter ini.</td></tr>') +
      '</tbody><tfoot><tr><td>Total ' + (sc.storeSet ? 'outlet dipilih' : 'semua outlet') + '</td><td></td>' + sel(tot, totP, capTot, batas, '<td class="n">' + st.anomali.length + '</td>') + '</tr></tfoot>';
    $$('#tbPerforma tr.klik').forEach(tr => tr.addEventListener('click', () => pilihOutlet(tr.dataset.s)));

    // per brand
    const brands = [...new Set(stores.map(s => s.brand))];
    $('#tbBrand').innerHTML = '<thead><tr><th>Brand</th><th class="n">Outlet</th><th class="n">Omzet</th><th class="n">Porsi</th><th class="n">Food cost</th><th class="n">Margin</th></tr></thead><tbody>' +
      brands.map(b => {
        const ks = stores.filter(s => s.brand === b).map(s => s.kode);
        const p = hitungPL(x => ks.includes(x), sc.dari, sc.sampai);
        return '<tr><td><b>' + esc(b) + '</b></td><td class="n">' + ks.length + '</td>' + tdJ(p.omz) + '<td class="n">' + pct(tot.omz ? p.omz / tot.omz : null) + '</td>' +
          '<td class="n' + (p.fc > batas ? ' over' : '') + '">' + pct(p.fc) + '</td><td class="n' + (p.adaBiaya && p.margin < 0 ? ' neg' : '') + '">' + (p.adaBiaya ? pct(p.margin) : '–') + '</td></tr>';
      }).join('') + '</tbody>';

    // perlu perhatian
    const top = st.anomali.filter(a => a.level !== 'rendah').slice(0, 4);
    $('#perhatian').innerHTML = top.length ? top.map((a, i) =>
      '<div class="ph"><span class="lvl ' + a.level + '"><i>' + LEVEL[a.level][0] + '</i>' + LEVEL[a.level][1] + '</span><div><div class="t">' + esc(a.judul) + '</div>' +
      '<div class="m">' + esc([a.bulan ? labelBulan(a.bulan) : '', a.dampak ? 'dampak ±' + rpS(a.dampak) : ''].filter(Boolean).join(' · ')) + '</div></div>' +
      (a.grafik ? '<button class="btn outline small" data-ph="' + i + '">Grafik</button>' : '') + '</div>').join('')
      : '<div class="kosong">Tidak ada anomali tinggi/sedang untuk filter ini. 👍</div>';
    $$('#perhatian button[data-ph]').forEach(b => b.addEventListener('click', () => { const a = top[Number(b.dataset.ph)]; bukaGrafik(a.grafik, a); }));

    // tren bulanan
    const trenBulan = bulanGrafik(sc).slice().reverse();
    $('#tbTren').innerHTML = '<thead><tr><th>Bulan</th><th class="n">Omzet</th><th class="n">vs bln lalu</th><th class="n">Belanja bahan</th><th class="n">Food cost</th>' +
      '<th class="n">Karyawan</th><th class="n">Biaya lain</th><th class="n">Laba operasional</th><th class="n">Margin</th><th class="n">Struk</th></tr></thead><tbody>' +
      trenBulan.map(b => {
        const p = plScope(sc, b, b), pPrev = plScope(sc, shiftMonth(b, -1), shiftMonth(b, -1), capBulanLalu(sc, b)), a = agScope(sc, b, b);
        return '<tr><td><b>' + labelBulan(b) + '</b>' + (b === today().slice(0, 7) ? ' <span class="hint">(berjalan)</span>' : '') + '</td>' +
          tdJ(p.omz) + '<td class="n">' + chgHtml(chg(p.omz, pPrev.omz), true) + '</td>' + tdJ(p.hpp) +
          '<td class="n' + (p.fc > batas ? ' over' : '') + '">' + pct(p.fc) + '</td>' + (p.adaBiaya ? tdJ(p.kary) : '<td class="n">–</td>') +
          (p.adaBiaya || p.ops || p.pemb ? tdJ(p.tetap + p.ops + p.pemb) : '<td class="n">–</td>') +
          (p.adaBiaya ? tdJ(p.laba, p.laba < 0 ? 'neg' : '') : '<td class="n">–</td>') +
          '<td class="n"><b>' + (p.adaBiaya ? pct(p.margin) : '–') + '</b></td><td class="n">' + (a.struk ? num(a.struk, 0) : '–') + '</td></tr>';
      }).join('') + '</tbody>';
  }

  /* ================= OUTLET ================= */
  function renderOutlet() {
    const sc = st.scope, D = st.data, W = warnaStore();
    const brand = $('#fBrand').value;
    const list = D.stores.filter(s => !brand || s.brand === brand);
    const blO = bulanGrafik(sc), mulaiO = Math.max(0, blO.indexOf(sc.dari));
    $('#outletGrid').innerHTML = list.map(s => {
      const p = plOutlet(s.kode, sc.dari, sc.sampai), pp = plOutlet(s.kode, sc.prevDari, sc.prevSampai, sc.cap);
      const trenO = blO.map(b => sum(D.omzet.filter(r => r.store === s.kode && r.bulan === b).map(r => r.omzet)) || null);
      const a = agregat(x => x === s.kode, sc.dari, sc.sampai);
      const an = Anomali.deteksi(D, { bulanDari: sc.dari, bulanSampai: sc.sampai, storeSet: new Set([s.kode]), hariIni: today() });
      const stt = statusOutlet(p, an.filter(x => x.level === 'tinggi').length, s.kode), capO = capaianTarget(sc, [s.kode]);
      return '<button class="ocard' + (sc.store === s.kode ? ' on' : '') + '" style="--c:' + W[s.kode] + '" data-s="' + esc(s.kode) + '">' +
        '<div class="on1">' + esc(s.kode) + ' · ' + esc(s.nama.replace(s.brand + ' - ', '')) + '</div>' +
        '<div class="oh"><span class="on2">' + esc(s.brand) + '</span>' + statusHtml(stt) + '</div>' +
        '<div class="obig"><div class="lbl">Omzet</div><div class="ov"><b>' + rpS(p.omz) + '</b><small>' + chgHtml(chg(p.omz, pp.omz), true) + '</small></div>' +
          sparkSvg(trenO, mulaiO, { warna: W[s.kode], cls: 'ospark', h: 30, label: 'Omzet ' + s.kode + ' per bulan' }) +
          (capO ? '<div class="otarget" title="Target omzet periode ini ' + rp(capO.target) + '">' + capHtml(capO.capaian) + '<span class="hint">target ' + rpS(capO.target) + '</span></div>' : '') + '</div>' +
        '<div class="om"><div><span>Margin</span><b class="' + (p.adaBiaya && p.margin < 0 ? 'neg' : '') + '">' + (p.adaBiaya ? pct(p.margin) : '–') + '</b></div>' +
        '<div><span>Food cost</span><b class="' + (p.fc > batasFc(s.kode) ? 'over' : '') + '">' + pct(p.fc) + '</b></div>' +
        '<div><span>Anomali</span><b>' + an.length + '</b>' + (an.some(x => x.level === 'tinggi') ? '<small class="up">▲</small>' : '') + '</div></div></button>';
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
      miniKpiOutlet(s, p, sc) +
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
    const harianO = tgl.map(t => sum(og.get(t).map(r => r.omzet)));
    gambar('chOHarian', 'line', tgl.map(labelTgl), [
      { label: 'Omzet harian', data: harianO, borderColor: W[s.kode], backgroundColor: alpha(W[s.kode], 0.1), fill: 'origin' },
      { label: 'Rata-rata 7 hari', data: rata7(harianO), borderColor: css('--ink-2'), backgroundColor: css('--ink-2'), borderWidth: 1.5 }
    ], { tanpaTitik: true });
    // margin & fc per bulan
    const bl = bulanGrafik(sc);
    const pb = bl.map(b => plOutlet(s.kode, b, b));
    gambar('chOBulan', 'line', bl.map(labelBulan), [
      { label: 'Margin operasional', data: pb.map(x => x.adaBiaya ? x.margin : null), borderColor: css('--s1'), backgroundColor: css('--s1') },
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
        tim.sort((x, y) => y.jumlah - x.jumlah).map(r => '<tr><td>' + esc(r.kategori) + '</td><td class="n">' + (r.orang || '–') + '</td>' + tdJ(r.jumlah) + '<td class="n">' + pct(omzBln ? r.jumlah / omzBln : null) + '</td></tr>').join('') +
        '</tbody><tfoot><tr><td>Total</td><td class="n">' + (sum(tim.map(r => r.orang)) || '–') + '</td>' + tdJ(sum(tim.map(r => r.jumlah))) + '<td class="n">' + pct(omzBln ? sum(tim.map(r => r.jumlah)) / omzBln : null) + '</td></tr></tfoot>'
      : '<tbody><tr><td class="hint">Belum ada data karyawan untuk outlet ini (isi MASTER_KARYAWAN).</td></tr></tbody>';
    // bahan
    const gb = [...groupBy(a.B, r => r.bahan).entries()].map(([b, rs]) => ({ b, sat: rs[0].satuan, qty: sum(rs.map(r => r.qty)), tot: sum(rs.map(r => r.total)) }))
      .sort((x, y) => y.tot - x.tot).slice(0, 10);
    $('#tbOBahan').innerHTML = '<thead><tr><th>Bahan</th><th class="n">Qty</th><th class="n">Belanja</th><th class="n">% omzet</th><th class="n">Harga rata²</th></tr></thead><tbody>' +
      (gb.length ? gb.map(x => '<tr class="klik" data-b="' + esc(x.b) + '"><td>' + esc(x.b) + '</td><td class="n">' + num(x.qty) + ' ' + esc(x.sat) + '</td>' + tdJ(x.tot) + '<td class="n">' + pct(p.omz ? x.tot / p.omz : null) + '</td><td class="n">' + rp(x.qty ? x.tot / x.qty : 0) + '</td></tr>').join('')
        : '<tr><td colspan="5" class="hint">Belum ada belanja.</td></tr>') + '</tbody>';
    $$('#tbOBahan tr.klik').forEach(tr => tr.addEventListener('click', () => bukaGrafik({ tipe: 'harga', bahan: tr.dataset.b, store: s.kode })));
    // anomali
    const an = st.anomali.filter(x => x.store === s.kode || (x.jenis === 'harga-pasar' && x.detail.includes(s.kode)));
    $('#oAnomali').innerHTML = an.length ? '<div class="an-list one">' + an.map((x, i) => kartuAnomali(x, 'o' + i)).join('') + '</div>' : '<div class="kosong">Tidak ada anomali. 👍</div>';
    pasangGrafikAnomali('#oAnomali', an, 'o');
  }

  function miniKpiOutlet(s, p, sc) {
    const cap = capaianTarget(sc, [s.kode]), imp = titikImpas(k => k === s.kode, sc), mT = targetMargin(s.kode);
    const kemarin = hariSebelum(today()), mg = geserHari(kemarin, -7);
    const om = t => { const r = st.data.omzet.filter(x => x.store === s.kode && x.tgl === t); return r.length ? sum(r.map(x => x.omzet)) : null; };
    const vK = om(kemarin), vM = om(mg);
    const kas = adaKas() && bukuKas(s.kode).mulai ? bukuKas(s.kode).saldo(batasHariIni(akhirBulan(sc.sampai))) : null;
    const m = (l, v, d, cls) => '<div class="mk"><span>' + l + '</span><b class="' + (cls || '') + '">' + v + '</b><small>' + d + '</small></div>';
    return '<div class="mini-kpis card">' +
      m('Omzet periode', rpS(p.omz), cap ? capHtml(cap.capaian) + ' target' : 'target belum diisi') +
      m('Margin operasional', p.adaBiaya ? pct(p.margin) : '–', 'target ' + pct(mT, 0), p.adaBiaya && p.margin < mT ? (p.margin < 0 ? 'neg' : 'over') : '') +
      m('Prime cost', pct(p.prime), 'bahan ' + pct(p.fc) + ' + karyawan ' + pct(p.karyPct), p.prime > PRIME_MAKS ? 'over' : '') +
      m('Titik impas / hari', imp ? rpS(imp.impasHari) : '–', imp ? 'omzet ' + rpS(imp.omzHari) + '/hari · ' + jarakHtml(imp.jarak) : 'isi biaya dulu') +
      m('Kemarin', vK != null ? rpS(vK) : '–', vK != null ? chgHtml(chg(vK, vM), true) + ' vs ' + NAMA_HARI[hariKe(mg)] + ' lalu' : '<span class="st perhatian"><i>!</i>belum input</span>') +
      m('Saldo kas', kas != null ? rpS(kas) : '–', kas != null ? 'per ' + labelTgl(batasHariIni(akhirBulan(sc.sampai))) : 'isi SALDO_AWAL_KAS', kas < 0 ? 'neg' : '') +
      '</div>';
  }

  function tabelPL(p) {
    if (!p.omz) return '<tbody><tr><td class="hint">Belum ada omzet pada periode ini.</td></tr></tbody>';
    const b = (l, v, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + l + '</td>' + tdJ(v, cls === 'laba' && v < 0 ? 'neg' : v < 0 ? 'biaya' : '') + '<td class="n' + (v < 0 ? ' biaya' : '') + '">' + pct(v / p.omz) + '</td></tr>';
    return '<thead><tr><th>Pos</th><th class="n">Rupiah</th><th class="n">% omzet</th></tr></thead><tbody>' +
      b('Omzet', p.omz) + b('− HPP bahan baku', -p.hpp) + b('<b>Laba kotor</b>', p.lk, 'laba') +
      (p.adaBiaya ? b('− Karyawan', -p.kary) + b('− Biaya tetap (sewa, dll)', -p.tetap) + b('− Biaya bulanan (listrik, dll)', -p.ops) : '') +
      (p.pemb ? b('− Pembelian lain (non-bahan)', -p.pemb) : '') +
      '</tbody><tfoot><tr><td>Laba operasional</td>' + (p.adaBiaya ? tdJ(p.laba, p.laba < 0 ? 'neg' : '') : '<td class="n">–</td>') + '<td class="n' + (p.margin < 0 ? ' neg' : '') + '">' + (p.adaBiaya ? pct(p.margin) : 'isi biaya') + '</td></tr></tfoot>';
  }

  /* ================= PENJUALAN ================= */
  function renderPenjualan() {
    const sc = st.scope, D = st.data, W = warnaStore();
    const stores = D.stores.filter(s => inStore(sc, s.kode));
    const a = agScope(sc, sc.dari, sc.sampai);
    const tgl = [...new Set(a.O.map(r => r.tgl))].sort();
    const tampil = stores.slice(0, 8);
    const ogT = groupBy(a.O, r => r.tgl), harian = tgl.map(t => sum(ogT.get(t).map(r => r.omzet)));
    const w1 = css('--s1');
    gambar('chHarian', 'line', tgl.map(labelTgl), [
      { label: 'Omzet harian', data: harian, borderColor: w1, backgroundColor: alpha(w1, 0.1), fill: 'origin' },
      { label: 'Rata-rata 7 hari', data: rata7(harian), borderColor: css('--s2'), backgroundColor: css('--s2') }
    ], { tanpaTitik: true });
    $('#harianNote').textContent = tgl.length ? (sc.store ? sc.store : sc.storeSet ? 'gabungan outlet dipilih' : 'gabungan semua outlet') + ' · ' + tgl.length + ' hari tercatat · perbandingan per outlet di tabel bawah' : 'belum ada omzet';

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

    // pola ramai: indeks omzet rata-rata tiap hari dalam minggu vs rata-rata harian outlet itu (100 = rata-rata)
    const urutH = [1, 2, 3, 4, 5, 6, 0], dalam = new Set(stores.map(s => s.kode));
    const perSH = groupBy(a.O.filter(r => dalam.has(r.store)), r => r.store);
    const hm = stores.map(s => {
      const rs = perSH.get(s.kode) || [], perTgl = groupBy(rs, r => r.tgl), perH = [0, 1, 2, 3, 4, 5, 6].map(() => []);
      perTgl.forEach((x, t) => perH[new Date(t + 'T00:00:00Z').getUTCDay()].push(sum(x.map(y => y.omzet))));
      const rataH = perH.map(v => v.length ? sum(v) / v.length : null), ada = rataH.filter(v => v != null), rata = ada.length ? sum(ada) / ada.length : 0;
      return { s, sel: urutH.map(h => rataH[h] == null ? null : { v: rataH[h], idx: rata ? rataH[h] / rata : null }) };
    }).filter(r => r.sel.some(x => x));
    const warnaSel = idx => {
      if (idx == null) return '';
      const kuat = Math.min(1, Math.abs(idx - 1) / 0.3), mix = Math.round(kuat * 78);
      return 'background:color-mix(in oklab,var(' + (idx >= 1 ? '--s2' : '--s1') + ') ' + mix + '%,var(--surface-2));color:' + (mix > 50 ? '#fff' : 'var(--ink)');
    };
    $('#tbHeat').innerHTML = '<thead><tr><th>Outlet</th>' + urutH.map(h => '<th class="n">' + NAMA_HARI[h] + '</th>').join('') + '</tr></thead><tbody>' +
      hm.map(r => '<tr><td><span class="sw" style="background:' + W[r.s.kode] + '"></span><b>' + esc(r.s.kode) + '</b></td>' +
        r.sel.map((c, i) => c ? '<td class="n heat" style="' + warnaSel(c.idx) + '" title="' + esc(r.s.kode) + ' · ' + NAMA_HARI[urutH[i]] + ': rata-rata ' + rp(c.v) + '">' + Math.round(c.idx * 100) + '</td>' : '<td class="n hint">–</td>').join('') + '</tr>').join('') + '</tbody>';

    const rows = stores.map(s => {
      const x = agregat(k => k === s.kode, sc.dari, sc.sampai), xp = agregat(k => k === s.kode, sc.prevDari, sc.prevSampai, sc.cap);
      const hari = groupBy(x.O, r => r.tgl);
      let best = null; hari.forEach((rs, t) => { const v = sum(rs.map(r => r.omzet)); if (!best || v > best[1]) best = [t, v]; });
      return { s, x, xp, nHari: hari.size, best };
    }).sort((p, q) => q.x.omz - p.x.omz);
    $('#tbPenjualan').innerHTML = '<thead><tr><th>Outlet</th><th class="n">Omzet</th><th class="n">vs sblm</th><th class="n">Porsi</th><th class="n">Hari</th><th class="n">Rata²/hari</th>' +
      '<th class="n">Struk</th><th class="n">Per struk</th><th class="n">Hari terbaik</th></tr></thead><tbody>' +
      rows.map(r => '<tr class="klik" data-s="' + esc(r.s.kode) + '"><td><span class="sw" style="background:' + W[r.s.kode] + '"></span><b>' + esc(r.s.kode) + '</b> ' + esc(r.s.nama) + '</td>' +
        tdJ(r.x.omz) + '<td class="n">' + chgHtml(chg(r.x.omz, r.xp.omz), true) + '</td><td class="n">' + pct(a.omz ? r.x.omz / a.omz : null) + '</td>' +
        '<td class="n">' + r.nHari + '</td><td class="n">' + rpS(r.nHari ? r.x.omz / r.nHari : 0) + '</td><td class="n">' + (r.x.struk ? num(r.x.struk, 0) : '–') + '</td>' +
        '<td class="n">' + (r.x.ticket ? rpS(r.x.ticket) : '–') + '</td><td class="n">' + (r.best ? labelTgl(r.best[0]) + ' · ' + rpS(r.best[1]) : '–') + '</td></tr>').join('') +
      '</tbody><tfoot><tr><td>Total</td>' + tdJ(a.omz) + '<td class="n">' + chgHtml(chg(a.omz, agScope(sc, sc.prevDari, sc.prevSampai, sc.cap).omz), true) + '</td><td class="n">100%</td>' +
      '<td class="n">' + tgl.length + '</td><td class="n">' + rpS(tgl.length ? a.omz / tgl.length : 0) + '</td><td class="n">' + (a.struk ? num(a.struk, 0) : '–') + '</td><td class="n">' + (a.ticket ? rpS(a.ticket) : '–') + '</td><td></td></tr></tfoot>';
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
    const td = (v, neg) => v == null ? '<td class="n">–</td>' : tdJ(v, neg && v < 0 ? 'neg' : '');
    const tdp = (v, neg) => '<td class="n' + (neg && v < 0 ? ' neg' : '') + '">' + pct(v) + '</td>';
    const baris = (r, label) => '<td>' + label + '</td>' + td(r.omz) + td(r.hpp) + td(r.lk, true) +
      td(r.kary) + td(r.tetap) + td(r.ops) + td(r.pemb) + td(r.adaBiaya ? r.laba : null, true) + '<td class="n' + (r.adaBiaya && r.margin < 0 ? ' neg' : '') + '"><b>' + (r.adaBiaya ? pct(r.margin) : '–') + '</b></td>';
    $('#tbProfit').innerHTML = '<thead><tr><th>Outlet</th><th class="n">Omzet</th><th class="n">HPP bahan</th><th class="n">Laba kotor</th>' +
      '<th class="n">Karyawan</th><th class="n">Biaya tetap</th><th class="n">Biaya bulanan</th><th class="n">Pembelian lain</th><th class="n">Laba operasional</th><th class="n">Margin</th></tr></thead><tbody>' +
      rows.map(r => '<tr class="klik" data-s="' + esc(r.s.kode) + '">' + baris(r, '<span class="sw" style="background:' + W[r.s.kode] + '"></span><b>' + esc(r.s.kode) + '</b>') + '</tr>').join('') +
      '</tbody><tfoot><tr>' + baris(total, 'Total ' + (sc.storeSet ? 'outlet dipilih' : 'semua outlet')) + '</tr></tfoot>';
    $$('#tbProfit tr.klik').forEach(tr => tr.addEventListener('click', () => bukaRincian(tr.dataset.s)));
    renderImpas();

    // biaya per pos (gabungan outlet terpilih)
    const pos = [['HPP bahan baku', 'Bahan', total.hpp]];
    const LBL = { Karyawan: 'Karyawan', Tetap: 'Tetap', Operasional: 'Bulanan', Pembelian: 'Pembelian lain' };
    ['Karyawan', 'Tetap', 'Operasional', 'Pembelian'].forEach(k => {
      groupBy(total.by.filter(r => r.kelompok === k), r => r.kategori).forEach((rs, kat) => pos.push([kat, LBL[k], sum(rs.map(r => r.jumlah))]));
    });
    pos.sort((x, y) => y[2] - x[2]);
    $('#tbPos').innerHTML = '<thead><tr><th>Pos biaya</th><th>Kelompok</th><th class="n">Rupiah</th><th class="n">% omzet</th></tr></thead><tbody>' +
      pos.map(x => '<tr><td>' + esc(x[0]) + '</td><td class="hint">' + x[1] + '</td>' + tdJ(x[2]) + '<td class="n">' + pct(total.omz ? x[2] / total.omz : null) + '</td></tr>').join('') +
      '</tbody><tfoot><tr><td>Total biaya</td><td></td>' + tdJ(sum(pos.map(x => x[2]))) + '<td class="n">' + pct(total.omz ? sum(pos.map(x => x[2])) / total.omz : null) + '</td></tr></tfoot>';
  }

  function renderImpas() {
    const sc = st.scope, D = st.data, W = warnaStore();
    const rows = D.stores.filter(s => inStore(sc, s.kode)).map(s => ({ s, t: titikImpas(k => k === s.kode, sc) })).filter(r => r.t);
    $('#impasKartu').classList.toggle('hidden', !rows.length);
    if (!rows.length) return;
    rows.sort((a, b) => a.t.jarak - b.t.jarak);
    gambar('chImpas', 'bar', rows.map(r => r.s.kode), [
      { label: 'Omzet rata-rata / hari', data: rows.map(r => r.t.omzHari), backgroundColor: css('--s1') },
      { label: 'Titik impas / hari', data: rows.map(r => r.t.impasHari), backgroundColor: css('--axis') }
    ], { horizontal: true });
    const tot = titikImpas(k => inStore(sc, k), sc);
    const baris = (label, t) => '<td>' + label + '</td>' + '<td class="n">' + rpS(t.omzHari) + '</td><td class="n">' + rpS(t.impasHari) + '</td><td class="n">' + jarakHtml(t.jarak) + '</td><td class="n">' + pct(t.rasioVar, 0) + '</td>';
    $('#tbImpas').innerHTML = '<thead><tr><th>Outlet</th><th class="n">Omzet / hari</th><th class="n">Impas / hari</th><th class="n" title="seberapa jauh omzet di atas titik impas">Jarak aman</th><th class="n" title="bahan + pembelian lain + komisi ojol, % omzet">Biaya variabel</th></tr></thead><tbody>' +
      rows.map(r => '<tr class="klik" data-s="' + esc(r.s.kode) + '">' + baris('<span class="sw" style="background:' + W[r.s.kode] + '"></span><b>' + esc(r.s.kode) + '</b>', r.t) + '</tr>').join('') + '</tbody>' +
      (tot ? '<tfoot><tr>' + baris('Total', tot) + '</tr></tfoot>' : '');
    $$('#tbImpas tr.klik').forEach(tr => tr.addEventListener('click', () => pilihOutlet(tr.dataset.s)));
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

  /* ================= KAS ================= */
  function renderKas() {
    const sc = st.scope, D = st.data, W = warnaStore();
    const stores = D.stores.filter(s => inStore(sc, s.kode)), kodes = stores.map(s => s.kode);
    const kosong = !adaKas();
    $('#kasKosong').classList.toggle('hidden', !kosong);
    if (kosong) { ['#tbArus', '#tbKas', '#tbMutasi'].forEach(id => { $(id).innerHTML = ''; }); return; }
    const bulanIni = today().slice(0, 7);
    const bl = sc.bulan.filter(b => b + '-01' <= today()), ar = bl.map(b => arusBulan(kodes, b)); // persis periode filter, sama dengan KPI
    const lblB = b => labelBulan(b) + (b === bulanIni ? '*' : '');

    // 1) masuk vs keluar per bulan + arus bersih
    gambar('chArus', 'bar', bl.map(lblB), [
      { label: 'Kas masuk', data: ar.map(r => r.masuk), backgroundColor: css('--s1') },
      { label: 'Kas keluar', data: ar.map(r => r.keluar), backgroundColor: css('--s2') },
      { type: 'line', label: 'Arus kas bersih', data: ar.map(r => r.bersih), borderColor: css('--ink-2'), backgroundColor: css('--ink-2') }
    ], {});
    $('#arusNote').textContent = (sc.store ? sc.store : sc.storeSet ? stores.length + ' outlet dipilih' : 'semua cabang') + (bl.includes(bulanIni) ? ' · * bulan berjalan: gaji, sewa & tagihan belum dibayar' : '');

    // 2) laporan arus kas (baris = pos, kolom = bulan)
    const tot = { omzet: 0, masukLain: 0, bahan: 0, pembelian: 0, gaji: 0, tetap: 0, tagihan: 0, keluarLain: 0, masuk: 0, keluar: 0, bersih: 0 };
    ar.forEach(r => Object.keys(tot).forEach(k => { tot[k] += r[k]; }));
    tot.awal = ar.length ? ar[0].awal : 0; tot.akhir = ar.length ? ar[ar.length - 1].akhir : 0;
    const kol = ar.concat([tot]);
    const sel = (v, cls) => '<td class="n' + (cls ? ' ' + cls : '') + '" title="' + rp(v) + '">' + (v ? rpJ(v) : '–') + '</td>';
    const baris = (label, f, cls, rowCls) => '<tr' + (rowCls ? ' class="' + rowCls + '"' : '') + '><td>' + label + '</td>' + kol.map((r, i) => sel(f(r), typeof cls === 'function' ? cls(f(r), i) : cls)).join('') + '</tr>';
    const judul = t => '<tr class="grp"><td colspan="' + (kol.length + 1) + '">' + t + '</td></tr>';
    const neg = v => v < 0 ? 'neg' : '';
    const adaMasukLain = tot.masukLain > 0, adaKeluarLain = tot.keluarLain > 0, pending = ar.find(r => r.berjalan);
    $('#tbArus').innerHTML = '<thead><tr><th>Pos</th>' + bl.map(b => '<th class="n">' + lblB(b) + '</th>').join('') + '<th class="n">Total</th></tr></thead><tbody>' +
      baris('<b>Saldo awal</b>', r => r.awal, neg, 'saldo') +
      judul('Kas masuk') +
      baris('Omzet penjualan', r => r.omzet) +
      (adaMasukLain ? baris('Tambahan modal &amp; mutasi masuk', r => r.masukLain) : '') +
      baris('<b>Total kas masuk</b>', r => r.masuk, '', 'subtot') +
      judul('Kas keluar') +
      baris('Belanja bahan baku', r => r.bahan, 'biaya') +
      baris('Pembelian non-bahan', r => r.pembelian, 'biaya') +
      baris('Gaji karyawan', r => r.gaji, 'biaya') +
      baris('Sewa &amp; biaya tetap', r => r.tetap, 'biaya') +
      baris('Tagihan (listrik, air, dll)', r => r.tagihan, 'biaya') +
      (adaKeluarLain ? baris('Setoran ke HO &amp; mutasi keluar', r => r.keluarLain, 'biaya') : '') +
      baris('<b>Total kas keluar</b>', r => r.keluar, 'biaya', 'subtot') +
      baris('<b>Arus kas bersih</b>', r => r.bersih, v => v < 0 ? 'neg' : 'pos', 'net') +
      baris('<b>Saldo akhir</b>', r => r.akhir, neg, 'saldo') +
      (pending ? baris('<span class="hint">Belum dibayar bulan ini (gaji, sewa, tagihan)</span>', r => r === tot ? pending.tertunda : r.tertunda, 'biaya') +
        baris('<span class="hint">Saldo akhir setelah dibayar</span>', r => r === tot ? tot.akhir - pending.tertunda : r.berjalan ? r.akhir - r.tertunda : r.akhir, neg) : '') +
      '</tbody>';

    // 3) saldo kas harian per cabang
    const tAkhir = batasHariIni(akhirBulan(sc.sampai)), tAwal = hariSebelum(sc.dari + '-01');
    const hari = []; for (let d = new Date(sc.dari + '-01T00:00:00Z'); d.toISOString().slice(0, 10) <= tAkhir; d.setUTCDate(d.getUTCDate() + 1)) hari.push(d.toISOString().slice(0, 10));
    gambar('chKas', 'line', hari.map(labelTgl), stores.slice(0, 8).map(s => {
      const bk = bukuKas(s.kode);
      return { label: s.kode, borderColor: W[s.kode], backgroundColor: W[s.kode], data: hari.map(t => bk.mulai && t >= bk.mulai ? bk.saldo(t) : null) };
    }).concat([{ label: 'Nol', data: hari.map(() => 0), borderColor: css('--muted'), borderDash: [6, 4] }]), { tanpaTitik: true });

    // 4) ringkasan per cabang (periode filter)
    const rows = stores.map(s => {
      const r = { s, awal: 0, akhir: 0, masuk: 0, keluar: 0, bersih: 0, tertunda: 0 };
      sc.bulan.filter(b => b + '-01' <= today()).forEach((b, i, arr) => {
        const a = arusBulan([s.kode], b);
        if (i === 0) r.awal = a.awal;
        if (i === arr.length - 1) { r.akhir = a.akhir; r.tertunda = a.tertunda; }
        r.masuk += a.masuk; r.keluar += a.keluar; r.bersih += a.bersih;
      });
      return r;
    }).sort((a, b) => b.bersih - a.bersih);
    const t2 = { awal: 0, akhir: 0, masuk: 0, keluar: 0, bersih: 0, tertunda: 0 };
    rows.forEach(r => Object.keys(t2).forEach(k => { t2[k] += r[k]; }));
    const sel2 = r => tdJ(r.awal, neg(r.awal)) + tdJ(r.masuk) + tdJ(-r.keluar, 'biaya') +
      '<td class="n ' + (r.bersih < 0 ? 'neg' : 'pos') + '" title="' + rp(r.bersih) + '"><b>' + (r.bersih >= 0 ? '+' : '') + rpJ(r.bersih) + '</b></td>' +
      tdJ(r.akhir, neg(r.akhir)) + (t2.tertunda ? tdJ(r.akhir - r.tertunda, neg(r.akhir - r.tertunda)) : '');
    $('#tbKas').innerHTML = '<thead><tr><th>Cabang</th><th class="n">Saldo awal</th><th class="n">Kas masuk</th><th class="n">Kas keluar</th><th class="n">Arus bersih</th><th class="n">Saldo akhir</th>' +
      (t2.tertunda ? '<th class="n">Setelah gaji/sewa bln ini</th>' : '') + '</tr></thead><tbody>' +
      rows.map(r => '<tr class="klik" data-s="' + esc(r.s.kode) + '"><td><span class="sw" style="background:' + W[r.s.kode] + '"></span><b>' + esc(r.s.kode) + '</b> <span class="hint">' + esc(r.s.brand) + '</span></td>' + sel2(r) + '</tr>').join('') +
      '</tbody><tfoot><tr><td>Total</td>' + sel2(t2) + '</tr></tfoot>';
    $$('#tbKas tr.klik').forEach(tr => tr.addEventListener('click', () => pilihOutlet(tr.dataset.s)));
    $('#kasBerjalan').textContent = 'Basis kas: uang benar-benar masuk/keluar. Gaji, sewa & tagihan dicatat keluar di akhir bulan. Semua pengeluaran outlet mengurangi kas outlet, siapa pun yang membayar.';

    // 5) saldo awal & mutasi manual
    const mut = (D.kasAwal || []).filter(r => inStore(sc, r.store)).map(r => ({ tgl: r.tgl, store: r.store, jenis: 'Saldo awal', ket: '', v: r.jumlah }))
      .concat((D.mutasiKas || []).filter(r => inStore(sc, r.store)).map(r => { const a = arahMutasi(r.jenis); return { tgl: r.tgl, store: r.store, jenis: r.jenis, ket: r.ket, v: a ? a * Math.abs(r.jumlah) : r.jumlah }; }))
      .sort((a, b) => a.tgl < b.tgl ? 1 : -1);
    $('#tbMutasi').innerHTML = '<thead><tr><th>Tanggal</th><th>Outlet</th><th>Jenis</th><th class="n">Jumlah</th></tr></thead><tbody>' +
      mut.slice(0, 50).map(m => '<tr><td>' + esc(m.tgl) + '</td><td>' + esc(m.store) + '</td><td>' + esc(m.jenis) + (m.ket ? ' <span class="hint">· ' + esc(m.ket) + '</span>' : '') + '</td>' + tdJ(m.v, m.v < 0 ? 'biaya' : '') + '</tr>').join('') + '</tbody>';
  }

  /* ================= BELANJA & BAHAN ================= */
  $('#qItem').addEventListener('input', e => { st.q = e.target.value.toLowerCase(); renderItemTabel(); });
  $('#qLog').addEventListener('input', e => { st.qLog = e.target.value.toLowerCase(); st.logLimit = 100; renderLog(); });
  $('#btnLogMore').addEventListener('click', () => { st.logLimit += 200; renderLog(); });

  function renderBahan() {
    const sc = st.scope, D = st.data, W = warnaStore();
    const a = agScope(sc, sc.dari, sc.sampai);
    const kat = [...groupBy(a.B, r => r.kategori).entries()].map(([k, rs]) => [k, sum(rs.map(r => r.total))]).sort((x, y) => y[1] - x[1]);
    gambar('chKategori', 'bar', kat.map(x => x[0]), [{ label: '% omzet', data: kat.map(x => a.omz ? x[1] / a.omz : null), backgroundColor: css('--s1'), borderColor: css('--s1') }], { persen: true, horizontal: true });

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
    const cur = (D.pembelian || []).filter(r => inR(r, sc.dari, sc.sampai)), prev = (D.pembelian || []).filter(r => inR(r, sc.prevDari, sc.prevSampai) && (!sc.cap || r.tgl <= sc.cap));
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
    const prev = st.data.belanja.filter(r => r.bulan >= sc.prevDari && r.bulan <= sc.prevSampai && inStore(sc, r.store) && (!sc.cap || r.tgl <= sc.cap));
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
        '<td class="n">' + num(r.qty) + ' ' + esc(r.sat) + '</td>' + tdJ(r.tot) + '<td class="n">' + pct(total ? r.tot / total : 0) + '</td>' +
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
      (a.grafik ? '<button class="btn outline small" data-g="' + id + '">Lihat grafik</button>' : '') + '</div></article>';
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
  /* Gaya grafik (spesifikasi dataviz): batang ≤24px ujung membulat 4px, celah 2px warna permukaan antar segmen,
     garis 2px, titik ≥8px bercincin permukaan, grid garis rambut solid, legenda selalu ada untuk ≥2 seri,
     tooltip: nilai dulu baru label, kunci berupa garis, crosshair vertikal di grafik garis. */
  let chartSiap = false;
  function siapkanChart() {
    if (chartSiap || typeof Chart === 'undefined') return;
    chartSiap = true;
    Chart.defaults.font.family = css('--font') || 'system-ui, sans-serif';
    Chart.defaults.font.size = 11.5;
    Chart.register({
      id: 'crosshair',
      beforeDatasetsDraw(chart) {
        if (chart.config.type !== 'line' || !chart.tooltip) return;
        const act = chart.tooltip.getActiveElements();
        if (!act.length) return;
        const x = act[0].element.x, a = chart.chartArea, ctx = chart.ctx;
        ctx.save(); ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, a.top); ctx.lineTo(Math.round(x) + 0.5, a.bottom);
        ctx.lineWidth = 1; ctx.strokeStyle = css('--axis'); ctx.stroke(); ctx.restore();
      }
    });
  }

  function gambar(id, tipe, labels, datasets, o) {
    o = o || {};
    siapkanChart();
    const el = document.getElementById(id);
    if (!el) return;
    if (st.charts[id]) st.charts[id].destroy();
    const surface = css('--surface'), grid = css('--grid'), muted = css('--muted'), ink = css('--ink'), ink2 = css('--ink-2'), axis = css('--axis'), line2 = css('--line-2');
    const fmt = v => v == null ? '–' : o.persen ? pct(v) : o.satuan ? rp(v) + '/' + o.satuan : o.qty ? num(v) + ' ' + (o.unit || '') : rp(v);
    const rapat = labels.length > 16;
    const ref = d => !!d.borderDash; // garis acuan (batas/impas)
    datasets.forEach((d, i) => {
      if (tipe === 'line') {
        Object.assign(d, Object.assign({
          borderWidth: 2, tension: 0, fill: false, borderCapStyle: 'round', borderJoinStyle: 'round', spanGaps: true,
          pointRadius: ref(d) || o.tanpaTitik || rapat ? 0 : 4, pointBorderWidth: 2, pointBorderColor: surface,
          pointHoverRadius: ref(d) ? 0 : 5, pointHoverBorderWidth: 2, pointHoverBorderColor: surface, pointHitRadius: 14
        }, d));
        if (ref(d)) { d.borderWidth = 1.5; d.borderDash = [5, 4]; }
      }
      if (tipe === 'bar' && d.type === 'line') {
        Object.assign(d, Object.assign({ borderWidth: 2, tension: 0, fill: false, pointRadius: 4, pointBorderWidth: 2, pointBorderColor: surface,
          pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: surface, pointHitRadius: 14, order: -1 }, d));
        return;
      }
      if (tipe === 'bar') {
        const atas = !o.stacked || i === datasets.length - 1;
        Object.assign(d, Object.assign({ maxBarThickness: 24, borderSkipped: 'start' }, d));
        d.borderColor = surface;
        d.borderRadius = atas ? (o.stacked ? { topLeft: 4, topRight: 4 } : 4) : 0;
        d.borderWidth = o.stacked && !atas ? { top: 2, right: 0, bottom: 0, left: 0 } : 0;
        d.hoverBackgroundColor = d.backgroundColor;
      }
    });
    const kunci = c => { const w = tipe === 'bar' && c.dataset.type !== 'line' ? c.dataset.backgroundColor : c.dataset.borderColor; return { borderColor: w, backgroundColor: w, borderWidth: 2, borderDash: c.dataset.borderDash }; };
    const nilaiDari = c => o.horizontal ? c.parsed.x : c.parsed.y;
    st.charts[id] = new Chart(el, {
      type: tipe, data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        indexAxis: o.horizontal ? 'y' : 'x',
        layout: { padding: { top: 4, right: 6 } },
        plugins: {
          legend: {
            display: datasets.length > 1, position: 'top', align: 'start',
            labels: { usePointStyle: true, pointStyle: tipe === 'line' ? 'line' : 'rectRounded', boxWidth: tipe === 'line' ? 18 : 9, boxHeight: 9,
              color: ink2, padding: 14, font: { size: 11.5, weight: '500' },
              // kunci legenda ikut warna seri (bukan warna cincin titik)
              generateLabels: ch => Chart.defaults.plugins.legend.labels.generateLabels(ch).map(l => {
                const d = ch.data.datasets[l.datasetIndex], garis = tipe === 'line' || d.type === 'line', w = garis ? d.borderColor : d.backgroundColor;
                return Object.assign(l, { fillStyle: w, strokeStyle: w, lineWidth: garis ? 2 : 0, lineDash: d.borderDash || [], pointStyle: garis ? 'line' : 'rectRounded' });
              }) }
          },
          tooltip: {
            backgroundColor: surface, titleColor: muted, bodyColor: ink, footerColor: ink2, borderColor: line2, borderWidth: 1,
            padding: { x: 12, y: 10 }, cornerRadius: 10, caretSize: 0, caretPadding: 10, boxPadding: 6, usePointStyle: true,
            titleFont: { size: 11.5, weight: '600' }, bodyFont: { size: 12.5, weight: '600' }, footerFont: { size: 12, weight: '700' },
            titleMarginBottom: 8, bodySpacing: 5,
            filter: c => !ref(c.dataset) && nilaiDari(c) != null,
            itemSort: (a, b) => (nilaiDari(b) || 0) - (nilaiDari(a) || 0),
            callbacks: {
              label: c => ' ' + fmt(nilaiDari(c)) + '   ' + c.dataset.label,
              labelColor: kunci,
              labelPointStyle: () => ({ pointStyle: 'line', rotation: 0 }),
              footer: o.stacked ? items => 'Total ' + fmt(sum(items.map(i => nilaiDari(i) || 0))) : undefined
            }
          }
        },
        scales: (() => {
          const kat = { stacked: !!o.stacked, grid: { display: false }, border: { color: axis },
            ticks: { color: o.horizontal ? ink2 : muted, maxRotation: 0, autoSkip: !o.horizontal, autoSkipPadding: 14, padding: 6, font: { size: o.horizontal ? 12 : 11.5 } } };
          const nilai = { stacked: !!o.stacked, beginAtZero: tipe === 'bar' || (!o.persen && !o.satuan), grid: { color: grid, drawTicks: false }, border: { display: false },
            ticks: { color: muted, padding: 8, maxTicksLimit: 6, callback: v => o.persen ? pct(v, 0) : rpS(v).replace('Rp', o.qty ? '' : 'Rp') } };
          return o.horizontal ? { x: nilai, y: kat } : { x: kat, y: nilai };
        })()
      }
    });
    st.fmtGrafik = st.fmtGrafik || {}; st.fmtGrafik[id] = fmt;
    pasangTabel(el, id);
  }

  /* Tiap grafik punya tombol "Tabel": angka persisnya bisa dibaca / disalin tanpa hover (juga untuk pembaca layar). */
  st.tabelOn = new Set();
  function pasangTabel(el, id) {
    const card = el.closest('.card');
    if (!card || id === 'chDetail') return;
    const head = card.querySelector('.card-head');
    if (!head) return;
    let btn = head.querySelector('.tv-btn[data-c="' + id + '"]');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn ghost small tv-btn'; btn.dataset.c = id; btn.textContent = 'Tabel';
      btn.addEventListener('click', () => { st.tabelOn.has(id) ? st.tabelOn.delete(id) : st.tabelOn.add(id); isiTabelGrafik(el, id); });
      head.appendChild(btn);
    }
    isiTabelGrafik(el, id);
  }
  function isiTabelGrafik(el, id) {
    const box = el.closest('.chart-box'), on = st.tabelOn.has(id), ch = st.charts[id];
    let tv = box.nextElementSibling && box.nextElementSibling.classList.contains('tv') ? box.nextElementSibling : null;
    const btn = el.closest('.card').querySelector('.tv-btn[data-c="' + id + '"]');
    if (btn) { btn.textContent = on ? 'Grafik' : 'Tabel'; btn.setAttribute('aria-pressed', on); }
    box.classList.toggle('hidden', on);
    if (!on) { if (tv) tv.remove(); return; }
    if (!tv) { tv = document.createElement('div'); tv.className = 'tv table-wrap'; box.after(tv); }
    const fmt = st.fmtGrafik[id], ds = ch.data.datasets.filter(d => !d.borderDash);
    const tbl = document.createElement('table');
    const thead = tbl.createTHead().insertRow();
    [''].concat(ds.map(d => d.label)).forEach((t, i) => { const th = document.createElement('th'); th.textContent = t; if (i) th.className = 'n'; thead.appendChild(th); });
    const tb = tbl.createTBody();
    ch.data.labels.forEach((l, i) => {
      const tr = tb.insertRow(); const c0 = tr.insertCell(); c0.textContent = l;
      ds.forEach(d => { const c = tr.insertCell(); c.className = 'n'; const v = d.data[i]; c.textContent = v == null ? '–' : fmt(v); });
    });
    tv.replaceChildren(tbl);
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
          borderColor: tebal ? W[s.kode] : alpha(W[s.kode], 0.45), backgroundColor: W[s.kode], borderWidth: tebal ? 2 : 1.5, spanGaps: true };
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
    const sc = st.scope, D = st.data, a = agScope(sc, sc.dari, sc.sampai), aP = agScope(sc, sc.prevDari, sc.prevSampai, sc.cap);
    const bulan3 = monthsBetween(shiftMonth(sc.sampai, -2), sc.sampai);
    const stores = D.stores.filter(s => inStore(sc, s.kode));
    const baris = [];
    baris.push('Periode: ' + sc.dari + ' s/d ' + sc.sampai + ' (dibanding ' + sc.prevDari + ' s/d ' + sc.prevSampai + (sc.cap ? ', dipotong s/d ' + sc.cap + ' supaya setara dengan bulan berjalan' : '') + ') · Outlet: ' + (sc.storeSet ? stores.map(s => s.kode).join(', ') : 'semua (' + stores.length + ')') + ' · Batas food cost: ' + pct(D.batasFoodCost || 0.35, 0));
    baris.push('Total: omzet ' + rp(a.omz) + ' (' + (chg(a.omz, aP.omz) == null ? 'n/a' : (chg(a.omz, aP.omz) >= 0 ? '+' : '') + pct(chg(a.omz, aP.omz), 0)) + ' vs periode sebelumnya), belanja bahan ' + rp(a.bel) + ', food cost ' + pct(a.fc) +
      (a.ticket ? ', rata-rata per struk ' + rp(a.ticket) : '') + '.');
    const plT = plScope(sc, sc.dari, sc.sampai);
    baris.push('', 'Performa per outlet (periode ini):');
    stores.forEach(s => {
      const p = plOutlet(s.kode, sc.dari, sc.sampai), pp = plOutlet(s.kode, sc.prevDari, sc.prevSampai, sc.cap), x = agregat(k => k === s.kode, sc.dari, sc.sampai);
      if (!p.omz) return;
      baris.push('- ' + s.kode + ' (' + s.brand + '): omzet ' + rpS(p.omz) + ' (' + (chg(p.omz, pp.omz) == null ? 'n/a' : (chg(p.omz, pp.omz) >= 0 ? '+' : '') + pct(chg(p.omz, pp.omz), 0)) + ') | bahan ' + pct(p.fc) +
        (p.adaBiaya ? ' | karyawan ' + pct(p.karyPct) + ' | tetap/sewa ' + pct(p.tetap / p.omz) + ' | bulanan ' + pct(p.ops / p.omz) + ' | pembelian non-bahan ' + pct(p.pemb / p.omz) + ' | margin ' + pct(p.margin) : ' | biaya belum diisi') +
        (x.ticket ? ' | per struk ' + rpS(x.ticket) : '') +
        (adaKas() && bukuKas(s.kode).mulai ? ' | kas akhir ' + rpS(bukuKas(s.kode).saldo(batasHariIni(akhirBulan(sc.sampai)))) : ''));
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
  muat();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !st.data || st.data.demo) return;
    if (Date.now() - new Date(st.data.diambil).getTime() > 10 * 60 * 1000) muat();
  });
  // font web selesai dimuat → gambar ulang supaya teks grafik (canvas) ikut pakai font yang sama
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (st.data) render(); });
})();
