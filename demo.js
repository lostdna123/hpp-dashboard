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

    return {
      demo: true,
      namaFile: 'DATA DEMO (fiktif)',
      diambil: new Date().toISOString(),
      batasFoodCost: 0.35,
      stores: stores.map(({ kode, brand, nama, aktif }) => ({ kode, brand, nama, aktif })),
      bahan: Object.keys(H).map(n => ({ nama: n, kategori: H[n][0], satuan: H[n][1], brand: 'Semua', acuan: 0 })),
      belanja, omzet
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { buatDemo }; else root.buatDemo = buatDemo;
})(this);
