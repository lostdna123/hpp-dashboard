/*
 * Data demo (FIKTIF) — 6 bulan, 5 outlet, dengan beberapa anomali yang sengaja ditanam
 * supaya dashboard bisa dicoba sebelum data asli terkumpul. Deterministik (seed tetap).
 *
 * Anomali yang ditanam:
 *  1. BB-01 beli Daging babi samcan 35% lebih mahal mulai 10 Agustus
 *  2. AW-01 pemakaian Mie bakmi mentah naik ±70% di Agustus
 *  3. UG-02 selalu beli Cabe rawit merah ±25% lebih mahal dari outlet lain (Jul–Sep)
 *  4. DW-01 pemakaian Babi cincang naik ±50% di Agustus → food cost naik
 *  5. Harga cabe hijau naik ±60% di SEMUA outlet mulai 5 September (harga pasar)
 *  6. UG-01 omzet tidak diinput 6 hari di Agustus
 *  7. UG-01 input dobel samcan 12 September
 *  8. DW-01 tagihan listrik Agustus melonjak ±80%
 *  9. AW-01 ada biaya perbaikan besar di Agustus → margin turun
 */
(function (root) {
  'use strict';

  function buatDemo(hariIni) {
    let seed = 20260928;
    const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const noise = s => 1 + (rnd() * 2 - 1) * s;

    const stores = [
      { kode: 'UG-01', brand: 'Uri Gukbap', nama: 'Uri Gukbap - Outlet 1', aktif: true, omzet: 9500000 },
      { kode: 'UG-02', brand: 'Uri Gukbap', nama: 'Uri Gukbap - Outlet 2', aktif: true, omzet: 7000000 },
      { kode: 'AW-01', brand: 'Bakmi Awei 88', nama: 'Bakmi Awei 88 - Outlet 1', aktif: true, omzet: 8000000 },
      { kode: 'BB-01', brand: 'Baboy', nama: 'Baboy - Outlet 1', aktif: true, omzet: 11000000 },
      { kode: 'DW-01', brand: 'Bakmi Dua Wajah', nama: 'Bakmi Dua Wajah - Outlet 1', aktif: true, omzet: 6500000 }
    ];
    // [nama, kategori, satuan, harga dasar, pembulatan qty]
    const H = {
      'Daging babi samcan': ['Protein', 'kg', 120000, 0.5], 'Tulang babi': ['Protein', 'kg', 45000, 0.5],
      'Babi cincang': ['Protein', 'kg', 95000, 0.5], 'Cabe hijau': ['Sayur & Bumbu Segar', 'kg', 36000, 0.25],
      'Cabe rawit merah': ['Sayur & Bumbu Segar', 'kg', 60000, 0.25], 'Bawang putih': ['Sayur & Bumbu Segar', 'kg', 38000, 0.25],
      'Bawang merah': ['Sayur & Bumbu Segar', 'kg', 42000, 0.25], 'Daun bawang': ['Sayur & Bumbu Segar', 'kg', 24000, 0.25],
      'Sawi hijau (caisim)': ['Sayur & Bumbu Segar', 'kg', 15000, 0.5], 'Beras': ['Karbohidrat', 'kg', 14500, 5],
      'Mie bakmi mentah': ['Karbohidrat', 'kg', 22000, 1], 'Kulit pangsit': ['Karbohidrat', 'pack', 18000, 1],
      'Kimchi': ['Saus & Bumbu Jadi', 'kg', 58000, 0.5], 'Gochujang': ['Saus & Bumbu Jadi', 'kg', 90000, 0.5],
      'Minyak goreng': ['Saus & Bumbu Jadi', 'liter', 18000, 1], 'Gas LPG 12 kg': ['Operasional & Packaging', 'tabung', 235000, 1],
      'Box takeaway': ['Operasional & Packaging', 'pcs', 1500, 50]
    };
    // porsi belanja terhadap omzet, dan tiap berapa hari dibeli
    const RESEP = {
      'Uri Gukbap': [['Tulang babi', .06, 1], ['Daging babi samcan', .09, 1], ['Beras', .03, 3], ['Kimchi', .03, 2], ['Gochujang', .015, 7],
        ['Cabe hijau', .01, 1], ['Cabe rawit merah', .008, 2], ['Bawang putih', .01, 3], ['Daun bawang', .012, 1], ['Minyak goreng', .005, 7],
        ['Gas LPG 12 kg', .02, 4], ['Box takeaway', .015, 7]],
      'Bakmi': [['Mie bakmi mentah', .08, 1], ['Babi cincang', .08, 1], ['Daging babi samcan', .05, 1], ['Kulit pangsit', .025, 2],
        ['Sawi hijau (caisim)', .012, 1], ['Bawang putih', .01, 3], ['Daun bawang', .008, 1], ['Minyak goreng', .012, 4],
        ['Cabe rawit merah', .008, 2], ['Gas LPG 12 kg', .02, 4], ['Box takeaway', .02, 7]],
      'Baboy': [['Daging babi samcan', .12, 1], ['Babi cincang', .04, 1], ['Beras', .035, 3], ['Cabe hijau', .015, 1], ['Cabe rawit merah', .01, 2],
        ['Bawang merah', .01, 3], ['Bawang putih', .01, 3], ['Minyak goreng', .015, 4], ['Gas LPG 12 kg', .02, 4], ['Box takeaway', .015, 7]]
    };
    const resepBrand = b => b === 'Uri Gukbap' ? RESEP['Uri Gukbap'] : b === 'Baboy' ? RESEP.Baboy : RESEP.Bakmi;

    const akhir = new Date(hariIni + 'T00:00:00Z'); akhir.setUTCDate(akhir.getUTCDate() - 1);
    const mulai = new Date(Date.UTC(akhir.getUTCFullYear(), akhir.getUTCMonth() - 5, 1));
    const iso = d => d.toISOString().slice(0, 10);
    const bulanAnomali = (off) => { const d = new Date(Date.UTC(akhir.getUTCFullYear(), akhir.getUTCMonth() + off, 1)); return iso(d).slice(0, 7); };
    const BLN = bulanAnomali(0), BLN_1 = bulanAnomali(-1), BLN_2 = bulanAnomali(-2);

    // faktor pasar mingguan per bahan (semua outlet bergerak bersama)
    const pasar = {};
    const faktorPasar = (bahan, tgl) => {
      const minggu = Math.floor((Date.parse(tgl) - mulai.getTime()) / (7 * 864e5));
      const k = bahan + '|' + minggu;
      if (!(k in pasar)) pasar[k] = noise(0.03) * (1 + minggu * 0.001);
      return pasar[k];
    };

    const belanja = [], omzet = [];
    let nKirim = 0;
    for (let d = new Date(mulai); d <= akhir; d.setUTCDate(d.getUTCDate() + 1)) {
      const tgl = iso(d), bulan = tgl.slice(0, 7), hari = d.getUTCDay(), tglNo = d.getUTCDate();
      const hariKe = Math.round((d - mulai) / 864e5);
      stores.forEach(s => {
        const omz = Math.round(s.omzet * (hari === 0 || hari === 6 ? 1.25 : 1) * noise(0.12) / 1000) * 1000;
        const omzetKosong = s.kode === 'UG-01' && bulan === BLN_1 && [3, 4, 11, 17, 18, 25].indexOf(tglNo) > -1;
        if (!omzetKosong) omzet.push({ tgl, bulan, brand: s.brand, store: s.kode, omzet: omz, struk: Math.round(omz / 85000) });

        const idK = 'D' + (++nKirim);
        let urut = 0;
        resepBrand(s.brand).forEach(([bahan, porsi, tiap]) => {
          if ((hariKe + s.kode.charCodeAt(0)) % tiap !== 0) return;
          const [kategori, satuan, dasar, bulat] = H[bahan];
          let harga = dasar * faktorPasar(bahan, tgl) * noise(0.025);
          let pakai = porsi * s.omzet * tiap / dasar * noise(0.12);
          // --- anomali yang ditanam ---
          if (s.kode === 'BB-01' && bahan === 'Daging babi samcan' && (bulan > BLN_1 || (bulan === BLN_1 && tglNo >= 10))) harga *= 1.35;
          if (s.kode === 'AW-01' && bahan === 'Mie bakmi mentah' && bulan === BLN_1) pakai *= 1.7;
          if (s.kode === 'UG-02' && bahan === 'Cabe rawit merah' && bulan >= BLN_2) harga *= 1.25;
          if (s.kode === 'DW-01' && bahan === 'Babi cincang' && bulan === BLN_1) pakai *= 1.5;
          if (bahan === 'Cabe hijau' && bulan === BLN && tglNo >= 5) harga *= 1.6;
          const qty = Math.max(bulat, Math.round(pakai / bulat) * bulat);
          harga = satuan === 'pcs' ? Math.round(harga / 50) * 50 : Math.round(harga / 500) * 500;
          const row = { tgl, bulan, brand: s.brand, store: s.kode, pic: 'Demo', kategori, bahan, qty, satuan, harga, total: Math.round(qty * harga), id: idK + '-' + (++urut) };
          belanja.push(row);
          if (s.kode === 'UG-01' && bahan === 'Daging babi samcan' && bulan === BLN && tglNo === 12) {
            belanja.push(Object.assign({}, row, { id: 'D' + (++nKirim) + '-1' }));
          }
        });
      });
    }

    // ===== biaya operasional (per bulan) =====
    // jabatan: [nama jabatan, jumlah orang, gaji+tunjangan+BPJS per orang]
    const STAF = {
      'Uri Gukbap': [['Store Manager', 1, 8600000], ['Kepala Dapur', 1, 7500000], ['Cook', 2, 5700000], ['Kitchen Helper', 2, 4800000],
        ['Kasir', 1, 5100000], ['Waiter/Waitress', 3, 4800000], ['Steward/Dishwasher', 1, 4600000]],
      'Bakmi': [['Store Manager', 1, 8000000], ['Cook', 2, 5500000], ['Kitchen Helper', 1, 4700000], ['Kasir', 1, 5000000],
        ['Waiter/Waitress', 2, 4700000], ['Steward/Dishwasher', 1, 4500000]],
      'Baboy': [['Store Manager', 1, 9000000], ['Kepala Dapur', 1, 8000000], ['Cook', 3, 5800000], ['Kitchen Helper', 2, 4800000],
        ['Kasir', 1, 5100000], ['Waiter/Waitress', 4, 4800000], ['Steward/Dishwasher', 2, 4600000]]
    };
    const SEWA = { 'UG-01': 45000000, 'UG-02': 30000000, 'AW-01': 28000000, 'BB-01': 55000000, 'DW-01': 22000000 };
    const MALL = { 'UG-01': 3500000, 'BB-01': 4200000 };
    const biaya = [];
    const omzetBulan = {};
    omzet.forEach(r => { const k = r.store + '|' + r.bulan; omzetBulan[k] = (omzetBulan[k] || 0) + r.omzet; });
    const bulanList = [...new Set(omzet.map(r => r.bulan))].sort();
    // rincian per orang / per pos (dipakai Apps Script untuk mengisi MASTER_KARYAWAN & BIAYA_TETAP)
    const rincianKaryawan = [], rincianTetap = [];
    stores.forEach(s => {
      const staf = s.brand === 'Uri Gukbap' ? STAF['Uri Gukbap'] : s.brand === 'Baboy' ? STAF.Baboy : STAF.Bakmi;
      const skala = s.kode === 'UG-02' ? 0.8 : 1;
      staf.forEach(([jab, n, gaji]) => rincianKaryawan.push({ store: s.kode, jabatan: jab, orang: Math.max(1, Math.round(n * skala)), biaya: gaji }));
      rincianTetap.push({ store: s.kode, kategori: 'Sewa tempat', jumlah: SEWA[s.kode] });
      if (MALL[s.kode]) rincianTetap.push({ store: s.kode, kategori: 'Service charge / IPL', jumlah: MALL[s.kode] });
      rincianTetap.push({ store: s.kode, kategori: 'Internet & telepon', jumlah: 650000 });
      rincianTetap.push({ store: s.kode, kategori: 'Langganan POS / software', jumlah: 450000 });
    });
    bulanList.forEach(bulan => {
      stores.forEach(s => {
        const add = (kelompok, kategori, jumlah, orang) => biaya.push({ bulan, store: s.kode, kelompok, kategori, jumlah: Math.round(jumlah / 1000) * 1000, orang: orang || 0 });
        const staf = s.brand === 'Uri Gukbap' ? STAF['Uri Gukbap'] : s.brand === 'Baboy' ? STAF.Baboy : STAF.Bakmi;
        const skala = s.kode === 'UG-02' ? 0.8 : 1;
        staf.forEach(([jab, n, gaji]) => { const org = Math.max(1, Math.round(n * skala)); add('Karyawan', jab, org * gaji, org); });
        add('Tetap', 'Sewa tempat', SEWA[s.kode]);
        if (MALL[s.kode]) add('Tetap', 'Service charge / IPL', MALL[s.kode]);
        add('Tetap', 'Internet & telepon', 650000);
        add('Tetap', 'Langganan POS / software', 450000);
        // omzet penuh sebulan (perkiraan) — dipakai untuk biaya yang ikut omzet
        const o = s.omzet * 30.4 * 1.07;
        let listrik = o * 0.028 * noise(0.08);
        if (s.kode === 'DW-01' && bulan === BLN_1) listrik *= 1.8;                 // anomali: listrik DW-01 melonjak
        add('Operasional', 'Listrik', listrik);
        add('Operasional', 'Air (PDAM)', 1400000 * noise(0.15));
        add('Operasional', 'Komisi ojol / marketplace', o * 0.045 * noise(0.1));
        add('Operasional', 'Marketing & promosi', 3000000 * noise(0.12));
        add('Operasional', 'Kebersihan & pest control', 850000);
        let perbaikan = rnd() < 0.35 ? 1500000 * noise(0.5) : 0;
        if (s.kode === 'AW-01' && bulan === BLN_1) perbaikan = 14000000;          // anomali: perbaikan besar AW-01
        if (perbaikan) add('Operasional', 'Perbaikan & perawatan', perbaikan);
      });
    });

    // ===== pembelian non-bahan (tab Pembelian di app HP; tidak masuk HPP) =====
    // [barang, kategori, satuan, harga, qty maks, peluang per hari]
    const BARANG = [
      ['Sabun cuci piring 5 L', 'Kebersihan', 'jerigen', 65000, 2, 0.10], ['Tisu makan', 'Perlengkapan makan & saji', 'pack', 18000, 10, 0.12],
      ['Plastik sampah besar', 'Kebersihan', 'pack', 25000, 3, 0.08], ['Sumpit kayu', 'Perlengkapan makan & saji', 'pack', 32000, 4, 0.07],
      ['Kertas struk thermal', 'ATK & printing', 'roll', 9000, 20, 0.04], ['Parkir & bensin belanja', 'Transport & parkir', 'kali', 35000, 1, 0.25],
      ['Spons & sabut', 'Kebersihan', 'pack', 15000, 3, 0.05], ['Mangkok melamin', 'Peralatan dapur', 'pcs', 28000, 12, 0.015],
      ['Lampu LED', 'Perbaikan kecil', 'pcs', 45000, 4, 0.02], ['Galon air minum staf', 'Lain-lain', 'galon', 22000, 4, 0.10]
    ];
    const DARI = ['Kas outlet (tunai)', 'Kas outlet (tunai)', 'Kas outlet (tunai)', 'Uang pribadi (reimburse)', 'Transfer / kartu HO'];
    const pembelian = [];
    let nBeli = 0;
    for (let d = new Date(mulai); d <= akhir; d.setUTCDate(d.getUTCDate() + 1)) {
      const tgl = iso(d), bulan = tgl.slice(0, 7);
      stores.forEach(s => {
        const idK = 'P' + (++nBeli);
        let urut = 0;
        const dari = DARI[Math.floor(rnd() * DARI.length)];
        BARANG.forEach(([barang, kategori, satuan, harga, maks, peluang]) => {
          if (rnd() >= peluang) return;
          const qty = Math.max(1, Math.round(rnd() * maks));
          const h = Math.round(harga * noise(0.08) / 500) * 500;
          pembelian.push({ tgl, bulan, brand: s.brand, store: s.kode, pic: 'Demo', kategori, barang, qty, satuan, harga: h, total: qty * h,
            dibayarDari: dari, toko: 'Toko dummy', catatan: '', foto: '', id: idK + '-' + (++urut) });
        });
      });
    }

    return {
      demo: true,
      namaFile: 'DATA DEMO (fiktif)',
      diambil: new Date().toISOString(),
      batasFoodCost: 0.35,
      stores: stores.map(({ kode, brand, nama, aktif }) => ({ kode, brand, nama, aktif })),
      bahan: Object.keys(H).map(n => ({ nama: n, kategori: H[n][0], satuan: H[n][1], brand: 'Semua', acuan: 0 })),
      belanja, omzet, pembelian, biaya, rincianKaryawan, rincianTetap,
      kasAwal: stores.map(s => ({ store: s.kode, tgl: iso(mulai), jumlah: 100000000 })),
      mutasiKas: [],
      // target contoh: sebagian outlet di atas target, sebagian di bawah
      target: stores.map(s => {
        const f = { 'UG-01': 1.06, 'UG-02': 1.0, 'AW-01': 0.95, 'BB-01': 1.08, 'DW-01': 0.97 }[s.kode] || 1;
        return { store: s.kode, omzet: Math.round(s.omzet * 30.4 * 1.07 * f / 1e7) * 1e7, fc: 0.32, margin: 0.22 };
      })
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { buatDemo }; else root.buatDemo = buatDemo;
})(typeof globalThis !== 'undefined' ? globalThis : this);
