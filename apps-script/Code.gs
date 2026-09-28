/**
 * ============================================================
 *  HPP STORE — Backend Google Apps Script
 *  Brand: Uri Gukbap · Bakmi Awei 88 · Baboy · Bakmi Dua Wajah
 * ============================================================
 *
 *  CARA PASANG (sekali saja, ±10 menit):
 *  1. Bikin Google Sheet baru (kosong) → menu Extensions > Apps Script.
 *  2. Hapus isi Code.gs bawaan, paste SELURUH file ini.
 *  3. Klik "+" di panel Files → HTML → beri nama  Index  (tanpa .html)
 *     → paste isi file Index.html.
 *  4. Pilih fungsi  setup  di toolbar → Run → izinkan akses (Allow).
 *     Sheet otomatis terbentuk + contoh data master.
 *  5. Di Google Sheet: edit MASTER_STORE (outlet asli + PIN) dan MASTER_BAHAN.
 *  6. Deploy > New deployment > type: Web app
 *       - Execute as : Me
 *       - Who has access : Anyone
 *     → Deploy → copy URL web app → kirim ke HP tim store.
 *  7. Kalau kode diubah: Deploy > Manage deployments > Edit (pensil)
 *     > Version: New version > Deploy  (URL tetap sama).
 * ============================================================
 */

const CFG = {
  TZ: 'Asia/Jakarta',
  SH_BELANJA: 'INPUT_BELANJA',
  SH_OMZET: 'INPUT_OMZET',
  SH_PEMBELIAN: 'INPUT_PEMBELIAN',
  SH_STORE: 'MASTER_STORE',
  SH_BAHAN: 'MASTER_BAHAN',
  SH_REKAP: 'REKAP_BULANAN',
  SH_TREN: 'REKAP_TREN',
  SH_KARYAWAN: 'MASTER_KARYAWAN',
  SH_TETAP: 'BIAYA_TETAP',
  SH_BULANAN: 'BIAYA_BULANAN',
  SH_PROFIT: 'REKAP_PROFIT',
  SH_KAMUS: 'KAMUS_DATA',
  SH_KAS_AWAL: 'SALDO_AWAL_KAS',
  SH_MUTASI_KAS: 'MUTASI_KAS',
  SH_TARGET: 'TARGET_OUTLET',
  SH_CASHFLOW: 'REKAP_CASHFLOW',
  SALDO_AWAL_KAS: 100000000,      // saldo awal default tiap outlet baru (bisa diubah per outlet di sheet)
  FOLDER_NOTA: 'Foto Nota HPP',
  TOLERANSI_HARGA: 0.20,          // flag kalau harga > harga acuan + 20%
  BATAS_FOOD_COST: 0.35,          // default batas food cost di REKAP_TREN (bisa diubah di sheet)
  MAKS_BARIS_HARGA_TERAKHIR: 3000 // berapa baris terakhir dibaca utk "harga terakhir"
};

const METRIK_TREN = ['Food cost %', 'Total belanja', 'Omzet'];

const KOLOM = {
  INPUT_BELANJA: ['ID Baris', 'Waktu Input', 'Tanggal Belanja', 'Bulan', 'Brand', 'Kode Store', 'Nama Store', 'PIC',
    'Kategori', 'Nama Bahan', 'Qty', 'Satuan', 'Harga per Satuan', 'Total', 'Supplier', 'Catatan',
    'Link Foto Nota', 'Flag', 'ID Kiriman'],
  INPUT_PEMBELIAN: ['ID Baris', 'Waktu Input', 'Tanggal Beli', 'Bulan', 'Brand', 'Kode Store', 'Nama Store', 'PIC',
    'Kategori', 'Nama Barang', 'Qty', 'Satuan', 'Harga per Satuan', 'Total', 'Dibayar Dari', 'Toko / Supplier', 'Catatan',
    'Link Foto Nota', 'ID Kiriman'],
  INPUT_OMZET: ['ID Baris', 'Waktu Input', 'Tanggal', 'Bulan', 'Brand', 'Kode Store', 'Nama Store', 'PIC',
    'Omzet', 'Jumlah Struk', 'Catatan', 'ID Kiriman'],
  MASTER_STORE: ['Kode Store', 'Brand', 'Nama Store', 'Kota', 'PIN', 'Aktif'],
  MASTER_BAHAN: ['Nama Bahan', 'Kategori', 'Satuan', 'Brand', 'Harga Acuan', 'Aktif'],
  MASTER_KARYAWAN: ['Kode Store', 'Nama', 'Jabatan', 'Gaji Pokok /bln', 'Tunjangan /bln', 'BPJS & Lainnya /bln', 'Mulai', 'Selesai', 'Catatan'],
  BIAYA_TETAP: ['Kode Store', 'Kategori', 'Keterangan', 'Jumlah /bln', 'Mulai', 'Selesai'],
  BIAYA_BULANAN: ['Bulan', 'Kode Store', 'Kategori', 'Keterangan', 'Jumlah'],
  SALDO_AWAL_KAS: ['Kode Store', 'Tanggal Mulai', 'Saldo Awal', 'Catatan'],
  MUTASI_KAS: ['Tanggal', 'Kode Store', 'Jenis', 'Keterangan', 'Jumlah'],
  TARGET_OUTLET: ['Kode Store', 'Target Omzet /bln', 'Batas Food Cost', 'Target Margin', 'Catatan']
};
// Arah mutasi ditentukan oleh jenisnya (isi Jumlah positif). Jenis "(+/−)" memakai tanda angka yang diisi.
const JENIS_MUTASI = ['Setoran / tarik ke HO (keluar)', 'Tambahan modal dari HO (masuk)', 'Koreksi selisih kas (+/−)', 'Lain-lain (+/−)'];

const JABATAN = ['Store Manager', 'Supervisor', 'Kepala Dapur', 'Cook', 'Kitchen Helper', 'Kasir', 'Waiter/Waitress',
  'Barista', 'Steward/Dishwasher', 'Cleaning', 'Driver/Kurir', 'Security', 'Part-time', 'Lainnya'];
const KAT_TETAP = ['Sewa tempat', 'Service charge / IPL', 'Internet & telepon', 'Langganan POS / software', 'Asuransi',
  'Cicilan / penyusutan alat', 'Lainnya'];
const KAT_BULANAN = ['Listrik', 'Air (PDAM)', 'Perbaikan & perawatan', 'Marketing & promosi', 'Komisi ojol / marketplace',
  'Kebersihan & pest control', 'Perlengkapan non-bahan', 'Transport', 'Lembur & insentif', 'Pajak & retribusi', 'Lain-lain'];

// Pembelian di luar bahan baku (tidak masuk HPP / food cost, tapi mengurangi laba & kas)
const KAT_PEMBELIAN = ['Peralatan dapur', 'Perlengkapan makan & saji', 'Kebersihan', 'ATK & printing', 'Perbaikan kecil',
  'Transport & parkir', 'Perlengkapan toko', 'Lain-lain'];
// Sumber uang: dasar hitung kas bersih outlet nanti
const DIBAYAR_DARI = ['Kas outlet (tunai)', 'Uang pribadi (reimburse)', 'Transfer / kartu HO'];

const KATEGORI = ['Protein', 'Sayur & Bumbu Segar', 'Karbohidrat', 'Saus & Bumbu Jadi', 'Minuman',
  'Operasional & Packaging', 'Lainnya'];

const CONTOH_STORE = [
  ['UG-01', 'Uri Gukbap', 'Uri Gukbap - Outlet 1', 'Jakarta', '1111', true],
  ['UG-02', 'Uri Gukbap', 'Uri Gukbap - Outlet 2', 'Jakarta', '1112', true],
  ['AW-01', 'Bakmi Awei 88', 'Bakmi Awei 88 - Outlet 1', 'Jakarta', '2221', true],
  ['BB-01', 'Baboy', 'Baboy - Outlet 1', 'Jakarta', '3331', true],
  ['DW-01', 'Bakmi Dua Wajah', 'Bakmi Dua Wajah - Outlet 1', 'Jakarta', '4441', true]
];

const BAKMI = 'Bakmi Awei 88, Bakmi Dua Wajah';
const CONTOH_BAHAN = [
  ['Daging babi samcan', 'Protein', 'kg', 'Semua'],
  ['Daging babi has (lean)', 'Protein', 'kg', 'Semua'],
  ['Tulang babi', 'Protein', 'kg', 'Semua'],
  ['Babi cincang', 'Protein', 'kg', 'Semua'],
  ['Kulit babi', 'Protein', 'kg', 'Semua'],
  ['Telur ayam', 'Protein', 'kg', 'Semua'],
  ['Cabe hijau', 'Sayur & Bumbu Segar', 'kg', 'Semua'],
  ['Cabe rawit merah', 'Sayur & Bumbu Segar', 'kg', 'Semua'],
  ['Cabe merah keriting', 'Sayur & Bumbu Segar', 'kg', 'Semua'],
  ['Bawang putih', 'Sayur & Bumbu Segar', 'kg', 'Semua'],
  ['Bawang merah', 'Sayur & Bumbu Segar', 'kg', 'Semua'],
  ['Bawang bombay', 'Sayur & Bumbu Segar', 'kg', 'Semua'],
  ['Daun bawang', 'Sayur & Bumbu Segar', 'kg', 'Semua'],
  ['Jahe', 'Sayur & Bumbu Segar', 'kg', 'Semua'],
  ['Sawi hijau (caisim)', 'Sayur & Bumbu Segar', 'kg', 'Semua'],
  ['Tauge', 'Sayur & Bumbu Segar', 'kg', 'Semua'],
  ['Kucai', 'Sayur & Bumbu Segar', 'ikat', 'Semua'],
  ['Beras', 'Karbohidrat', 'kg', 'Semua'],
  ['Mie bakmi mentah', 'Karbohidrat', 'kg', BAKMI],
  ['Kulit pangsit', 'Karbohidrat', 'pack', BAKMI],
  ['Kimchi', 'Saus & Bumbu Jadi', 'kg', 'Uri Gukbap'],
  ['Gochujang', 'Saus & Bumbu Jadi', 'kg', 'Uri Gukbap'],
  ['Kecap asin', 'Saus & Bumbu Jadi', 'liter', 'Semua'],
  ['Minyak wijen', 'Saus & Bumbu Jadi', 'liter', 'Semua'],
  ['Minyak goreng', 'Saus & Bumbu Jadi', 'liter', 'Semua'],
  ['Gula pasir', 'Saus & Bumbu Jadi', 'kg', 'Semua'],
  ['Garam', 'Saus & Bumbu Jadi', 'kg', 'Semua'],
  ['Kaldu bubuk', 'Saus & Bumbu Jadi', 'kg', 'Semua'],
  ['Saus tiram', 'Saus & Bumbu Jadi', 'liter', 'Semua'],
  ['Es batu', 'Minuman', 'pack', 'Semua'],
  ['Air galon', 'Minuman', 'galon', 'Semua'],
  ['Gas LPG 12 kg', 'Operasional & Packaging', 'tabung', 'Semua'],
  ['Box takeaway', 'Operasional & Packaging', 'pcs', 'Semua']
];

/* ============================================================
 *  WEB APP
 * ============================================================ */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Input HPP Store')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/* ============================================================
 *  API DASHBOARD (dipanggil dari web dashboard di GitHub Pages)
 *  Semua lewat POST supaya kunci tidak pernah ada di URL.
 *  Body (text/plain JSON): { api: 'ping' | 'data' | 'ai', key: '<kunci dashboard>', ... }
 * ============================================================ */

const AI_MODEL_DIIZINKAN = ['claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-opus-5-5'];
const AI_MAKS_PER_HARI = 30;        // pengaman biaya: maks panggilan Analisis AI per hari
const AI_MAKS_KARAKTER = 16000;     // ringkasan yang dikirim ke Claude dipotong di sini

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    cekKunciDashboard_(body.key);
    if (body.api === 'ping') {
      return json_({ ok: true, aiAktif: !!prop_('ANTHROPIC_API_KEY'), namaFile: ss_().getName() });
    }
    if (body.api === 'data') return json_(Object.assign({ ok: true }, dataDashboard_()));
    if (body.api === 'ai') return json_(Object.assign({ ok: true }, analisisAI_(body)));
    throw new Error('API tidak dikenal.');
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err).replace('[VALIDASI] ', '') });
  }
}

function dataDashboard_() {
  const ss = ss_();
  const shB = ss.getSheetByName(CFG.SH_BELANJA), shO = ss.getSheetByName(CFG.SH_OMZET);
  const tgl = v => (v instanceof Date) ? fmt_(v, 'yyyy-MM-dd') : String(v || '').slice(0, 10);
  const wkt = v => (v instanceof Date) ? v.toISOString() : String(v || '');

  // belanja: [tanggal, bulan, brand, kodeStore, pic, kategori, bahan, qty, satuan, harga, total, supplier, flag, idKiriman, waktuInput, catatan, linkFotoNota]
  const belanja = shB.getLastRow() < 2 ? [] : shB.getRange(2, 1, shB.getLastRow() - 1, 19).getValues()
    .filter(r => r[0] !== '' && r[5] !== '')
    .map(r => [tgl(r[2]), String(r[3]), String(r[4]), String(r[5]), String(r[7]), String(r[8]), String(r[9]),
      Number(r[10]) || 0, String(r[11]), Number(r[12]) || 0, Number(r[13]) || 0, String(r[14]), String(r[17]), String(r[18]), wkt(r[1]),
      String(r[15]), String(r[16])]);

  // omzet: [tanggal, bulan, brand, kodeStore, omzet, struk]
  const omzet = shO.getLastRow() < 2 ? [] : shO.getRange(2, 1, shO.getLastRow() - 1, 12).getValues()
    .filter(r => r[0] !== '' && r[5] !== '')
    .map(r => [tgl(r[2]), String(r[3]), String(r[4]), String(r[5]), Number(r[8]) || 0, r[9] === '' ? null : Number(r[9])]);

  // pembelian non-bahan: [tanggal, bulan, brand, kodeStore, pic, kategori, barang, qty, satuan, harga, total, dibayarDari, toko, catatan, linkFoto, idKiriman]
  const shP = ss.getSheetByName(CFG.SH_PEMBELIAN);
  const pembelian = (!shP || shP.getLastRow() < 2) ? [] : shP.getRange(2, 1, shP.getLastRow() - 1, 19).getValues()
    .filter(r => r[0] !== '' && r[5] !== '')
    .map(r => [tgl(r[2]), String(r[3]), String(r[4]), String(r[5]), String(r[7]), String(r[8]), String(r[9]),
      Number(r[10]) || 0, String(r[11]), Number(r[12]) || 0, Number(r[13]) || 0, String(r[14]), String(r[15]), String(r[16]), String(r[17]), String(r[18])]);

  // kas: saldo awal per outlet & mutasi manual (setoran ke HO, tambahan modal, koreksi)
  const kasAwal = bacaDenganPeriode_(ss, CFG.SH_KAS_AWAL, r => [String(r[0]).trim(), tgl(r[1]), Number(r[2]) || 0]).filter(r => r[0] && r[1]);
  const mutasiKas = bacaDenganPeriode_(ss, CFG.SH_MUTASI_KAS, r => [tgl(r[0]), String(r[1]).trim(), String(r[2]).trim(), String(r[3] || ''), Number(r[4]) || 0])
    .filter(r => r[0] && r[1] && r[4]);

  // target per outlet (kosong = belum ditentukan). Persen boleh diisi 32 / 32% / 0,32.
  const persen = v => { const n = Number(v); return v === '' || !isFinite(n) || n <= 0 ? null : n > 1 ? n / 100 : n; };
  const target = bacaDenganPeriode_(ss, CFG.SH_TARGET, r => [String(r[0]).trim(), Number(r[1]) > 0 ? Number(r[1]) : null, persen(r[2]), persen(r[3])])
    .filter(r => r[0] && (r[1] || r[2] || r[3]));

  const tren = ss.getSheetByName(CFG.SH_TREN);
  const batas = tren ? Number(tren.getRange('F1').getValue()) || CFG.BATAS_FOOD_COST : CFG.BATAS_FOOD_COST;
  const bulanDipakai = new Set(belanja.map(r => r[1]).concat(omzet.map(r => r[1]), pembelian.map(r => r[1])));

  return {
    namaFile: ss.getName(),
    diambil: new Date().toISOString(),
    batasFoodCost: batas,
    stores: bacaStore_(ss).map(s => ({ kode: s.kode, brand: s.brand, nama: s.nama, aktif: s.aktif })), // tanpa PIN
    bahan: bacaBahan_(ss).map(b => ({ nama: b.nama, kategori: b.kategori, satuan: b.satuan, brand: b.brand, acuan: b.hargaAcuan })),
    belanja: belanja,
    omzet: omzet,
    pembelian: pembelian,
    kasAwal: kasAwal,
    target: target,
    mutasiKas: mutasiKas,
    biaya: biayaDashboard_(ss, bulanDipakai)
  };
}

/** Hanya dipanggil saat tombol "Analisis AI" diklik. Yang dikirim = ringkasan anomali, bukan data mentah. */
function analisisAI_(body) {
  const apiKey = prop_('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('API key Claude belum di-set. Di Google Sheet: menu 🍜 HPP > Set API key Claude.');

  // pengaman biaya harian
  const props = PropertiesService.getScriptProperties();
  const hari = fmt_(new Date(), 'yyyy-MM-dd');
  const hitung = JSON.parse(props.getProperty('AI_HITUNG') || '{}');
  const n = hitung.hari === hari ? hitung.n : 0;
  if (n >= AI_MAKS_PER_HARI) throw new Error('Batas ' + AI_MAKS_PER_HARI + ' analisis AI per hari sudah tercapai. Coba lagi besok.');

  const model = AI_MODEL_DIIZINKAN.indexOf(body.model) > -1 ? body.model : AI_MODEL_DIIZINKAN[0];
  const ringkasan = String(body.ringkasan || '').slice(0, AI_MAKS_KARAKTER);
  if (!ringkasan) throw new Error('Ringkasan kosong.');

  const system = [
    'Kamu analis operasional & food cost untuk grup restoran di Indonesia (brand berbahan utama babi: gukbap Korea, bakmi, dll).',
    'Kamu menerima ringkasan anomali yang sudah dideteksi secara statistik dari data belanja bahan baku, omzet, dan biaya operasional (karyawan, sewa, listrik, pembelian non-bahan outlet, dll) tiap outlet, plus laba rugi & margin per outlet kalau datanya ada.',
    'Tugas: jelaskan dalam Bahasa Indonesia santai-profesional, singkat dan to the point:',
    '1) 3–5 temuan paling penting untuk profit (urut dari dampak Rupiah terbesar), 2) kemungkinan penyebab masing-masing (harga supplier, porsi, waste, pencurian, salah input, biaya karyawan/sewa terlalu berat, dll),',
    '3) apa yang harus dicek atau diperbaiki HO minggu ini (konkret, per outlet), 4) outlet dengan margin terendah dan apa tuas terbesarnya, 5) catatan kualitas data kalau ada.',
    'Aturan: pakai hanya angka yang ada di ringkasan, jangan mengarang angka. Kalau datanya belum cukup untuk menyimpulkan, bilang terus terang.',
    'Format: judul pendek per bagian + poin-poin. Maksimal ±350 kata.'
  ].join('\n');

  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: model, max_tokens: 1200, system: system, messages: [{ role: 'user', content: ringkasan }] }),
    muteHttpExceptions: true
  });
  const out = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() !== 200) {
    throw new Error('Claude API error ' + res.getResponseCode() + ': ' + ((out.error && out.error.message) || res.getContentText().slice(0, 200)));
  }
  props.setProperty('AI_HITUNG', JSON.stringify({ hari: hari, n: n + 1 }));
  return {
    teks: (out.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n'),
    model: model,
    usage: out.usage || {},
    sisaHariIni: AI_MAKS_PER_HARI - n - 1
  };
}

function cekKunciDashboard_(key) {
  const k = prop_('DASHBOARD_KEY');
  if (!k) throw new Error('Kunci dashboard belum dibuat. Di Google Sheet: menu 🍜 HPP > Buat / ganti kunci dashboard.');
  if (String(key || '') !== k) throw new Error('Kunci dashboard salah.');
}

function buatKunciDashboard() {
  const kunci = Utilities.getUuid().replace(/-/g, '').slice(0, 24);
  PropertiesService.getScriptProperties().setProperty('DASHBOARD_KEY', kunci);
  const url = ScriptApp.getService().getUrl();
  const pesan = 'Kunci dashboard baru:\n\n' + kunci + '\n\nURL Apps Script:\n' + (url || '(belum di-deploy)') +
    '\n\nMasukkan keduanya di menu Pengaturan dashboard. Kunci lama otomatis tidak berlaku.';
  try { SpreadsheetApp.getUi().alert(pesan); } catch (e) { Logger.log(pesan); }
}

function setApiKeyClaude() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('API key Claude', 'Paste API key dari console.anthropic.com (diawali sk-ant-). Disimpan di Script Properties, tidak terlihat di sheet.\nKosongkan lalu OK untuk menghapus.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const v = r.getResponseText().trim();
  const props = PropertiesService.getScriptProperties();
  if (v) { props.setProperty('ANTHROPIC_API_KEY', v); ui.alert('API key tersimpan. Tombol Analisis AI di dashboard sudah bisa dipakai.'); }
  else { props.deleteProperty('ANTHROPIC_API_KEY'); ui.alert('API key dihapus. Analisis AI nonaktif.'); }
}

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }

/**
 * Jalankan sekali dari menu 🍜 HPP: memunculkan pop-up izin Google untuk "menghubungi layanan luar"
 * (dibutuhkan Analisis AI) dan mengecek apakah API key Claude valid. Tidak memakai token.
 */
function tesKoneksiClaude() {
  let ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  const key = prop_('ANTHROPIC_API_KEY');
  let pesan;
  if (!key) {
    UrlFetchApp.fetch('https://api.anthropic.com/v1/models', { muteHttpExceptions: true }); // cukup untuk memicu izin
    pesan = 'Izin koneksi luar sudah aktif. Tapi API key Claude belum di-set: menu 🍜 HPP > Set API key Claude.';
  } else {
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, muteHttpExceptions: true
    });
    const kode = res.getResponseCode();
    pesan = kode === 200 ? '✅ Koneksi ke Claude OK. Tombol Analisis AI di dashboard sudah bisa dipakai.'
      : kode === 401 ? '❌ API key Claude ditolak (401). Cek lagi key-nya di console.anthropic.com lalu set ulang.'
      : '⚠️ Claude menjawab kode ' + kode + ': ' + res.getContentText().slice(0, 200);
  }
  Logger.log(pesan);
  if (ui) ui.alert(pesan);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Data master untuk app HP. PIN tidak pernah dikirim ke HP. */
function getMasterData(storeCode) {
  const ss = ss_();
  const stores = bacaStore_(ss).filter(s => s.aktif)
    .map(s => ({ kode: s.kode, brand: s.brand, nama: s.nama }));
  const bahan = bacaBahan_(ss).filter(b => b.aktif)
    .map(b => ({ nama: b.nama, kategori: b.kategori, satuan: b.satuan, brand: b.brand, acuan: b.hargaAcuan }));
  return {
    stores: stores,
    bahan: bahan,
    hargaTerakhir: storeCode ? hargaTerakhir_(ss, storeCode) : {},
    katPembelian: KAT_PEMBELIAN,
    dibayarDari: DIBAYAR_DARI,
    barangPembelian: barangPembelian_(ss),
    waktu: new Date().toISOString()
  };
}

/** Cek kode store + PIN saat HP pertama kali di-setup. */
function verifyStore(kode, pin) {
  const s = cekStore_(ss_(), kode, pin);
  return { kode: s.kode, brand: s.brand, nama: s.nama };
}

/** Simpan 1 kiriman belanja (banyak bahan sekaligus). Aman di-retry (idempotent). */
function submitBelanja(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = ss_();
    const store = cekStore_(ss, p.storeCode, p.pin);
    const sh = ss.getSheetByName(CFG.SH_BELANJA);
    if (!p.idKiriman) throw validasi_('ID kiriman kosong.');
    if (sudahAda_(sh, 19, p.idKiriman)) return { ok: true, duplikat: true };

    if (!p.items || !p.items.length) throw validasi_('Belum ada bahan yang diisi.');
    const tgl = parseTanggal_(p.tanggal);
    const bulan = fmt_(tgl, 'yyyy-MM');
    const master = mapBahan_(ss);
    const now = new Date();

    // Nama bahan WAJIB persis dari MASTER_BAHAN (app pakai dropdown) → tidak ada variasi nama/typo.
    // Satuan selalu ikut master supaya harga per satuan bisa dibandingkan antar store.
    const rows = p.items.map((it, i) => {
      const nama = String(it.bahan || '').trim();
      const qty = Number(it.qty);
      const harga = Number(it.harga);
      if (!nama) throw validasi_('Bahan no. ' + (i + 1) + ' belum dipilih.');
      const m = master[nama.toLowerCase()];
      if (!m || !m.aktif) throw validasi_('Bahan "' + nama + '" tidak ada di daftar master. Minta HO tambahkan di MASTER_BAHAN.');
      if (!(qty > 0)) throw validasi_('Qty "' + m.nama + '" harus lebih dari 0.');
      if (!(harga >= 0)) throw validasi_('Harga "' + m.nama + '" tidak valid.');

      const flags = [];
      if (m.hargaAcuan > 0 && harga > m.hargaAcuan * (1 + CFG.TOLERANSI_HARGA)) {
        flags.push('HARGA > ACUAN +' + Math.round((harga / m.hargaAcuan - 1) * 100) + '%');
      }
      return [
        p.idKiriman + '-' + (i + 1), now, tgl, bulan, store.brand, store.kode, store.nama, String(p.pic || ''),
        m.kategori, m.nama, qty, m.satuan, harga, Math.round(qty * harga),
        String(p.supplier || ''), String(p.catatan || ''), '', flags.join('; '), p.idKiriman
      ];
    });

    // Foto baru disimpan setelah semua bahan lolos validasi (biar tidak ada foto yatim di Drive)
    if (p.foto && p.foto.data) {
      const fotoUrl = simpanFoto_(p.foto, store, p.tanggal);
      rows.forEach(r => { r[16] = fotoUrl; });
    }

    sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    return { ok: true, baris: rows.length, total: rows.reduce((s, r) => s + r[13], 0) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Pembelian di luar bahan baku (peralatan, kebersihan, ATK, dll). Masuk sheet INPUT_PEMBELIAN,
 * TIDAK dihitung ke HPP/food cost, tapi mengurangi laba operasional & kas. Aman di-retry (idempotent).
 */
function submitPembelian(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = ss_();
    const store = cekStore_(ss, p.storeCode, p.pin);
    const sh = ss.getSheetByName(CFG.SH_PEMBELIAN);
    if (!sh) throw validasi_('Sheet ' + CFG.SH_PEMBELIAN + ' belum ada. Minta HO jalankan menu 🍜 HPP > Setup.');
    if (!p.idKiriman) throw validasi_('ID kiriman kosong.');
    if (sudahAda_(sh, 19, p.idKiriman)) return { ok: true, duplikat: true };
    if (!p.items || !p.items.length) throw validasi_('Belum ada barang yang diisi.');
    const dari = String(p.dibayarDari || '').trim();
    if (DIBAYAR_DARI.indexOf(dari) < 0) throw validasi_('Pilih "Dibayar dari".');

    const tgl = parseTanggal_(p.tanggal);
    const bulan = fmt_(tgl, 'yyyy-MM');
    const now = new Date();
    const rows = p.items.map((it, i) => {
      const nama = String(it.barang || '').trim().replace(/\s+/g, ' ');
      const kat = String(it.kategori || '').trim();
      const qty = Number(it.qty), harga = Number(it.harga);
      const satuan = String(it.satuan || '').trim() || 'pcs';
      if (!nama) throw validasi_('Nama barang no. ' + (i + 1) + ' kosong.');
      if (KAT_PEMBELIAN.indexOf(kat) < 0) throw validasi_('Kategori "' + nama + '" belum dipilih.');
      if (!(qty > 0)) throw validasi_('Qty "' + nama + '" harus lebih dari 0.');
      if (!(harga > 0)) throw validasi_('Harga "' + nama + '" tidak valid.');
      return [p.idKiriman + '-' + (i + 1), now, tgl, bulan, store.brand, store.kode, store.nama, String(p.pic || ''),
        kat, nama, qty, satuan, harga, Math.round(qty * harga), dari, String(p.toko || ''), String(p.catatan || ''), '', p.idKiriman];
    });
    if (p.foto && p.foto.data) {
      const fotoUrl = simpanFoto_(p.foto, store, p.tanggal);
      rows.forEach(r => { r[17] = fotoUrl; });
    }
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    return { ok: true, baris: rows.length, total: rows.reduce((s, r) => s + r[13], 0) };
  } finally {
    lock.releaseLock();
  }
}

/** Nama barang pembelian yang pernah dipakai (untuk saran ketik di app, biar penulisan seragam). */
function barangPembelian_(ss) {
  const sh = ss.getSheetByName(CFG.SH_PEMBELIAN);
  if (!sh || sh.getLastRow() < 2) return [];
  const n = Math.min(CFG.MAKS_BARIS_HARGA_TERAKHIR, sh.getLastRow() - 1);
  const v = sh.getRange(sh.getLastRow() - n + 1, 9, n, 4).getValues(); // Kategori, Nama Barang, Qty, Satuan
  const out = new Map();
  v.forEach(r => { const nama = String(r[1]).trim(); if (nama) out.set(nama.toLowerCase(), { nama: nama, kategori: String(r[0]), satuan: String(r[3]) }); });
  return [...out.values()].slice(-300);
}

/** Omzet harian: 1 angka per store per tanggal. Kirim ulang tanggal sama = menimpa. */
function submitOmzet(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = ss_();
    const store = cekStore_(ss, p.storeCode, p.pin);
    const sh = ss.getSheetByName(CFG.SH_OMZET);
    if (!p.idKiriman) throw validasi_('ID kiriman kosong.');
    if (sudahAda_(sh, 12, p.idKiriman)) return { ok: true, duplikat: true };

    const tgl = parseTanggal_(p.tanggal);
    const omzet = Number(p.omzet);
    if (!(omzet > 0)) throw validasi_('Omzet harus lebih dari 0.');
    const struk = (p.struk === '' || p.struk == null) ? '' : Number(p.struk);
    const row = [p.idKiriman + '-1', new Date(), tgl, fmt_(tgl, 'yyyy-MM'), store.brand, store.kode, store.nama,
      String(p.pic || ''), omzet, struk, String(p.catatan || ''), p.idKiriman];

    const last = sh.getLastRow();
    if (last >= 2) {
      const key = fmt_(tgl, 'yyyy-MM-dd');
      const v = sh.getRange(2, 1, last - 1, 12).getValues();
      for (let i = 0; i < v.length; i++) {
        if (String(v[i][5]) === store.kode && v[i][2] instanceof Date && fmt_(v[i][2], 'yyyy-MM-dd') === key) {
          row[10] = (row[10] ? row[10] + ' | ' : '') + 'diperbarui ' + fmt_(new Date(), 'dd/MM HH:mm');
          sh.getRange(i + 2, 1, 1, 12).setValues([row]);
          return { ok: true, diperbarui: true };
        }
      }
    }
    sh.getRange(last + 1, 1, 1, 12).setValues([row]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
 *  SETUP SHEET
 * ============================================================ */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🍜 HPP')
    .addItem('Setup / rapikan struktur', 'setup')
    .addItem('Buat tab per store', 'buatTabPerStore')
    .addSeparator()
    .addItem('Lihat URL app HP', 'infoApp')
    .addSeparator()
    .addItem('🔑 Buat / ganti kunci dashboard', 'buatKunciDashboard')
    .addItem('✨ Set API key Claude (Analisis AI)', 'setApiKeyClaude')
    .addItem('✨ Tes koneksi Claude', 'tesKoneksiClaude')
    .addSeparator()
    .addSubMenu(ui.createMenu('🧪 Data dummy (uji coba)')
      .addItem('Isi data dummy 6 bulan', 'isiDataDummy')
      .addItem('Hapus semua data dummy', 'hapusDataDummy'))
    .addToUi();
}

/* ============================================================
 *  DATA DUMMY — untuk uji coba dashboard sebelum data asli terkumpul.
 *  Semua baris ditandai: ID diawali "DUMMY-" (INPUT_BELANJA/INPUT_OMZET)
 *  atau "DATA DUMMY" (MASTER_KARYAWAN, BIAYA_TETAP, BIAYA_BULANAN),
 *  jadi bisa dihapus bersih tanpa menyentuh data asli.
 *  Generatornya sama dengan data demo di dashboard (fungsi buatDemo di bagian bawah file).
 * ============================================================ */
const PENANDA_DUMMY = 'DATA DUMMY';

function isiDataDummy() {
  let ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { /* dijalankan dari editor */ }
  if (ui) {
    const r = ui.alert('Isi data dummy',
      'Menambah ±6 bulan data contoh (belanja, omzet, pembelian non-bahan, karyawan, sewa & tagihan) untuk outlet UG-01, UG-02, AW-01, BB-01, DW-01. ' +
      'Semua ditandai DUMMY dan bisa dihapus lewat menu. Data dummy lama diganti. Lanjut?', ui.ButtonSet.YES_NO);
    if (r !== ui.Button.YES) return;
  }
  const ss = ss_();
  const lama = hapusDummy_(ss);
  const d = buatDemo(fmt_(new Date(), 'yyyy-MM-dd'));
  const namaStore = {};
  bacaStore_(ss).forEach(s => { namaStore[s.kode] = s.nama; });
  const tgl = s => Utilities.parseDate(s, CFG.TZ, 'yyyy-MM-dd');
  const waktu = s => Utilities.parseDate(s + ' 21:00', CFG.TZ, 'yyyy-MM-dd HH:mm');

  const belanja = d.belanja.map(r => ['DUMMY-' + r.id, waktu(r.tgl), tgl(r.tgl), r.bulan, r.brand, r.store, namaStore[r.store] || r.store,
    'Dummy', r.kategori, r.bahan, r.qty, r.satuan, r.harga, r.total, 'Supplier dummy', PENANDA_DUMMY, '', '', 'DUMMY-' + r.id.replace(/-\d+$/, '')]);
  const omzet = d.omzet.map((r, i) => ['DUMMY-O' + (i + 1) + '-1', waktu(r.tgl), tgl(r.tgl), r.bulan, r.brand, r.store, namaStore[r.store] || r.store,
    'Dummy', r.omzet, r.struk, PENANDA_DUMMY, 'DUMMY-O' + (i + 1)]);
  const karyawan = [];
  d.rincianKaryawan.forEach(x => {
    for (let i = 1; i <= x.orang; i++) {
      const pokok = Math.round(x.biaya * 0.8 / 1000) * 1000, tunj = Math.round(x.biaya * 0.12 / 1000) * 1000;
      karyawan.push([x.store, 'Dummy ' + x.jabatan + ' ' + i, x.jabatan, pokok, tunj, x.biaya - pokok - tunj, '', '', PENANDA_DUMMY]);
    }
  });
  const tetap = d.rincianTetap.map(x => [x.store, x.kategori, PENANDA_DUMMY, x.jumlah, '', '']);
  const bulanan = d.biaya.filter(x => x.kelompok === 'Operasional').map(x => [x.bulan, x.store, x.kategori, PENANDA_DUMMY, x.jumlah]);
  const pembelian = (d.pembelian || []).map(r => ['DUMMY-' + r.id, waktu(r.tgl), tgl(r.tgl), r.bulan, r.brand, r.store, namaStore[r.store] || r.store,
    'Dummy', r.kategori, r.barang, r.qty, r.satuan, r.harga, r.total, r.dibayarDari, 'Toko dummy', PENANDA_DUMMY, '', 'DUMMY-' + r.id.replace(/-\d+$/, '')]);

  tulisDiBawah_(ss.getSheetByName(CFG.SH_BELANJA), belanja);
  tulisDiBawah_(ss.getSheetByName(CFG.SH_OMZET), omzet);
  tulisDiBawah_(ss.getSheetByName(CFG.SH_KARYAWAN), karyawan);
  tulisDiBawah_(ss.getSheetByName(CFG.SH_TETAP), tetap);
  tulisDiBawah_(ss.getSheetByName(CFG.SH_BULANAN), bulanan);
  tulisDiBawah_(ss.getSheetByName(CFG.SH_PEMBELIAN), pembelian);

  const pesan = 'Data dummy terisi: ' + belanja.length + ' baris belanja, ' + omzet.length + ' baris omzet, ' + karyawan.length +
    ' karyawan, ' + tetap.length + ' biaya tetap, ' + bulanan.length + ' tagihan bulanan, ' + pembelian.length + ' pembelian non-bahan' +
    (lama.total ? ' (menggantikan ' + lama.total + ' baris dummy lama)' : '') + '.';
  Logger.log(pesan);
  if (ui) ui.alert(pesan); else { try { ss.toast(pesan, 'HPP', 8); } catch (e) {} }
}

function hapusDataDummy() {
  let ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  if (ui) {
    const r = ui.alert('Hapus data dummy', 'Semua baris bertanda DUMMY di INPUT_BELANJA, INPUT_OMZET, INPUT_PEMBELIAN, MASTER_KARYAWAN, BIAYA_TETAP & BIAYA_BULANAN akan dihapus. Data asli tidak disentuh. Lanjut?', ui.ButtonSet.YES_NO);
    if (r !== ui.Button.YES) return;
  }
  const h = hapusDummy_(ss_());
  const pesan = h.total ? 'Terhapus ' + h.total + ' baris dummy (belanja ' + h.belanja + ', omzet ' + h.omzet + ', karyawan ' + h.karyawan +
    ', biaya tetap ' + h.tetap + ', tagihan ' + h.bulanan + ', pembelian ' + h.pembelian + ').' : 'Tidak ada data dummy.';
  Logger.log(pesan);
  if (ui) ui.alert(pesan);
}

function hapusDummy_(ss) {
  const idDummy = v => String(v).indexOf('DUMMY-') === 0;
  const tanda = v => String(v) === PENANDA_DUMMY;
  const h = {
    belanja: hapusBarisJika_(ss.getSheetByName(CFG.SH_BELANJA), 18, idDummy),
    omzet: hapusBarisJika_(ss.getSheetByName(CFG.SH_OMZET), 11, idDummy),
    karyawan: hapusBarisJika_(ss.getSheetByName(CFG.SH_KARYAWAN), 8, tanda),
    tetap: hapusBarisJika_(ss.getSheetByName(CFG.SH_TETAP), 2, tanda),
    bulanan: hapusBarisJika_(ss.getSheetByName(CFG.SH_BULANAN), 3, tanda),
    pembelian: hapusBarisJika_(ss.getSheetByName(CFG.SH_PEMBELIAN), 0, idDummy)
  };
  h.total = h.belanja + h.omzet + h.karyawan + h.tetap + h.bulanan + h.pembelian;
  return h;
}

/** Hapus baris yang kolom ke-idx (0-based) memenuhi cocok(); baris lain ditulis ulang rapat ke atas. */
function hapusBarisJika_(sh, idx, cocok) {
  if (!sh || sh.getLastRow() < 2) return 0;
  const n = sh.getLastRow() - 1, lebar = sh.getLastColumn();
  const rng = sh.getRange(2, 1, n, lebar), v = rng.getValues();
  const simpan = v.filter(r => !cocok(r[idx]));
  const dihapus = v.length - simpan.length;
  if (!dihapus) return 0;
  rng.clearContent();
  if (simpan.length) sh.getRange(2, 1, simpan.length, lebar).setValues(simpan);
  return dihapus;
}

function tulisDiBawah_(sh, rows) {
  if (!sh || !rows.length) return;
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Buka Apps Script lewat menu Extensions > Apps Script di Google Sheet, lalu jalankan setup lagi.');
  ss.setSpreadsheetTimeZone(CFG.TZ);
  PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());

  // --- INPUT_BELANJA ---
  const b = siapkanSheet_(ss, CFG.SH_BELANJA, KOLOM.INPUT_BELANJA, '#9A3412');
  b.getRange('B:B').setNumberFormat('yyyy-mm-dd hh:mm');
  b.getRange('C:C').setNumberFormat('yyyy-mm-dd');
  b.getRange('D:D').setNumberFormat('@');
  b.getRange('K:K').setNumberFormat('#,##0.###');
  b.getRange('M:N').setNumberFormat('#,##0');
  b.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$R2<>""')
      .setBackground('#FDE8E6').setRanges([b.getRange('A2:S')]).build()
  ]);
  lebarKolom_(b, [150, 130, 105, 70, 120, 80, 170, 90, 150, 170, 60, 60, 110, 110, 120, 150, 150, 170, 120]);

  // --- INPUT_OMZET ---
  const o = siapkanSheet_(ss, CFG.SH_OMZET, KOLOM.INPUT_OMZET, '#1F6F4A');
  o.getRange('B:B').setNumberFormat('yyyy-mm-dd hh:mm');
  o.getRange('C:C').setNumberFormat('yyyy-mm-dd');
  o.getRange('D:D').setNumberFormat('@');
  o.getRange('I:J').setNumberFormat('#,##0');
  lebarKolom_(o, [150, 130, 105, 70, 120, 80, 170, 90, 120, 100, 180, 120]);

  // --- INPUT_PEMBELIAN (non-bahan, tidak masuk HPP) ---
  const pb = siapkanSheet_(ss, CFG.SH_PEMBELIAN, KOLOM.INPUT_PEMBELIAN, '#6D28D9');
  pb.getRange('B:B').setNumberFormat('yyyy-mm-dd hh:mm');
  pb.getRange('C:C').setNumberFormat('yyyy-mm-dd');
  pb.getRange('D:D').setNumberFormat('@');
  pb.getRange('K:K').setNumberFormat('#,##0.###');
  pb.getRange('M:N').setNumberFormat('#,##0');
  pb.getRange('I2:I5000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(KAT_PEMBELIAN, true).setAllowInvalid(true).build());
  pb.getRange('O2:O5000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(DIBAYAR_DARI, true).setAllowInvalid(true).build());
  pb.getRange('A1').setNote('Pembelian di luar bahan baku (peralatan, kebersihan, ATK, dll) dari app HP tab Pembelian. Tidak masuk HPP / food cost, tapi mengurangi laba operasional.');
  pb.getRange('O1').setNote('Sumber uang. "Kas outlet (tunai)" mengurangi kas outlet; "Uang pribadi" = perlu diganti (reimburse); "Transfer / kartu HO" = dibayar pusat.');
  lebarKolom_(pb, [150, 130, 105, 70, 120, 80, 170, 90, 160, 190, 60, 60, 110, 110, 150, 140, 170, 150, 120]);

  // --- MASTER_STORE ---
  const s = siapkanSheet_(ss, CFG.SH_STORE, KOLOM.MASTER_STORE, '#374151');
  s.getRange('E:E').setNumberFormat('@');
  if (s.getLastRow() < 2) {
    s.getRange(2, 1, CONTOH_STORE.length, 6).setValues(CONTOH_STORE);
  }
  s.getRange(2, 6, Math.max(s.getLastRow() - 1, 1) + 20, 1).insertCheckboxes();
  s.getRange('E1').setNote('PIN 4–6 angka per outlet. Tim store diminta PIN ini saat setup HP. Kosongkan kalau tidak pakai PIN.');
  s.getRange('A1').setNote('Kode unik & jangan diubah setelah dipakai (dipakai untuk menghubungkan data).');
  s.getRange('F1').setNote('Centang = outlet muncul di app HP. Outlet baru wajib dicentang.');
  lebarKolom_(s, [90, 140, 220, 100, 70, 60]);

  // --- MASTER_BAHAN ---
  const m = siapkanSheet_(ss, CFG.SH_BAHAN, KOLOM.MASTER_BAHAN, '#374151');
  if (m.getLastRow() < 2) {
    m.getRange(2, 1, CONTOH_BAHAN.length, 6)
      .setValues(CONTOH_BAHAN.map(r => [r[0], r[1], r[2], r[3], '', true]));
  }
  const nb = Math.max(m.getLastRow() - 1, 1) + 50;
  m.getRange(2, 2, nb, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(KATEGORI, true).setAllowInvalid(false).build());
  m.getRange(2, 6, nb, 1).insertCheckboxes();
  m.getRange('E:E').setNumberFormat('#,##0');
  m.getRange('A1').setNote('Nama ini yang muncul di dropdown app. Jangan ganti nama bahan yang sudah dipakai: tambah baris baru, lalu hilangkan centang Aktif di baris lama. Nama dobel otomatis merah.');
  m.getRange('C1').setNote('Satuan baku. Semua input store otomatis pakai satuan ini (harga diisi per satuan ini).');
  m.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND($A2<>"", COUNTIF($A:$A, $A2)>1)')
      .setBackground('#FDE8E6').setFontColor('#B42318').setRanges([m.getRange('A2:A')]).build()
  ]);
  m.getRange('D1').setNote('Isi "Semua", atau nama brand dipisah koma. Menentukan bahan mana yang muncul di app tiap brand.');
  m.getRange('E1').setNote('Opsional. Kalau diisi, input yang lebih mahal dari acuan +' +
    Math.round(CFG.TOLERANSI_HARGA * 100) + '% otomatis di-flag.');
  lebarKolom_(m, [200, 170, 70, 220, 110, 60]);

  siapkanBiaya_(ss);
  siapkanKas_(ss);
  siapkanTarget_(ss);
  siapkanRekap_(ss);
  siapkanTren_(ss);
  siapkanProfit_(ss);
  siapkanCashflow_(ss);
  siapkanKamus_(ss);

  // Hapus sheet kosong bawaan
  ss.getSheets().forEach(sh => {
    if (/^(Sheet|Lembar|Sheet )\s?1$/i.test(sh.getName()) && sh.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(sh);
    }
  });
  ss.setActiveSheet(ss.getSheetByName(CFG.SH_STORE));
  try { ss.toast('Struktur siap. Edit MASTER_STORE & MASTER_BAHAN, lalu Deploy web app.', 'HPP', 8); } catch (e) {}
  Logger.log('Setup selesai: ' + ss.getUrl());
}

function siapkanRekap_(ss) {
  const sh = ss.getSheetByName(CFG.SH_REKAP) || ss.insertSheet(CFG.SH_REKAP);
  sh.clear();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations(); // validasi lama bisa menolak isi baru
  sh.getRange('A1').setValue('Bulan (yyyy-MM):').setFontWeight('bold');
  sh.getRange('B1').setNumberFormat('@').setValue(fmt_(new Date(), 'yyyy-MM'))
    .setBackground('#FEF3C7').setFontWeight('bold');
  sh.getRange('C1').setValue('← ganti bulan di sini').setFontColor('#6B7280');
  sh.getRange('A2').setValue('Food cost % = total belanja ÷ omzet. Ini pendekatan (belanja ≠ pemakaian karena stok belum dihitung).')
    .setFontStyle('italic').setFontColor('#6B7280');

  const h = ['Kode Store', 'Brand', 'Nama Store', 'Total Belanja', 'Omzet', 'Food Cost %', 'Jml Baris Belanja', 'Input Terakhir'];
  sh.getRange(3, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#9A3412').setFontColor('#FFFFFF');
  sh.setFrozenRows(3);

  const B = CFG.SH_BELANJA, O = CFG.SH_OMZET, S = CFG.SH_STORE;
  sh.getRange('A4').setFormula('=FILTER(' + S + '!A2:C, ' + S + '!A2:A<>"")');
  sh.getRange('D4').setFormula('=MAP(A4:A200, LAMBDA(k, IF(k="", "", SUMIFS(' + B + '!N:N, ' + B + '!F:F, k, ' + B + '!D:D, $B$1))))');
  sh.getRange('E4').setFormula('=MAP(A4:A200, LAMBDA(k, IF(k="", "", SUMIFS(' + O + '!I:I, ' + O + '!F:F, k, ' + O + '!D:D, $B$1))))');
  sh.getRange('F4').setFormula('=MAP(D4:D200, E4:E200, LAMBDA(b, o, IF(OR(b="", o="", o=0), "", b/o)))');
  sh.getRange('G4').setFormula('=MAP(A4:A200, LAMBDA(k, IF(k="", "", COUNTIFS(' + B + '!F:F, k, ' + B + '!D:D, $B$1))))');
  sh.getRange('H4').setFormula('=MAP(A4:A200, LAMBDA(k, IF(k="", "", LET(m, MAXIFS(' + B + '!B:B, ' + B + '!F:F, k), IF(m=0, "", m)))))');

  sh.getRange('D4:E200').setNumberFormat('#,##0');
  sh.getRange('F4:F200').setNumberFormat('0.0%');
  sh.getRange('H4:H200').setNumberFormat('yyyy-mm-dd hh:mm');
  lebarKolom_(sh, [110, 140, 220, 130, 130, 100, 130, 140]);

  // Dropdown bulan di B1: daftar diambil otomatis dari bulan yang ada datanya (+ bulan ini), terbaru di atas.
  sh.getRange('Z1').setValue('Daftar bulan (otomatis)');
  sh.getRange('Z2').setFormula('=LET(b, VSTACK(' + B + '!D2:D, ' + O + '!D2:D, TEXT(TODAY(), "yyyy-mm")), SORT(UNIQUE(FILTER(b, b<>"")), 1, FALSE))');
  sh.getRange('B1').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(sh.getRange('Z2:Z200'), true).setAllowInvalid(false)
    .setHelpText('Pilih bulan dari dropdown').build());
  sh.getRange('C1').setValue('← klik ▾ untuk pilih bulan');
  sh.hideColumns(26); // kolom Z = bantuan
}

/** REKAP_TREN: 12 bulan terakhir berjejer per store. B1 memilih angka yang ditampilkan. */
function siapkanTren_(ss) {
  const sh = ss.getSheetByName(CFG.SH_TREN) || ss.insertSheet(CFG.SH_TREN);
  sh.clear();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations(); // validasi lama bisa menolak isi baru
  sh.clearConditionalFormatRules();
  const B = CFG.SH_BELANJA, O = CFG.SH_OMZET, S = CFG.SH_STORE;

  sh.getRange('A1').setValue('Tampilkan:').setFontWeight('bold');
  sh.getRange('B1').setValue(METRIK_TREN[0]).setBackground('#FEF3C7').setFontWeight('bold')
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(METRIK_TREN, true).setAllowInvalid(false).build());
  sh.getRange('C1').setValue('← klik ▾ untuk ganti').setFontColor('#6B7280');
  sh.getRange('E1').setValue('Batas food cost:').setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange('F1').setValue(CFG.BATAS_FOOD_COST).setNumberFormat('0%').setBackground('#FEF3C7').setFontWeight('bold');
  sh.getRange('G1').setValue('← sel merah = food cost di atas batas ini').setFontColor('#6B7280');
  sh.getRange('A2').setValue('12 bulan terakhir, bulan terbaru paling kanan. Baris SEMUA = gabungan semua store. Food cost berbasis pembelian.')
    .setFontStyle('italic').setFontColor('#6B7280');

  sh.getRange('A3:B3').setValues([['Kode Store', 'Nama Store']]);
  sh.getRange('C3').setFormula('=MAP(SEQUENCE(1, 12, 11, -1), LAMBDA(i, TEXT(EDATE(TODAY(), -i), "yyyy-mm")))');
  sh.getRange('A3:N3').setFontWeight('bold').setBackground('#9A3412').setFontColor('#FFFFFF').setHorizontalAlignment('center');

  // Rumus 1 sel: pilih angka sesuai B1
  const nilai = (b, o) => 'IF($B$1="Total belanja", IF(' + b + '=0, "", ' + b + '), IF($B$1="Omzet", IF(' + o + '=0, "", ' + o + '), IF(' + o + '=0, "", ' + b + '/' + o + ')))';

  sh.getRange('A4:B4').setValues([['SEMUA', 'Total semua store']]);
  sh.getRange('C4').setFormula('=MAP(C3:N3, LAMBDA(m, LET(b, SUMIFS(' + B + '!N:N, ' + B + '!D:D, m), o, SUMIFS(' + O + '!I:I, ' + O + '!D:D, m), ' + nilai('b', 'o') + ')))');
  sh.getRange('A4:N4').setFontWeight('bold').setBackground('#FFF7ED');

  sh.getRange('A5').setFormula('=FILTER(HSTACK(' + S + '!A2:A, ' + S + '!C2:C), ' + S + '!A2:A<>"")');
  sh.getRange('C5').setFormula('=MAKEARRAY(COUNTA(A5:A200), 12, LAMBDA(r, c, LET(k, INDEX(A5:A200, r), m, INDEX(C3:N3, 1, c), ' +
    'b, SUMIFS(' + B + '!N:N, ' + B + '!F:F, k, ' + B + '!D:D, m), o, SUMIFS(' + O + '!I:I, ' + O + '!F:F, k, ' + O + '!D:D, m), ' + nilai('b', 'o') + ')))');

  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($B$1="Food cost %", ISNUMBER(C4), C4>$F$1)')
      .setBackground('#FDE8E6').setFontColor('#B42318').setBold(true)
      .setRanges([sh.getRange('C4:N200')]).build()
  ]);
  sh.setFrozenRows(3);
  sh.setFrozenColumns(2);
  lebarKolom_(sh, [100, 210, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90]);
  formatTren_(sh);
}

/** Simple trigger: ganti format angka REKAP_TREN saat pilihan di B1 berubah. */
function onEdit(e) {
  const r = e && e.range;
  if (!r) return;
  const sh = r.getSheet();
  if (sh.getName() === CFG.SH_TREN && r.getA1Notation() === 'B1') formatTren_(sh);
}

function formatTren_(sh) {
  const persen = String(sh.getRange('B1').getValue()) === 'Food cost %';
  sh.getRange('C4:N200').setNumberFormat(persen ? '0.0%' : '#,##0').setHorizontalAlignment('right');
}

/* ============================================================
 *  BIAYA OPERASIONAL & PROFIT
 *  - MASTER_KARYAWAN : 1 baris = 1 orang. Aktif di suatu bulan kalau Mulai ≤ akhir bulan
 *                      dan (Selesai kosong atau ≥ awal bulan). Dihitung penuh sebulan.
 *                      Naik gaji / pindah outlet: isi Selesai di baris lama, tambah baris baru.
 *  - BIAYA_TETAP     : biaya rutin per bulan (sewa ÷ 12 kalau bayar tahunan, internet, dll).
 *  - BIAYA_BULANAN   : tagihan yang berubah tiap bulan (listrik, air, perbaikan, dll).
 * ============================================================ */
function siapkanBiaya_(ss) {
  const vStore = SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getSheetByName(CFG.SH_STORE).getRange('A2:A200'), true).setAllowInvalid(false)
    .setHelpText('Pilih kode store dari MASTER_STORE').build();
  const vAngka = SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false)
    .setHelpText('Isi angka Rupiah tanpa titik, mis. 4500000').build();
  const vTanggal = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false)
    .setHelpText('Isi tanggal, mis. 2026-01-01').build();
  const vList = (arr) => SpreadsheetApp.newDataValidation().requireValueInList(arr, true).setAllowInvalid(true).build();
  const BIRU = '#1E40AF';

  const k = siapkanSheet_(ss, CFG.SH_KARYAWAN, KOLOM.MASTER_KARYAWAN, BIRU);
  k.getRange('A2:A500').setDataValidation(vStore);
  k.getRange('C2:C500').setDataValidation(vList(JABATAN));
  k.getRange('D2:F500').setDataValidation(vAngka).setNumberFormat('#,##0');
  k.getRange('G2:H500').setDataValidation(vTanggal).setNumberFormat('yyyy-mm-dd');
  k.getRange('A1').setNote('1 baris = 1 karyawan. Dihitung ke biaya outlet ini setiap bulan dia aktif (penuh sebulan).');
  k.getRange('D1').setNote('Total biaya per bulan = Gaji Pokok + Tunjangan + BPJS & Lainnya.');
  k.getRange('G1').setNote('Kosong = sudah kerja dari dulu.');
  k.getRange('H1').setNote('Isi tanggal terakhir kerja kalau resign/pindah. Naik gaji: isi Selesai di baris lama, lalu tambah baris baru dengan gaji baru & Mulai-nya.');
  lebarKolom_(k, [90, 170, 150, 120, 110, 130, 100, 100, 200]);

  const t = siapkanSheet_(ss, CFG.SH_TETAP, KOLOM.BIAYA_TETAP, BIRU);
  t.getRange('A2:A300').setDataValidation(vStore);
  t.getRange('B2:B300').setDataValidation(vList(KAT_TETAP));
  t.getRange('D2:D300').setDataValidation(vAngka).setNumberFormat('#,##0');
  t.getRange('E2:F300').setDataValidation(vTanggal).setNumberFormat('yyyy-mm-dd');
  t.getRange('D1').setNote('Jumlah PER BULAN. Sewa dibayar tahunan? Isi sewa setahun ÷ 12.');
  t.getRange('E1').setNote('Kosong = berlaku dari dulu. Kalau nilainya berubah (mis. sewa naik), isi Selesai di baris lama & tambah baris baru.');
  lebarKolom_(t, [90, 190, 240, 130, 100, 100]);

  const b = siapkanSheet_(ss, CFG.SH_BULANAN, KOLOM.BIAYA_BULANAN, BIRU);
  b.getRange('A:A').setNumberFormat('@');
  b.getRange('A2:A2000').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=REGEXMATCH(TO_TEXT(A2), "^[0-9]{4}-[0-9]{2}$")').setAllowInvalid(false)
    .setHelpText('Format tahun-bulan, mis. 2026-09').build());
  b.getRange('B2:B2000').setDataValidation(vStore);
  b.getRange('C2:C2000').setDataValidation(vList(KAT_BULANAN));
  b.getRange('E2:E2000').setDataValidation(vAngka).setNumberFormat('#,##0');
  b.getRange('A1').setNote('Bulan tagihan, format 2026-09. Satu baris per tagihan/biaya.');
  b.getRange('C1').setNote('Gas LPG & packaging sudah tercatat di INPUT_BELANJA (masuk HPP), dan pembelian kecil dari outlet (peralatan, kebersihan, ATK, dll) di INPUT_PEMBELIAN. Jangan diisi lagi di sini.');
  lebarKolom_(b, [90, 90, 200, 260, 130]);
}

/* ============================================================
 *  KAS PER OUTLET
 *  Saldo kas = saldo awal + omzet − belanja bahan − pembelian lain − gaji − biaya tetap − tagihan ± mutasi.
 *  Gaji, biaya tetap & tagihan bulanan dianggap dibayar di akhir bulan. Dihitung di dashboard.
 * ============================================================ */
function siapkanKas_(ss) {
  const TEAL = '#0F766E';
  const vStore = SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getSheetByName(CFG.SH_STORE).getRange('A2:A200'), true).setAllowInvalid(false)
    .setHelpText('Pilih kode store dari MASTER_STORE').build();
  const vTanggal = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).setHelpText('Isi tanggal, mis. 2026-04-01').build();

  const a = siapkanSheet_(ss, CFG.SH_KAS_AWAL, KOLOM.SALDO_AWAL_KAS, TEAL);
  a.getRange('A2:A200').setDataValidation(vStore);
  a.getRange('B2:B200').setDataValidation(vTanggal).setNumberFormat('yyyy-mm-dd');
  a.getRange('C2:C200').setNumberFormat('#,##0');
  const ada = new Set(a.getLastRow() >= 2 ? a.getRange(2, 1, a.getLastRow() - 1, 1).getValues().map(r => String(r[0]).trim()) : []);
  const mulai = tanggalMulaiData_(ss);
  const baru = bacaStore_(ss).filter(s => !ada.has(s.kode)).map(s => [s.kode, mulai, CFG.SALDO_AWAL_KAS, 'Saldo awal default']);
  if (baru.length) a.getRange(a.getLastRow() + 1, 1, baru.length, 4).setValues(baru);
  a.getRange('A1').setNote('1 baris per outlet. Outlet baru otomatis dapat baris saldo awal Rp' + CFG.SALDO_AWAL_KAS.toLocaleString('id-ID') + ' saat menu Setup dijalankan.');
  a.getRange('B1').setNote('Tanggal kas mulai dihitung. Transaksi sebelum tanggal ini tidak mengubah kas.');
  a.getRange('C1').setNote('Uang kas outlet pada Tanggal Mulai.');
  lebarKolom_(a, [90, 110, 140, 220]);

  const m = siapkanSheet_(ss, CFG.SH_MUTASI_KAS, KOLOM.MUTASI_KAS, TEAL);
  m.getRange('A2:A3000').setDataValidation(vTanggal).setNumberFormat('yyyy-mm-dd');
  m.getRange('B2:B3000').setDataValidation(vStore);
  m.getRange('C2:C3000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(JENIS_MUTASI, true).setAllowInvalid(false).build());
  m.getRange('E2:E3000').setNumberFormat('#,##0;[Red]-#,##0');
  m.getRange('A1').setNote('Uang keluar/masuk kas outlet yang BUKAN omzet atau belanja: setoran ke HO, tambahan modal, koreksi selisih kas.');
  m.getRange('E1').setNote('Isi angka positif. Arah mengikuti Jenis (keluar/masuk). Khusus jenis (+/−): isi negatif kalau kas berkurang.');
  lebarKolom_(m, [105, 90, 230, 260, 130]);
}

/** TARGET_OUTLET: 1 baris per outlet. Kolom kosong = tidak ada target (dashboard pakai batas umum). */
function siapkanTarget_(ss) {
  const t = siapkanSheet_(ss, CFG.SH_TARGET, KOLOM.TARGET_OUTLET, '#7C2D12');
  t.getRange('A2:A200').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getSheetByName(CFG.SH_STORE).getRange('A2:A200'), true).setAllowInvalid(false).build());
  t.getRange('B2:B200').setNumberFormat('#,##0');
  t.getRange('C2:D200').setNumberFormat('0.0%');
  const ada = new Set(t.getLastRow() >= 2 ? t.getRange(2, 1, t.getLastRow() - 1, 1).getValues().map(r => String(r[0]).trim()) : []);
  const baru = bacaStore_(ss).filter(s => !ada.has(s.kode)).map(s => [s.kode, '', '', '', '']);
  if (baru.length) t.getRange(t.getLastRow() + 1, 1, baru.length, 5).setValues(baru);
  t.getRange('B1').setNote('Target omzet per bulan (Rupiah). Dashboard menampilkan capaian & proyeksi terhadap target ini.');
  t.getRange('C1').setNote('Batas food cost outlet ini, mis. 32%. Kosong = pakai batas umum di REKAP_TREN!F1.');
  t.getRange('D1').setNote('Target margin operasional, mis. 20%. Di bawah ini outlet ditandai "Perlu perhatian". Kosong = 10%.');
  lebarKolom_(t, [90, 150, 120, 120, 240]);
}

/**
 * REKAP_CASHFLOW: laporan arus kas bulanan (rumus live), sama aturannya dengan tab Cashflow di dashboard.
 * B1 = outlet (atau SEMUA). Kolom = bulan sejak tanggal mulai kas s/d bulan ini.
 * Basis kas: gaji, biaya tetap & tagihan dicatat keluar di akhir bulan (bulan berjalan: baris "belum dibayar").
 */
function siapkanCashflow_(ss) {
  const sh = ss.getSheetByName(CFG.SH_CASHFLOW) || ss.insertSheet(CFG.SH_CASHFLOW);
  sh.clear();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.clearConditionalFormatRules();
  if (sh.getMaxColumns() < 80) sh.insertColumnsAfter(sh.getMaxColumns(), 80 - sh.getMaxColumns());
  const O = CFG.SH_OMZET, B = CFG.SH_BELANJA, P = CFG.SH_PEMBELIAN, K = CFG.SH_KARYAWAN, T = CFG.SH_TETAP, BL = CFG.SH_BULANAN,
    M = CFG.SH_MUTASI_KAS, SA = CFG.SH_KAS_AWAL, S = CFG.SH_STORE;
  const kk = '$B$30', saldo = '$B$31', mulai = '$B$32', bi = '$B$33', R = '$B$3:$BZ$3';
  const cocok = rng => '((((' + kk + '="*")*(' + rng + '<>""))+(' + rng + '=' + kk + '))>0)';
  const aktif = (sheet, cMulai, cSelesai) => '(((' + sheet + '!$' + cMulai + '$2:$' + cMulai + '="")+(' + sheet + '!$' + cMulai + '$2:$' + cMulai + '<=ak))>0)*(((' +
    sheet + '!$' + cSelesai + '$2:$' + cSelesai + '="")+(' + sheet + '!$' + cSelesai + '$2:$' + cSelesai + '>=aw))>0)';
  const gajiF = 'SUMPRODUCT(' + cocok(K + '!$A$2:$A') + '*' + aktif(K, 'G', 'H') + '*(' + K + '!$D$2:$D+' + K + '!$E$2:$E+' + K + '!$F$2:$F))';
  const tetapF = 'SUMPRODUCT(' + cocok(T + '!$A$2:$A') + '*' + aktif(T, 'E', 'F') + '*' + T + '!$D$2:$D)';
  const tagihanF = 'SUMIFS(' + BL + '!$E:$E, ' + BL + '!$B:$B, ' + kk + ', ' + BL + '!$A:$A, m)';
  const sudahLewat = expr => 'IF(m>=' + bi + ', 0, LET(aw, DATEVALUE(m&"-01"), ak, EOMONTH(aw, 0), IF(ak<' + mulai + ', 0, ' + expr + ')))';
  const sumifs = (sheet, colNilai) => 'SUMIFS(' + sheet + '!$' + colNilai + ':$' + colNilai + ', ' + sheet + '!$F:$F, ' + kk + ', ' + sheet + '!$D:$D, m, ' + sheet + '!$C:$C, ">="&' + mulai + ')';
  const mutasi = arah => 'LET(tg, ' + M + '!$A$2:$A, jn, ' + M + '!$C$2:$C, jm, ' + M + '!$E$2:$E, ' +
    'isM, ISNUMBER(SEARCH("masuk", jn)), isK, ISNUMBER(SEARCH("keluar", jn)), sg, isM*ABS(jm) - isK*ABS(jm) + (1-isM)*(1-isK)*jm, ' +
    'ok, ' + cocok(M + '!$B$2:$B') + '*(IFERROR(TEXT(tg, "yyyy-mm"), "")=m)*(tg>=' + mulai + '), ' +
    'SUMPRODUCT(ok*' + (arah > 0 ? '(sg>0)*sg' : '(sg<0)*(-sg)') + '))';
  const peta = expr => '=MAP(' + R + ', LAMBDA(m, IF(m="", "", IFERROR(' + expr + ', 0))))';
  const larik = expr => '=ARRAYFORMULA(IF(' + R + '="", "", ' + expr + '))';
  const baris = (r) => 'B' + r + ':BZ' + r;

  sh.getRange('A1').setValue('Outlet:').setFontWeight('bold');
  sh.getRange('B1').setValue('SEMUA').setBackground('#FEF3C7').setFontWeight('bold');
  sh.getRange('C1').setValue('← klik ▾ untuk pilih outlet (SEMUA = gabungan semua cabang)').setFontColor('#6B7280');
  sh.getRange('A2').setValue('Basis kas: uang benar-benar masuk/keluar. Gaji, sewa/biaya tetap & tagihan dicatat keluar di akhir bulan, jadi bulan berjalan belum kepotong (lihat baris "Belum dibayar"). Saldo awal & mutasi diisi di SALDO_AWAL_KAS & MUTASI_KAS.')
    .setFontStyle('italic').setFontColor('#6B7280');

  // bantuan (baris disembunyikan)
  sh.getRange('A30:B33').setValues([['kode (bantuan)', ''], ['saldo awal', ''], ['tanggal mulai', ''], ['bulan ini', '']]);
  sh.getRange('B30').setFormula('=IF($B$1="SEMUA", "*", $B$1)');
  sh.getRange('B31').setFormula('=IF($B$30="*", SUM(' + SA + '!C2:C), IFERROR(VLOOKUP($B$30, ' + SA + '!A2:C, 3, FALSE), 0))');
  sh.getRange('B32').setFormula('=IF(COUNT(' + SA + '!B2:B)=0, "", IF($B$30="*", MIN(' + SA + '!B2:B), IFERROR(VLOOKUP($B$30, ' + SA + '!A2:B, 2, FALSE), "")))');
  sh.getRange('B33').setFormula('=TEXT(TODAY(), "yyyy-mm")');
  sh.getRange('A40').setValue('SEMUA');
  sh.getRange('A41').setFormula('=FILTER(' + S + '!A2:A, ' + S + '!A2:A<>"")');
  sh.getRange('B1').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(sh.getRange('A40:A100'), true).setAllowInvalid(false).build());

  // header bulan
  sh.getRange('A3').setValue('Pos (Rupiah)');
  sh.getRange('B3').setFormula('=IF($B$32="", "Isi SALDO_AWAL_KAS dulu", ARRAYFORMULA(TEXT(EDATE(DATE(YEAR($B$32), MONTH($B$32), 1), ' +
    'SEQUENCE(1, MIN(78, (YEAR(TODAY())-YEAR($B$32))*12 + MONTH(TODAY()) - MONTH($B$32) + 1), 0)), "yyyy-mm")))');

  const label = [
    [4, 'Saldo awal'], [5, 'KAS MASUK'], [6, 'Omzet penjualan'], [7, 'Tambahan modal & mutasi masuk'], [8, 'Total kas masuk'],
    [9, 'KAS KELUAR'], [10, 'Belanja bahan baku'], [11, 'Pembelian non-bahan'], [12, 'Gaji karyawan'], [13, 'Sewa & biaya tetap'],
    [14, 'Tagihan (listrik, air, dll)'], [15, 'Setoran ke HO & mutasi keluar'], [16, 'Total kas keluar'], [17, 'Arus kas bersih'],
    [18, 'Saldo akhir'], [20, 'Belum dibayar bulan ini (gaji, sewa, tagihan)'], [21, 'Saldo akhir setelah dibayar'],
    [23, 'RINGKASAN SEJAK MULAI'], [24, 'Total kas masuk'], [25, 'Total kas keluar'], [26, 'Saldo kas sekarang'], [27, 'Saldo setelah gaji/sewa bulan ini dibayar']
  ];
  label.forEach(x => sh.getRange(x[0], 1).setValue(x[1]));

  sh.getRange('B6').setFormula(peta(sumifs(O, 'I')));
  sh.getRange('B7').setFormula(peta(mutasi(1)));
  sh.getRange('B8').setFormula(larik(baris(6) + '+' + baris(7)));
  sh.getRange('B10').setFormula(peta(sumifs(B, 'N')));
  sh.getRange('B11').setFormula(peta(sumifs(P, 'N')));
  sh.getRange('B12').setFormula(peta(sudahLewat(gajiF)));
  sh.getRange('B13').setFormula(peta(sudahLewat(tetapF)));
  sh.getRange('B14').setFormula(peta(sudahLewat(tagihanF)));
  sh.getRange('B15').setFormula(peta(mutasi(-1)));
  sh.getRange('B16').setFormula(larik(baris(10) + '+' + baris(11) + '+' + baris(12) + '+' + baris(13) + '+' + baris(14) + '+' + baris(15)));
  sh.getRange('B17').setFormula(larik(baris(8) + '-' + baris(16)));
  sh.getRange('B18').setFormula('=ARRAYFORMULA(IF(' + R + '="", "", SCAN(' + saldo + ', ' + baris(17) + ', LAMBDA(a, x, a + N(x)))))');
  sh.getRange('B4').setFormula(larik(baris(18) + '-' + baris(17)));
  sh.getRange('B20').setFormula(peta('IF(m<>' + bi + ', 0, LET(aw, DATEVALUE(m&"-01"), ak, EOMONTH(aw, 0), ' + gajiF + ' + ' + tetapF + ' + ' + tagihanF + '))'));
  sh.getRange('B21').setFormula(larik(baris(18) + '-' + baris(20)));
  sh.getRange('B24').setFormula('=SUM(B8:BZ8)');
  sh.getRange('B25').setFormula('=SUM(B16:BZ16)');
  sh.getRange('B26').setFormula('=' + saldo + '+SUM(B17:BZ17)');
  sh.getRange('B27').setFormula('=B26-SUM(B20:BZ20)');

  // format
  const TEAL = '#0F766E';
  sh.getRange('A3:BZ3').setFontWeight('bold').setBackground(TEAL).setFontColor('#FFFFFF').setHorizontalAlignment('center');
  sh.getRange('A3').setHorizontalAlignment('left');
  sh.getRange('B4:BZ27').setNumberFormat('#,##0;[Red]-#,##0');
  [4, 8, 16, 17, 18, 24, 25, 26, 27].forEach(r => sh.getRange(r, 1, 1, 78).setFontWeight('bold'));
  [8, 16].forEach(r => sh.getRange(r, 1, 1, 78).setBackground('#F3F4F6'));
  sh.getRange(17, 1, 1, 78).setBackground('#FFF7ED');
  sh.getRange(18, 1, 1, 78).setBackground('#ECFDF5');
  [5, 9, 23].forEach(r => sh.getRange(r, 1).setFontWeight('bold').setFontColor('#6B7280').setFontSize(9));
  [20, 21].forEach(r => sh.getRange(r, 1, 1, 78).setFontColor('#6B7280').setFontStyle('italic'));
  sh.setFrozenRows(3);
  sh.setFrozenColumns(1);
  sh.setColumnWidth(1, 300);
  sh.setColumnWidths(2, 77, 115);
  sh.hideRows(30, 71);
  sh.setTabColor(TEAL);
}

/** Awal bulan dari data paling awal (belanja/omzet); kalau belum ada data, awal bulan ini. */
function tanggalMulaiData_(ss) {
  let min = null;
  [CFG.SH_BELANJA, CFG.SH_OMZET].forEach(n => {
    const sh = ss.getSheetByName(n);
    if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 3, sh.getLastRow() - 1, 1).getValues().forEach(r => { if (r[0] instanceof Date && (!min || r[0] < min)) min = r[0]; });
  });
  const d = min || new Date();
  return Utilities.parseDate(fmt_(d, 'yyyy-MM') + '-01', CFG.TZ, 'yyyy-MM-dd');
}

function siapkanProfit_(ss) {
  const sh = ss.getSheetByName(CFG.SH_PROFIT) || ss.insertSheet(CFG.SH_PROFIT);
  sh.clear();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations(); // validasi lama bisa menolak isi baru
  sh.clearConditionalFormatRules();
  const B = CFG.SH_BELANJA, O = CFG.SH_OMZET, S = CFG.SH_STORE, K = CFG.SH_KARYAWAN, T = CFG.SH_TETAP, BL = CFG.SH_BULANAN, P = CFG.SH_PEMBELIAN;

  sh.getRange('Z1').setValue('Daftar bulan (otomatis)');
  sh.getRange('Z2').setFormula('=LET(b, VSTACK(' + B + '!D2:D, ' + O + '!D2:D, ' + BL + '!A2:A, ' + P + '!D2:D, TEXT(TODAY(), "yyyy-mm")), SORT(UNIQUE(FILTER(b, b<>"")), 1, FALSE))');
  sh.getRange('A1').setValue('Bulan (yyyy-MM):').setFontWeight('bold');
  sh.getRange('B1').setNumberFormat('@').setValue(fmt_(new Date(), 'yyyy-MM')).setBackground('#FEF3C7').setFontWeight('bold')
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(sh.getRange('Z2:Z200'), true).setAllowInvalid(false).build());
  sh.getRange('C1').setValue('← klik ▾ untuk pilih bulan').setFontColor('#6B7280');
  sh.getRange('A2').setValue('Laba operasional = Omzet − HPP (belanja bahan) − Biaya karyawan − Biaya tetap − Biaya bulanan − Pembelian lain (non-bahan). Belum termasuk biaya kantor pusat, pajak penghasilan & penyusutan (kecuali diisi di BIAYA_TETAP).')
    .setFontStyle('italic').setFontColor('#6B7280');

  const h = ['Kode Store', 'Nama Store', 'Omzet', 'HPP (bahan)', 'Laba Kotor', '% Laba Kotor', 'Biaya Karyawan', 'Biaya Tetap',
    'Biaya Bulanan', 'Pembelian Lain', 'Laba Operasional', 'Margin %', 'Karyawan % Omzet'];
  sh.getRange(3, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#1E40AF').setFontColor('#FFFFFF').setWrap(true);
  sh.setFrozenRows(3);

  const aktif = (sheet, colStore, colMulai, colSelesai, jumlah) =>
    'SUMPRODUCT((' + sheet + '!' + colStore + '2:' + colStore + '=k) * (((' + sheet + '!' + colMulai + '2:' + colMulai + '="") + (' + sheet + '!' + colMulai + '2:' + colMulai + '<=ak)) > 0) * (((' +
    sheet + '!' + colSelesai + '2:' + colSelesai + '="") + (' + sheet + '!' + colSelesai + '2:' + colSelesai + '>=aw)) > 0) * (' + jumlah + '))';
  const bulanLet = 'aw, DATEVALUE($B$1 & "-01"), ak, EOMONTH(aw, 0)';

  sh.getRange('A4:B4').setValues([['TOTAL', 'Semua outlet']]);
  sh.getRange('A5').setFormula('=FILTER(HSTACK(' + S + '!A2:A, ' + S + '!C2:C), ' + S + '!A2:A<>"")');
  sh.getRange('C5').setFormula('=MAP(A5:A200, LAMBDA(k, IF(k="", "", SUMIFS(' + O + '!I:I, ' + O + '!F:F, k, ' + O + '!D:D, $B$1))))');
  sh.getRange('D5').setFormula('=MAP(A5:A200, LAMBDA(k, IF(k="", "", SUMIFS(' + B + '!N:N, ' + B + '!F:F, k, ' + B + '!D:D, $B$1))))');
  sh.getRange('E5').setFormula('=MAP(C5:C200, D5:D200, LAMBDA(o, hp, IF(o="", "", o-hp)))');
  sh.getRange('F5').setFormula('=MAP(C5:C200, E5:E200, LAMBDA(o, g, IF(OR(o="", o=0), "", g/o)))');
  sh.getRange('G5').setFormula('=MAP(A5:A200, LAMBDA(k, IF(k="", "", LET(' + bulanLet + ', ' +
    aktif(K, 'A', 'G', 'H', K + '!D2:D + ' + K + '!E2:E + ' + K + '!F2:F') + '))))');
  sh.getRange('H5').setFormula('=MAP(A5:A200, LAMBDA(k, IF(k="", "", LET(' + bulanLet + ', ' + aktif(T, 'A', 'E', 'F', T + '!D2:D') + '))))');
  sh.getRange('I5').setFormula('=MAP(A5:A200, LAMBDA(k, IF(k="", "", SUMIFS(' + BL + '!E:E, ' + BL + '!B:B, k, ' + BL + '!A:A, $B$1))))');
  sh.getRange('J5').setFormula('=MAP(A5:A200, LAMBDA(k, IF(k="", "", IFERROR(SUMIFS(' + P + '!N:N, ' + P + '!F:F, k, ' + P + '!D:D, $B$1), 0))))');
  sh.getRange('K5').setFormula('=MAP(E5:E200, G5:G200, H5:H200, I5:I200, J5:J200, LAMBDA(g, a, b, c, d, IF(g="", "", g-a-b-c-d)))');
  sh.getRange('L5').setFormula('=MAP(C5:C200, K5:K200, LAMBDA(o, l, IF(OR(o="", o=0), "", l/o)))');
  sh.getRange('M5').setFormula('=MAP(C5:C200, G5:G200, LAMBDA(o, a, IF(OR(o="", o=0), "", a/o)))');
  ['C', 'D', 'E', 'G', 'H', 'I', 'J', 'K'].forEach(c => sh.getRange(c + '4').setFormula('=SUM(' + c + '5:' + c + '200)'));
  sh.getRange('F4').setFormula('=IF(C4=0, "", E4/C4)');
  sh.getRange('L4').setFormula('=IF(C4=0, "", K4/C4)');
  sh.getRange('M4').setFormula('=IF(C4=0, "", G4/C4)');
  sh.getRange('A4:M4').setFontWeight('bold').setBackground('#EFF6FF');

  sh.getRange('C4:E200').setNumberFormat('#,##0');
  sh.getRange('G4:K200').setNumberFormat('#,##0;[Red]-#,##0');
  sh.getRange('F4:F200').setNumberFormat('0.0%');
  sh.getRange('L4:M200').setNumberFormat('0.0%;[Red]-0.0%');
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(ISNUMBER($K4), $K4<0)')
      .setBackground('#FDE8E6').setRanges([sh.getRange('A4:M200')]).build()
  ]);
  sh.setFrozenColumns(2);
  lebarKolom_(sh, [100, 210, 120, 120, 120, 90, 120, 110, 110, 120, 130, 85, 100]);
  sh.hideColumns(26);
}

function bacaDenganPeriode_(ss, nama, map) {
  const sh = ss.getSheetByName(nama);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues()
    .filter(r => String(r[0]).trim())
    .map(map);
}

/** Biaya per outlet per bulan, sudah dijumlah per jabatan/kategori (nama & gaji per orang TIDAK dikirim ke dashboard). */
function biayaDashboard_(ss, bulanDipakai) {
  const tglAtauNull = v => (v instanceof Date) ? v : null;
  const kary = bacaDenganPeriode_(ss, CFG.SH_KARYAWAN, r => ({ store: String(r[0]).trim(), kategori: String(r[2]).trim() || 'Lainnya',
    jumlah: (Number(r[3]) || 0) + (Number(r[4]) || 0) + (Number(r[5]) || 0), mulai: tglAtauNull(r[6]), selesai: tglAtauNull(r[7]) }));
  const tetap = bacaDenganPeriode_(ss, CFG.SH_TETAP, r => ({ store: String(r[0]).trim(), kategori: String(r[1]).trim() || 'Lainnya',
    jumlah: Number(r[3]) || 0, mulai: tglAtauNull(r[4]), selesai: tglAtauNull(r[5]) }));
  const bulanan = bacaDenganPeriode_(ss, CFG.SH_BULANAN, r => ({ bulan: (r[0] instanceof Date) ? fmt_(r[0], 'yyyy-MM') : String(r[0]).trim(),
    store: String(r[1]).trim(), kategori: String(r[2]).trim() || 'Lain-lain', jumlah: Number(r[4]) || 0 }));

  bulanan.forEach(r => bulanDipakai.add(r.bulan));
  const semua = [...bulanDipakai].filter(b => /^\d{4}-\d{2}$/.test(b)).sort();
  const agg = new Map(), orang = new Map();
  const tambah = (bulan, store, kelompok, kategori, n, jmlOrang) => {
    if (!store || !n) return;
    const k = [bulan, store, kelompok, kategori].join('|');
    agg.set(k, (agg.get(k) || 0) + n);
    if (jmlOrang) orang.set(k, (orang.get(k) || 0) + jmlOrang);
  };
  if (semua.length) {
    let [y, m] = semua[0].split('-').map(Number);
    const akhir = fmt_(new Date(), 'yyyy-MM');
    for (let i = 0; i < 60; i++) {
      const b = y + '-' + String(m).padStart(2, '0');
      if (b > akhir) break;
      const hari = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const aw = Utilities.parseDate(b + '-01 00:00', CFG.TZ, 'yyyy-MM-dd HH:mm');
      const ak = Utilities.parseDate(b + '-' + hari + ' 23:59', CFG.TZ, 'yyyy-MM-dd HH:mm');
      const aktif = x => (!x.mulai || x.mulai <= ak) && (!x.selesai || x.selesai >= aw);
      kary.filter(aktif).forEach(x => tambah(b, x.store, 'Karyawan', x.kategori, x.jumlah, 1));
      tetap.filter(aktif).forEach(x => tambah(b, x.store, 'Tetap', x.kategori, x.jumlah));
      m++; if (m > 12) { m = 1; y++; }
    }
  }
  bulanan.forEach(r => tambah(r.bulan, r.store, 'Operasional', r.kategori, r.jumlah));
  // [bulan, kodeStore, kelompok (Karyawan|Tetap|Operasional), kategori/jabatan, jumlah, jumlahOrang (khusus Karyawan)]
  return [...agg.entries()].map(([k, v]) => k.split('|').concat([Math.round(v), orang.get(k) || 0]));
}

function siapkanKamus_(ss) {
  const sh = ss.getSheetByName(CFG.SH_KAMUS) || ss.insertSheet(CFG.SH_KAMUS);
  sh.clear();
  const rows = [
    ['Sheet', 'Kolom', 'Arti / aturan (untuk AI & tim HO)'],
    ['UMUM', '-', 'Data diisi tim store lewat app HP. 1 baris INPUT_BELANJA = 1 bahan yang dibeli. Semua uang dalam Rupiah.'],
    ['UMUM', '-', 'Gabungkan data antar sheet pakai "Kode Store". Bandingkan antar store/brand per "Bulan" (format yyyy-MM).'],
    ['UMUM', '-', 'Food cost % = SUM(INPUT_BELANJA.Total) ÷ SUM(INPUT_OMZET.Omzet) di store & bulan yang sama. Ini berbasis pembelian, bukan pemakaian.'],
    ['UMUM', '-', 'Baris dengan kolom "Flag" terisi perlu dicek HO (harga di atas harga acuan).'],
    ['INPUT_BELANJA', 'ID Baris', 'ID unik per baris = ID Kiriman + nomor urut bahan.'],
    ['INPUT_BELANJA', 'Waktu Input', 'Kapan data dikirim dari HP (WIB).'],
    ['INPUT_BELANJA', 'Tanggal Belanja', 'Tanggal barang dibeli/diterima (bisa beda dengan Waktu Input).'],
    ['INPUT_BELANJA', 'Bulan', 'yyyy-MM dari Tanggal Belanja, untuk agregasi bulanan.'],
    ['INPUT_BELANJA', 'Brand / Kode Store / Nama Store', 'Diambil dari MASTER_STORE sesuai HP yang mengirim.'],
    ['INPUT_BELANJA', 'PIC', 'Nama karyawan yang input.'],
    ['INPUT_BELANJA', 'Kategori', 'Dari MASTER_BAHAN.'],
    ['INPUT_BELANJA', 'Nama Bahan', 'Selalu nama baku dari MASTER_BAHAN (app pakai dropdown, server menolak nama di luar master). Aman untuk group by.'],
    ['INPUT_BELANJA', 'Qty / Satuan', 'Jumlah beli. Satuan selalu mengikuti MASTER_BAHAN, jadi harga per satuan bisa dibandingkan antar store & waktu.'],
    ['INPUT_BELANJA', 'Harga per Satuan', 'Harga per 1 satuan (mis. per kg).'],
    ['INPUT_BELANJA', 'Total', 'Qty × Harga per Satuan (dibulatkan ke Rupiah).'],
    ['INPUT_BELANJA', 'Supplier / Catatan', 'Opsional dari store.'],
    ['INPUT_BELANJA', 'Link Foto Nota', 'Link Google Drive foto nota (opsional). Satu kiriman berbagi satu foto.'],
    ['INPUT_BELANJA', 'Flag', 'HARGA > ACUAN +x% (harga di atas MASTER_BAHAN.Harga Acuan). Kosong = normal.'],
    ['INPUT_BELANJA', 'ID Kiriman', 'Satu kali tekan "Kirim" di HP. Dipakai untuk mencegah data dobel.'],
    ['INPUT_PEMBELIAN', '-', 'Pembelian di luar bahan baku (peralatan, kebersihan, ATK, perbaikan kecil, transport, dll) dari tab Pembelian di app HP. 1 baris = 1 barang. TIDAK masuk HPP / food cost; masuk laba operasional sebagai "Pembelian lain".'],
    ['INPUT_PEMBELIAN', 'Nama Barang', 'Diketik bebas oleh store (app memberi saran dari nama yang pernah dipakai). Group by pakai Kategori.'],
    ['INPUT_PEMBELIAN', 'Dibayar Dari', 'Kas outlet (tunai) = mengurangi kas outlet · Uang pribadi (reimburse) = utang ke karyawan · Transfer / kartu HO = dibayar pusat. Dasar perhitungan kas bersih.'],
    ['REKAP_CASHFLOW', '-', 'Laporan arus kas bulanan (rumus otomatis). B1 pilih outlet atau SEMUA. Saldo awal → kas masuk (omzet, modal) → kas keluar (bahan, pembelian, gaji, sewa, tagihan, setoran) → arus bersih → saldo akhir. Gaji, sewa & tagihan dicatat keluar di akhir bulan.'],
    ['TARGET_OUTLET', '-', 'Target per outlet: omzet per bulan, batas food cost, target margin operasional. Kolom kosong = tidak ada target.'],
    ['SALDO_AWAL_KAS', '-', 'Saldo kas awal tiap outlet (default Rp100.000.000) dan tanggal kas mulai dihitung.'],
    ['MUTASI_KAS', '-', 'Mutasi kas manual: setoran/tarik ke HO (keluar), tambahan modal (masuk), koreksi selisih (+/−). Kas outlet = saldo awal + omzet − belanja bahan − pembelian lain − gaji − biaya tetap − tagihan bulanan ± mutasi. Gaji, biaya tetap & tagihan dianggap dibayar akhir bulan.'],
    ['INPUT_OMZET', 'Tanggal / Bulan', '1 baris per store per tanggal. Kirim ulang tanggal sama menimpa baris lama.'],
    ['INPUT_OMZET', 'Omzet', 'Penjualan hari itu (Rupiah).'],
    ['INPUT_OMZET', 'Jumlah Struk', 'Jumlah transaksi hari itu (opsional). Omzet ÷ Jumlah Struk = rata-rata per transaksi.'],
    ['MASTER_STORE', 'PIN', 'Rahasia — jangan ditampilkan di laporan.'],
    ['MASTER_BAHAN', 'Harga Acuan', 'Patokan harga wajar per satuan; dasar flag harga.'],
    ['REKAP_BULANAN', '-', 'Ringkasan otomatis (rumus). Sumber kebenaran tetap INPUT_BELANJA & INPUT_OMZET.'],
    ['REKAP_TREN', '-', 'Tabel 12 bulan terakhir per store (baris SEMUA = total semua store). B1 memilih angka: Food cost %, Total belanja, atau Omzet.'],
    ['MASTER_KARYAWAN', '-', '1 baris = 1 karyawan. Biaya/bln = Gaji Pokok + Tunjangan + BPJS & Lainnya. Dihitung penuh di setiap bulan dia aktif (Mulai ≤ akhir bulan, Selesai kosong atau ≥ awal bulan).'],
    ['BIAYA_TETAP', '-', 'Biaya rutin per bulan per outlet (sewa ÷12, internet, POS, dll) dengan periode Mulai–Selesai.'],
    ['BIAYA_BULANAN', '-', 'Tagihan per bulan per outlet (listrik, air, perbaikan, marketing, komisi ojol, dll). Kolom Bulan format yyyy-MM.'],
    ['REKAP_PROFIT', '-', 'Laba rugi per outlet untuk bulan di B1. Laba operasional = Omzet − HPP bahan − Karyawan − Biaya tetap − Biaya bulanan − Pembelian lain. Margin % = Laba operasional ÷ Omzet.']
  ];
  sh.getRange(1, 1, rows.length, 3).setValues(rows).setWrap(true).setVerticalAlignment('top');
  sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#374151').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  lebarKolom_(sh, [130, 200, 560]);
}

/** Bikin tab tampilan per store (read-only, pakai QUERY). Jalankan lagi kalau ada store baru. */
function buatTabPerStore() {
  const ss = ss_();
  bacaStore_(ss).forEach(s => {
    const nama = 'STORE ' + s.kode;
    const sh = ss.getSheetByName(nama) || ss.insertSheet(nama);
    sh.clear();
    sh.getRange('A1').setFormula('=QUERY(' + CFG.SH_BELANJA + '!A:S, "select C, J, I, K, L, M, N, O, H, R where F = \'' +
      s.kode.replace(/'/g, '') + '\' order by C desc", 1)');
    sh.getRange('A:A').setNumberFormat('yyyy-mm-dd');
    sh.getRange('F:G').setNumberFormat('#,##0');
    sh.setFrozenRows(1);
    sh.setTabColor('#F59E0B');
  });
  try { ss.toast('Tab per store dibuat/diperbarui.', 'HPP', 5); } catch (e) {}
}

function infoApp() {
  const url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(url
    ? 'URL app HP:\n\n' + url + '\n\nKirim ke tim store, buka di Chrome/Safari, lalu "Add to Home Screen".'
    : 'Belum di-deploy. Di Apps Script: Deploy > New deployment > Web app.');
}

/* ============================================================
 *  HELPER
 * ============================================================ */

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function siapkanSheet_(ss, nama, header, warna) {
  const sh = ss.getSheetByName(nama) || ss.insertSheet(nama);
  sh.getRange(1, 1, 1, header.length).setValues([header])
    .setFontWeight('bold').setBackground(warna).setFontColor('#FFFFFF').setWrap(true).setVerticalAlignment('middle');
  sh.setFrozenRows(1);
  return sh;
}

function lebarKolom_(sh, lebar) {
  lebar.forEach((w, i) => sh.setColumnWidth(i + 1, w));
}

function bacaStore_(ss) {
  const sh = ss.getSheetByName(CFG.SH_STORE);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues()
    .filter(r => String(r[0]).trim())
    .map(r => ({
      kode: String(r[0]).trim(), brand: String(r[1]).trim(), nama: String(r[2]).trim(),
      kota: String(r[3]).trim(), pin: String(r[4]).trim(),
      aktif: !(r[5] === false || String(r[5]).toUpperCase() === 'FALSE')
    }));
}

function bacaBahan_(ss) {
  const sh = ss.getSheetByName(CFG.SH_BAHAN);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues()
    .filter(r => String(r[0]).trim())
    .map(r => ({
      nama: String(r[0]).trim(), kategori: String(r[1]).trim() || 'Lainnya', satuan: String(r[2]).trim(),
      brand: String(r[3]).trim() || 'Semua', hargaAcuan: Number(r[4]) || 0,
      aktif: !(r[5] === false || String(r[5]).toUpperCase() === 'FALSE')
    }));
}

function mapBahan_(ss) {
  const out = {};
  bacaBahan_(ss).forEach(b => { out[b.nama.toLowerCase()] = b; });
  return out;
}

function hargaTerakhir_(ss, kode) {
  const sh = ss.getSheetByName(CFG.SH_BELANJA);
  const last = sh.getLastRow();
  if (last < 2) return {};
  const n = Math.min(CFG.MAKS_BARIS_HARGA_TERAKHIR, last - 1);
  const v = sh.getRange(last - n + 1, 6, n, 8).getValues(); // kolom F..M
  const out = {};
  v.forEach(r => {
    if (String(r[0]) === String(kode) && r[4]) out[String(r[4])] = { harga: Number(r[7]) || 0, satuan: String(r[6]) };
  });
  return out;
}

function cekStore_(ss, kode, pin) {
  const s = bacaStore_(ss).find(x => x.kode === String(kode || '').trim());
  if (!s) throw validasi_('Store "' + kode + '" tidak ada di MASTER_STORE.');
  if (!s.aktif) throw validasi_('Store ' + s.kode + ' sedang non-aktif.');
  if (s.pin && s.pin !== String(pin || '').trim()) throw validasi_('PIN store salah.');
  return s;
}

function sudahAda_(sh, kolom, id) {
  const last = sh.getLastRow();
  if (last < 2) return false;
  return !!sh.getRange(2, kolom, last - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
}

function parseTanggal_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) throw validasi_('Tanggal tidak valid.');
  const d = Utilities.parseDate(s, CFG.TZ, 'yyyy-MM-dd');
  if (d.getTime() > Date.now() + 24 * 3600 * 1000) throw validasi_('Tanggal tidak boleh di masa depan.');
  return d;
}

function simpanFoto_(foto, store, tanggal) {
  const blob = Utilities.newBlob(Utilities.base64Decode(foto.data), foto.mimeType || 'image/jpeg',
    store.kode + '_' + tanggal + '_' + Date.now() + '.jpg');
  return folderNota_().createFile(blob).getUrl();
}

function folderNota_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* folder terhapus → bikin baru */ } }
  const f = DriveApp.createFolder(CFG.FOLDER_NOTA);
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}

function fmt_(d, pola) {
  return Utilities.formatDate(d, CFG.TZ, pola);
}

function validasi_(pesan) {
  return new Error('[VALIDASI] ' + pesan);
}
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
