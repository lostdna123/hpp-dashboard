/*
 * Mesin deteksi anomali HPP.
 * Murni statistik & deterministik (median + MAD / robust z-score) — jalan di browser, tanpa token AI.
 * AI (Claude) hanya dipakai untuk MENJELASKAN hasil ini, dan hanya saat tombol "Analisis AI" diklik.
 *
 * Input rows:
 *   belanja: { tgl:'yyyy-mm-dd', bulan:'yyyy-mm', brand, store, pic, kategori, bahan, qty, satuan, harga, total, id }
 *   omzet:   { tgl, bulan, brand, store, omzet, struk }
 */
(function (root) {
  'use strict';

  // ---------- statistik dasar ----------
  const med = a => {
    if (!a.length) return NaN;
    const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const mad = (a, m) => med(a.map(x => Math.abs(x - m)));
  /** robust z-score: 0.6745·(x−median)/MAD. MAD 0 → pakai 5% median sebagai skala minimum. */
  const rz = (x, arr) => {
    const m = med(arr);
    let d = mad(arr, m);
    if (!d) d = Math.abs(m) * 0.05 || 1;
    return 0.6745 * (x - m) / d;
  };
  const sum = a => a.reduce((s, x) => s + x, 0);
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const daysInMonth = b => { const [y, m] = b.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
  const prevMonths = (b, n) => {
    const out = []; let [y, m] = b.split('-').map(Number);
    for (let i = 0; i < n; i++) { m--; if (!m) { m = 12; y--; } out.push(y + '-' + String(m).padStart(2, '0')); }
    return out;
  };
  const groupBy = (arr, f) => { const m = new Map(); arr.forEach(x => { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; };
  const rp = n => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
  const pct = (x, d = 0) => (x * 100).toFixed(d).replace('.', ',') + '%';
  const LEVEL_URUT = { tinggi: 0, sedang: 1, rendah: 2 };

  /**
   * @param data {belanja, omzet, stores, bahan, batasFoodCost}
   * @param opt  {bulanDari, bulanSampai, storeSet: Set|null, hariIni:'yyyy-mm-dd'}
   */
  function deteksi(data, opt) {
    const hariIni = opt.hariIni || new Date().toISOString().slice(0, 10);
    const bulanIni = hariIni.slice(0, 7);
    const inScopeBulan = b => b >= opt.bulanDari && b <= opt.bulanSampai;
    const inScopeStore = s => !opt.storeSet || opt.storeSet.has(s);
    const namaStore = {}; (data.stores || []).forEach(s => { namaStore[s.kode] = s.nama; });
    const satuanBahan = {}; (data.bahan || []).forEach(b => { satuanBahan[b.nama] = b.satuan; });
    const batas = data.batasFoodCost || 0.35;
    const B = data.belanja, O = data.omzet;
    const hasil = [];
    const tambah = a => { a.id = a.jenis + '|' + [a.store, a.bahan, a.bulan, a.kategori].filter(Boolean).join('|'); hasil.push(a); };

    // omzet per store-bulan & jumlah hari omzet terisi
    const omzetSB = new Map(), hariOmzetSB = new Map();
    O.forEach(r => {
      const k = r.store + '|' + r.bulan;
      omzetSB.set(k, (omzetSB.get(k) || 0) + r.omzet);
      if (!hariOmzetSB.has(k)) hariOmzetSB.set(k, new Set());
      hariOmzetSB.get(k).add(r.tgl);
    });
    const belanjaSB = new Map();
    B.forEach(r => { const k = r.store + '|' + r.bulan; belanjaSB.set(k, (belanjaSB.get(k) || 0) + r.total); });

    // ===== A. Lonjakan harga item (vs median 60 hari sebelumnya DI OUTLET YANG SAMA) =====
    // Harga yang dari dulu memang mahal ditangkap detektor B (vs outlet lain), bukan di sini.
    const perBahan = groupBy(B.slice().sort((a, b) => a.tgl < b.tgl ? -1 : 1), r => r.bahan + '|' + r.store);
    const kandidatA = new Map();
    perBahan.forEach(rows => {
      const bahan = rows[0].bahan;
      const cacheBase = new Map();
      let lo = 0;
      rows.forEach((r, i) => {
        if (!inScopeBulan(r.bulan) || !(r.harga > 0)) return; // semua outlet dihitung dulu, supaya deteksi "harga pasar" tetap benar saat difilter
        let base = cacheBase.get(r.tgl);
        if (!base) {
          const dari = addDays(r.tgl, -60);
          while (lo < rows.length && rows[lo].tgl < dari) lo++;
          const hist = [];
          for (let j = lo; j < rows.length && rows[j].tgl < r.tgl; j++) if (rows[j].harga > 0) hist.push(rows[j].harga);
          base = { m: med(hist), hist: hist };
          cacheBase.set(r.tgl, base);
        }
        if (base.hist.length < 4) return;
        const naik = r.harga / base.m - 1, z = rz(r.harga, base.hist);
        if (naik < 0.2 || z < 3) return;
        const k = r.store + '|' + bahan + '|' + r.bulan;
        const c = kandidatA.get(k) || { store: r.store, bahan: bahan, bulan: r.bulan, naikMax: 0, lebih: 0, n: 0, harga: [], base: base.m };
        c.naikMax = Math.max(c.naikMax, naik); c.lebih += (r.harga - base.m) * r.qty; c.n++; c.harga.push(r.harga);
        kandidatA.set(k, c);
      });
    });
    // gabungkan: kalau naik di ≥3 outlet pada bahan+bulan yang sama → kemungkinan harga pasar
    const aPerBahanBulan = groupBy([...kandidatA.values()], c => c.bahan + '|' + c.bulan);
    aPerBahanBulan.forEach(list => {
      const sat = satuanBahan[list[0].bahan] || 'satuan';
      if (list.length >= 3) {
        if (!list.some(c => inScopeStore(c.store))) return;
        const naikMed = med(list.map(c => c.naikMax));
        tambah({
          jenis: 'harga-pasar', dimensi: 'item', level: naikMed >= 0.5 ? 'sedang' : 'rendah',
          bahan: list[0].bahan, bulan: list[0].bulan, dampak: sum(list.map(c => c.lebih)),
          judul: list[0].bahan + ' naik di ' + list.length + ' outlet sekaligus',
          detail: 'Harga naik ±' + pct(naikMed) + ' dari biasanya (' + rp(med(list.map(c => c.base))) + '/' + sat + ') di ' +
            list.map(c => c.store).join(', ') + '. Karena serentak, kemungkinan besar harga pasar, bukan masalah outlet.',
          grafik: { tipe: 'harga', bahan: list[0].bahan }
        });
      } else {
        list.filter(c => inScopeStore(c.store)).forEach(c => {
          const hMed = med(c.harga);
          tambah({
            jenis: 'harga-melonjak', dimensi: 'item',
            level: c.naikMax >= 0.5 ? 'tinggi' : c.naikMax >= 0.3 ? 'sedang' : 'rendah',
            store: c.store, bahan: c.bahan, bulan: c.bulan, dampak: c.lebih,
            judul: 'Harga ' + c.bahan + ' melonjak di ' + c.store,
            detail: c.n + ' pembelian dengan harga ±' + rp(hMed) + '/' + sat + ', biasanya ' + rp(c.base) + ' di outlet ini (+' + pct(hMed / c.base - 1) +
              '). Estimasi kelebihan bayar ' + rp(c.lebih) + '. Cek nota & supplier.',
            grafik: { tipe: 'harga', bahan: c.bahan, store: c.store }
          });
        });
      }
    });

    // ===== B. Harga lebih mahal dari outlet lain (bahan sama, bulan sama) =====
    const bSBB = groupBy(B.filter(r => inScopeBulan(r.bulan) && r.qty > 0), r => r.bahan + '|' + r.bulan);
    bSBB.forEach((rows, key) => {
      const [bahan, bulan] = key.split('|');
      const perStore = groupBy(rows, r => r.store);
      if (perStore.size < 3) return;
      const avg = new Map();
      perStore.forEach((rs, s) => avg.set(s, { h: sum(rs.map(r => r.total)) / sum(rs.map(r => r.qty)), q: sum(rs.map(r => r.qty)) }));
      avg.forEach((v, s) => {
        if (!inScopeStore(s)) return;
        const peers = [...avg.entries()].filter(([k]) => k !== s).map(([, x]) => x.h);
        const pm = med(peers), lebihMahal = v.h / pm - 1;
        if (lebihMahal < 0.15) return;
        if ((aPerBahanBulan.get(bahan + '|' + bulan) || []).length >= 3) return; // kenaikan pasar, sudah dilaporkan di A
        const sat = satuanBahan[bahan] || 'satuan';
        tambah({
          jenis: 'harga-vs-outlet', dimensi: 'item',
          level: lebihMahal >= 0.3 ? 'tinggi' : lebihMahal >= 0.2 ? 'sedang' : 'rendah',
          store: s, bahan: bahan, bulan: bulan, dampak: (v.h - pm) * v.q,
          judul: s + ' beli ' + bahan + ' lebih mahal dari outlet lain',
          detail: 'Rata-rata ' + rp(v.h) + '/' + sat + ' vs median outlet lain ' + rp(pm) + ' (+' + pct(lebihMahal) +
            '). Cek supplier/nota outlet ini. Selisih ±' + rp((v.h - pm) * v.q) + ' untuk ' + v.q.toLocaleString('id-ID') + ' ' + sat + '.',
          grafik: { tipe: 'harga', bahan: bahan, store: s }
        });
      });
    });

    // ===== C. Pemakaian (qty) item melonjak vs bulan-bulan sebelumnya di outlet yang sama =====
    const qtySB = new Map(), nilaiSB = new Map();
    B.forEach(r => {
      const k = r.store + '|' + r.bahan + '|' + r.bulan;
      qtySB.set(k, (qtySB.get(k) || 0) + r.qty);
      nilaiSB.set(k, (nilaiSB.get(k) || 0) + r.total);
    });
    qtySB.forEach((q, k) => {
      const [store, bahan, bulan] = k.split('|');
      if (!inScopeBulan(bulan) || !inScopeStore(store) || bulan === bulanIni) return; // bulan berjalan belum lengkap
      const prev = prevMonths(bulan, 6).filter(b => qtySB.has(store + '|' + bahan + '|' + b));
      if (prev.length < 3) return;
      const pakaiOmzet = omzetSB.get(store + '|' + bulan) > 0 && prev.every(b => omzetSB.get(store + '|' + b) > 0);
      const val = b => { const qq = qtySB.get(store + '|' + bahan + '|' + b); return pakaiOmzet ? qq / omzetSB.get(store + '|' + b) * 1e6 : qq; };
      const cur = val(bulan), hist = prev.map(val), m = med(hist);
      const rasio = cur / m, z = rz(cur, hist);
      if (rasio < 1.4 || z < 2.5) return;
      const hargaRata = nilaiSB.get(k) / q;
      const qtyWajar = pakaiOmzet ? m * omzetSB.get(store + '|' + bulan) / 1e6 : m;
      const sat = satuanBahan[bahan] || 'satuan';
      tambah({
        jenis: 'pemakaian-melonjak', dimensi: 'item',
        level: rasio >= 1.8 ? 'tinggi' : rasio >= 1.5 ? 'sedang' : 'rendah',
        store: store, bahan: bahan, bulan: bulan, dampak: (q - qtyWajar) * hargaRata,
        judul: 'Pemakaian ' + bahan + ' di ' + store + ' naik ' + pct(rasio - 1),
        detail: 'Beli ' + q.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' ' + sat + ' di ' + bulan + ', wajarnya ±' +
          qtyWajar.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' ' + sat + (pakaiOmzet ? ' (sudah disesuaikan dengan omzet)' : '') +
          '. Kemungkinan porsi kebesaran, waste, stok numpuk, atau hilang. Selisih ±' + rp((q - qtyWajar) * hargaRata) + '.',
        grafik: { tipe: 'qty', bahan: bahan, store: store }
      });
    });

    // ===== D. Food cost per outlet per bulan =====
    const fcSB = new Map();
    omzetSB.forEach((o, k) => { if (o > 0) fcSB.set(k, (belanjaSB.get(k) || 0) / o); });
    fcSB.forEach((fc, k) => {
      const [store, bulan] = k.split('|');
      if (!inScopeBulan(bulan) || !inScopeStore(store)) return;
      if (bulan === bulanIni && Number(hariIni.slice(8, 10)) - 1 < 7) return; // awal bulan: baru beberapa hari, food cost belum bermakna
      const alasan = []; let skor = 0;
      if (fc > batas) { alasan.push('di atas batas ' + pct(batas)); skor += fc > batas + 0.1 ? 2 : 1; }
      const prev = prevMonths(bulan, 6).filter(b => fcSB.has(store + '|' + b)).map(b => fcSB.get(store + '|' + b));
      let biasa = null;
      if (prev.length >= 3) {
        biasa = med(prev);
        if (fc - biasa >= 0.04 && rz(fc, prev) >= 2) { alasan.push('naik ' + ((fc - biasa) * 100).toFixed(1).replace('.', ',') + ' poin dari biasanya ' + pct(biasa, 1)); skor += fc - biasa >= 0.08 ? 2 : 1; }
      }
      const peers = [...fcSB.entries()].filter(([kk]) => kk.endsWith('|' + bulan) && !kk.startsWith(store + '|')).map(([, v]) => v);
      if (peers.length >= 2 && fc - med(peers) >= 0.06) { alasan.push('lebih tinggi dari outlet lain (median ' + pct(med(peers), 1) + ')'); skor += 1; }
      if (!alasan.length) return;
      const o = omzetSB.get(k), target = Math.min(batas, biasa == null ? batas : biasa);
      const catatan = [];
      if (bulan === bulanIni) catatan.push('bulan berjalan, angka bisa berubah');
      const hariO = (hariOmzetSB.get(k) || new Set()).size, hariSeharusnya = bulan === bulanIni ? Number(hariIni.slice(8, 10)) - 1 : daysInMonth(bulan);
      if (hariSeharusnya - hariO >= 3) catatan.push('omzet cuma terisi ' + hariO + ' dari ' + hariSeharusnya + ' hari, food cost bisa kebesaran');
      tambah({
        jenis: 'food-cost', dimensi: 'store', level: skor >= 3 ? 'tinggi' : skor >= 2 ? 'sedang' : 'rendah',
        store: store, bulan: bulan, dampak: Math.max(0, (fc - target) * o),
        judul: 'Food cost ' + store + ' ' + pct(fc, 1) + ' di ' + bulan,
        detail: 'Food cost ' + alasan.join('; ') + '. Belanja ' + rp(belanjaSB.get(k)) + ' vs omzet ' + rp(o) + '.' +
          (catatan.length ? ' Catatan: ' + catatan.join('; ') + '.' : ''),
        grafik: { tipe: 'fc', store: store }
      });
    });

    // ===== E. Belanja bulanan outlet melonjak (untuk outlet/bulan tanpa omzet) =====
    belanjaSB.forEach((tot, k) => {
      const [store, bulan] = k.split('|');
      if (!inScopeBulan(bulan) || !inScopeStore(store) || omzetSB.get(k) > 0 || bulan === bulanIni) return;
      const prev = prevMonths(bulan, 6).filter(b => belanjaSB.has(store + '|' + b)).map(b => belanjaSB.get(store + '|' + b));
      if (prev.length < 3) return;
      const m = med(prev);
      if (tot / m < 1.35) return;
      tambah({
        jenis: 'belanja-melonjak', dimensi: 'bulan', level: tot / m >= 1.6 ? 'sedang' : 'rendah',
        store: store, bulan: bulan, dampak: tot - m,
        judul: 'Total belanja ' + store + ' naik ' + pct(tot / m - 1) + ' di ' + bulan,
        detail: 'Belanja ' + rp(tot) + ' vs biasanya ' + rp(m) + '. Omzet bulan ini belum diinput, jadi food cost tidak bisa dihitung.',
        grafik: { tipe: 'fc', store: store }
      });
    });

    // ===== F. Per bulan: porsi kategori (dari omzet) melonjak, gabungan outlet yang dipilih =====
    const storesDipilih = s => inScopeStore(s);
    const katB = new Map(), omzetB = new Map();
    B.forEach(r => { if (!storesDipilih(r.store)) return; const k = r.kategori + '|' + r.bulan; katB.set(k, (katB.get(k) || 0) + r.total); });
    O.forEach(r => { if (!storesDipilih(r.store)) return; omzetB.set(r.bulan, (omzetB.get(r.bulan) || 0) + r.omzet); });
    katB.forEach((tot, k) => {
      const [kat, bulan] = k.split('|');
      if (!inScopeBulan(bulan) || bulan === bulanIni || !(omzetB.get(bulan) > 0)) return;
      const share = tot / omzetB.get(bulan);
      const prev = prevMonths(bulan, 6).filter(b => katB.has(kat + '|' + b) && omzetB.get(b) > 0).map(b => katB.get(kat + '|' + b) / omzetB.get(b));
      if (prev.length < 3) return;
      const m = med(prev);
      if (share / m < 1.25 || share - m < 0.01 || rz(share, prev) < 2.5) return;
      tambah({
        jenis: 'kategori-bulan', dimensi: 'bulan', level: share / m >= 1.5 ? 'sedang' : 'rendah',
        kategori: kat, bulan: bulan, dampak: (share - m) * omzetB.get(bulan),
        judul: 'Belanja ' + kat + ' naik di ' + bulan,
        detail: 'Porsi ' + kat + ' terhadap omzet ' + pct(share, 1) + ' vs biasanya ' + pct(m, 1) + '. Tambahan biaya ±' + rp((share - m) * omzetB.get(bulan)) + ' untuk outlet yang dipilih.',
        grafik: { tipe: 'kategori', kategori: kat }
      });
    });

    // ===== G. Kualitas data =====
    // G1. hari omzet kosong
    belanjaSB.forEach((tot, k) => {
      const [store, bulan] = k.split('|');
      if (!inScopeBulan(bulan) || !inScopeStore(store)) return;
      const hariSeharusnya = bulan === bulanIni ? Number(hariIni.slice(8, 10)) - 1 : daysInMonth(bulan);
      const terisi = (hariOmzetSB.get(k) || new Set()).size, kosong = hariSeharusnya - terisi;
      if (kosong < 3) return;
      tambah({
        jenis: 'omzet-kosong', dimensi: 'data', level: kosong >= 10 ? 'sedang' : 'rendah',
        store: store, bulan: bulan, dampak: 0,
        judul: 'Omzet ' + store + ' kosong ' + kosong + ' hari di ' + bulan,
        detail: 'Omzet cuma terisi ' + terisi + ' dari ' + hariSeharusnya + ' hari. Food cost bulan ini jadi kelihatan lebih tinggi dari aslinya.'
      });
    });
    // G2. tidak ada input belanja 7 hari terakhir
    const terakhirStore = new Map();
    B.forEach(r => { if (!terakhirStore.has(r.store) || r.tgl > terakhirStore.get(r.store)) terakhirStore.set(r.store, r.tgl); });
    if (opt.bulanSampai >= bulanIni) {
      terakhirStore.forEach((tgl, store) => {
        if (!inScopeStore(store) || tgl >= addDays(hariIni, -7)) return;
        tambah({
          jenis: 'tidak-input', dimensi: 'data', level: 'sedang', store: store, bulan: bulanIni, dampak: 0,
          judul: store + ' tidak input belanja sejak ' + tgl,
          detail: 'Sudah lebih dari 7 hari tidak ada input belanja dari ' + (namaStore[store] || store) + '. Cek apakah app dipakai.'
        });
      });
    }
    // G3. kemungkinan input dobel
    const sidik = groupBy(B.filter(r => inScopeBulan(r.bulan) && inScopeStore(r.store)), r => [r.store, r.tgl, r.bahan, r.qty, r.harga].join('|'));
    sidik.forEach(rows => {
      const kiriman = new Set(rows.map(r => String(r.id).replace(/-\d+$/, '')));
      if (kiriman.size < 2) return;
      const r = rows[0];
      tambah({
        jenis: 'dobel', dimensi: 'data', level: 'rendah', store: r.store, bahan: r.bahan, bulan: r.bulan,
        dampak: r.total * (kiriman.size - 1),
        judul: 'Kemungkinan input dobel: ' + r.bahan + ' di ' + r.store,
        detail: 'Tanggal ' + r.tgl + ', ' + r.qty + ' ' + r.satuan + ' @' + rp(r.harga) + ' tercatat ' + kiriman.size + '× dari kiriman berbeda. Hapus salah satu di INPUT_BELANJA kalau memang dobel.'
      });
    });

    // ===== H–J. Biaya operasional & margin (kalau data biaya sudah diisi) =====
    const BY = data.biaya || [];
    if (BY.length) {
      // H. Biaya bulanan per kategori melonjak vs 3–6 bulan sebelumnya di outlet yang sama
      const opsSKB = new Map();
      BY.forEach(r => { if (r.kelompok !== 'Operasional') return; const k = r.store + '|' + r.kategori + '|' + r.bulan; opsSKB.set(k, (opsSKB.get(k) || 0) + r.jumlah); });
      opsSKB.forEach((v, k) => {
        const [store, kat, bulan] = k.split('|');
        if (!inScopeBulan(bulan) || !inScopeStore(store)) return;
        const prev = prevMonths(bulan, 6).map(b => opsSKB.get(store + '|' + kat + '|' + b)).filter(x => x > 0);
        if (prev.length < 3) return;
        const m = med(prev), rasio = v / m;
        if (rasio < 1.4 || rz(v, prev) < 2.5 || v - m < 300000) return;
        tambah({
          jenis: 'biaya-melonjak', dimensi: 'store', level: rasio >= 2 ? 'tinggi' : rasio >= 1.6 ? 'sedang' : 'rendah',
          store: store, bulan: bulan, kategori: kat, dampak: v - m,
          judul: 'Biaya ' + kat + ' ' + store + ' naik ' + pct(rasio - 1) + ' di ' + bulan,
          detail: kat + ' ' + rp(v) + ' vs biasanya ' + rp(m) + ' per bulan. Cek tagihan & penyebabnya (alat rusak, tarif naik, salah input).',
          grafik: { tipe: 'biaya', store: store, kategori: kat }
        });
      });

      // I. Margin operasional per outlet per bulan
      const biayaSB = new Map(), karySB = new Map(), lengkapSB = new Set();
      BY.forEach(r => {
        const k = r.store + '|' + r.bulan;
        biayaSB.set(k, (biayaSB.get(k) || 0) + r.jumlah);
        if (r.kelompok === 'Karyawan') karySB.set(k, (karySB.get(k) || 0) + r.jumlah);
        if (r.kelompok !== 'Operasional') lengkapSB.add(k);
      });
      // pembelian non-bahan juga biaya (sama seperti perhitungan laba di dashboard)
      (data.pembelian || []).forEach(r => { const k = r.store + '|' + r.bulan; biayaSB.set(k, (biayaSB.get(k) || 0) + r.total); });
      const marginSB = new Map();
      omzetSB.forEach((o, k) => { if (o > 0 && lengkapSB.has(k)) marginSB.set(k, (o - (belanjaSB.get(k) || 0) - (biayaSB.get(k) || 0)) / o); });
      marginSB.forEach((mg, k) => {
        const [store, bulan] = k.split('|');
        if (!inScopeBulan(bulan) || !inScopeStore(store) || bulan === bulanIni) return; // bulan berjalan: omzet belum penuh
        const o = omzetSB.get(k), laba = mg * o, alasan = [];
        let skor = 0, dampak = 0;
        if (mg < 0) { alasan.push('RUGI ' + rp(-laba)); skor += 3; dampak = -laba; }
        const prev = prevMonths(bulan, 6).filter(b => marginSB.has(store + '|' + b)).map(b => marginSB.get(store + '|' + b));
        if (prev.length >= 3) {
          const m = med(prev);
          if (m - mg >= 0.05 && rz(mg, prev) <= -2) {
            alasan.push('turun ' + ((m - mg) * 100).toFixed(1).replace('.', ',') + ' poin dari biasanya ' + pct(m, 1));
            skor += m - mg >= 0.08 ? 2 : 1; dampak = Math.max(dampak, (m - mg) * o);
          }
        }
        const kp = (karySB.get(k) || 0) / o;
        if (kp > 0.3) { alasan.push('biaya karyawan ' + pct(kp, 1) + ' dari omzet'); skor += 1; }
        if (!alasan.length) return;
        const hariO = (hariOmzetSB.get(k) || new Set()).size;
        tambah({
          jenis: 'margin', dimensi: 'store', level: skor >= 3 ? 'tinggi' : skor >= 2 ? 'sedang' : 'rendah',
          store: store, bulan: bulan, dampak: dampak,
          judul: 'Margin ' + store + ' ' + pct(mg, 1) + ' di ' + bulan,
          detail: 'Margin operasional ' + alasan.join('; ') + '. Omzet ' + rp(o) + ', laba operasional ' + rp(laba) + '.' +
            (daysInMonth(bulan) - hariO >= 3 ? ' Catatan: omzet cuma terisi ' + hariO + ' hari, margin bisa kekecilan.' : ''),
          grafik: { tipe: 'margin', store: store }
        });
      });

      // J. Kualitas data: omzet ada tapi biaya karyawan/sewa belum diisi
      omzetSB.forEach((o, k) => {
        const [store, bulan] = k.split('|');
        if (!inScopeBulan(bulan) || !inScopeStore(store) || lengkapSB.has(k) || !(o > 0)) return;
        tambah({
          jenis: 'biaya-kosong', dimensi: 'data', level: 'rendah', store: store, bulan: bulan, dampak: 0,
          judul: 'Biaya karyawan & sewa ' + store + ' belum diisi (' + bulan + ')',
          detail: 'Isi MASTER_KARYAWAN dan BIAYA_TETAP untuk outlet ini supaya laba & margin bisa dihitung.'
        });
      });
    }

    hasil.forEach(a => { a.namaStore = a.store ? (namaStore[a.store] || a.store) : ''; a.dampak = Math.max(0, Math.round(a.dampak || 0)); });
    // satu masalah harga (outlet+bahan+bulan) cukup tampil sekali: ambil yang dampaknya terbesar
    const hargaTerbaik = new Map();
    hasil.forEach(a => {
      if (a.jenis !== 'harga-melonjak' && a.jenis !== 'harga-vs-outlet') return;
      const k = a.store + '|' + a.bahan + '|' + a.bulan, cur = hargaTerbaik.get(k);
      if (!cur || a.dampak > cur.dampak) hargaTerbaik.set(k, a);
    });
    const final = hasil.filter(a => (a.jenis !== 'harga-melonjak' && a.jenis !== 'harga-vs-outlet') ||
      hargaTerbaik.get(a.store + '|' + a.bahan + '|' + a.bulan) === a);
    final.sort((a, b) => (LEVEL_URUT[a.level] - LEVEL_URUT[b.level]) || (b.dampak - a.dampak));
    return final;
  }

  const api = { deteksi, med, rz, prevMonths, daysInMonth, addDays, groupBy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Anomali = api;
})(this);
