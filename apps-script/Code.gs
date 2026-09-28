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
  SH_STORE: 'MASTER_STORE',
  SH_BAHAN: 'MASTER_BAHAN',
  SH_REKAP: 'REKAP_BULANAN',
  SH_TREN: 'REKAP_TREN',
  SH_KARYAWAN: 'MASTER_KARYAWAN',
  SH_TETAP: 'BIAYA_TETAP',
  SH_BULANAN: 'BIAYA_BULANAN',
  SH_PROFIT: 'REKAP_PROFIT',
  SH_KAMUS: 'KAMUS_DATA',
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
  INPUT_OMZET: ['ID Baris', 'Waktu Input', 'Tanggal', 'Bulan', 'Brand', 'Kode Store', 'Nama Store', 'PIC',
    'Omzet', 'Jumlah Struk', 'Catatan', 'ID Kiriman'],
  MASTER_STORE: ['Kode Store', 'Brand', 'Nama Store', 'Kota', 'PIN', 'Aktif'],
  MASTER_BAHAN: ['Nama Bahan', 'Kategori', 'Satuan', 'Brand', 'Harga Acuan', 'Aktif'],
  MASTER_KARYAWAN: ['Kode Store', 'Nama', 'Jabatan', 'Gaji Pokok /bln', 'Tunjangan /bln', 'BPJS & Lainnya /bln', 'Mulai', 'Selesai', 'Catatan'],
  BIAYA_TETAP: ['Kode Store', 'Kategori', 'Keterangan', 'Jumlah /bln', 'Mulai', 'Selesai'],
  BIAYA_BULANAN: ['Bulan', 'Kode Store', 'Kategori', 'Keterangan', 'Jumlah']
};

const JABATAN = ['Store Manager', 'Supervisor', 'Kepala Dapur', 'Cook', 'Kitchen Helper', 'Kasir', 'Waiter/Waitress',
  'Barista', 'Steward/Dishwasher', 'Cleaning', 'Driver/Kurir', 'Security', 'Part-time', 'Lainnya'];
const KAT_TETAP = ['Sewa tempat', 'Service charge / IPL', 'Internet & telepon', 'Langganan POS / software', 'Asuransi',
  'Cicilan / penyusutan alat', 'Lainnya'];
const KAT_BULANAN = ['Listrik', 'Air (PDAM)', 'Perbaikan & perawatan', 'Marketing & promosi', 'Komisi ojol / marketplace',
  'Kebersihan & pest control', 'Perlengkapan non-bahan', 'Transport', 'Lembur & insentif', 'Pajak & retribusi', 'Lain-lain'];

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

  // belanja: [tanggal, bulan, brand, kodeStore, pic, kategori, bahan, qty, satuan, harga, total, supplier, flag, idKiriman, waktuInput]
  const belanja = shB.getLastRow() < 2 ? [] : shB.getRange(2, 1, shB.getLastRow() - 1, 19).getValues()
    .filter(r => r[0] !== '' && r[5] !== '')
    .map(r => [tgl(r[2]), String(r[3]), String(r[4]), String(r[5]), String(r[7]), String(r[8]), String(r[9]),
      Number(r[10]) || 0, String(r[11]), Number(r[12]) || 0, Number(r[13]) || 0, String(r[14]), String(r[17]), String(r[18]), wkt(r[1])]);

  // omzet: [tanggal, bulan, brand, kodeStore, omzet, struk]
  const omzet = shO.getLastRow() < 2 ? [] : shO.getRange(2, 1, shO.getLastRow() - 1, 12).getValues()
    .filter(r => r[0] !== '' && r[5] !== '')
    .map(r => [tgl(r[2]), String(r[3]), String(r[4]), String(r[5]), Number(r[8]) || 0, r[9] === '' ? null : Number(r[9])]);

  const tren = ss.getSheetByName(CFG.SH_TREN);
  const batas = tren ? Number(tren.getRange('F1').getValue()) || CFG.BATAS_FOOD_COST : CFG.BATAS_FOOD_COST;
  const bulanDipakai = new Set(belanja.map(r => r[1]).concat(omzet.map(r => r[1])));

  return {
    namaFile: ss.getName(),
    diambil: new Date().toISOString(),
    batasFoodCost: batas,
    stores: bacaStore_(ss).map(s => ({ kode: s.kode, brand: s.brand, nama: s.nama, aktif: s.aktif })), // tanpa PIN
    bahan: bacaBahan_(ss).map(b => ({ nama: b.nama, kategori: b.kategori, satuan: b.satuan, brand: b.brand, acuan: b.hargaAcuan })),
    belanja: belanja,
    omzet: omzet,
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
    'Kamu menerima ringkasan anomali yang sudah dideteksi secara statistik dari data belanja bahan baku, omzet, dan biaya operasional (karyawan, sewa, listrik, dll) tiap outlet, plus laba rugi & margin per outlet kalau datanya ada.',
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
  SpreadsheetApp.getUi().createMenu('🍜 HPP')
    .addItem('Setup / rapikan struktur', 'setup')
    .addItem('Buat tab per store', 'buatTabPerStore')
    .addSeparator()
    .addItem('Lihat URL app HP', 'infoApp')
    .addSeparator()
    .addItem('🔑 Buat / ganti kunci dashboard', 'buatKunciDashboard')
    .addItem('✨ Set API key Claude (Analisis AI)', 'setApiKeyClaude')
    .addToUi();
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
  siapkanRekap_(ss);
  siapkanTren_(ss);
  siapkanProfit_(ss);
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
  b.getRange('C1').setNote('Gas LPG & packaging sudah tercatat di INPUT_BELANJA (masuk HPP), jangan diisi lagi di sini.');
  lebarKolom_(b, [90, 90, 200, 260, 130]);
}

function siapkanProfit_(ss) {
  const sh = ss.getSheetByName(CFG.SH_PROFIT) || ss.insertSheet(CFG.SH_PROFIT);
  sh.clear();
  sh.clearConditionalFormatRules();
  const B = CFG.SH_BELANJA, O = CFG.SH_OMZET, S = CFG.SH_STORE, K = CFG.SH_KARYAWAN, T = CFG.SH_TETAP, BL = CFG.SH_BULANAN;

  sh.getRange('Z1').setValue('Daftar bulan (otomatis)');
  sh.getRange('Z2').setFormula('=LET(b, VSTACK(' + B + '!D2:D, ' + O + '!D2:D, ' + BL + '!A2:A, TEXT(TODAY(), "yyyy-mm")), SORT(UNIQUE(FILTER(b, b<>"")), 1, FALSE))');
  sh.getRange('A1').setValue('Bulan (yyyy-MM):').setFontWeight('bold');
  sh.getRange('B1').setNumberFormat('@').setValue(fmt_(new Date(), 'yyyy-MM')).setBackground('#FEF3C7').setFontWeight('bold')
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(sh.getRange('Z2:Z200'), true).setAllowInvalid(false).build());
  sh.getRange('C1').setValue('← klik ▾ untuk pilih bulan').setFontColor('#6B7280');
  sh.getRange('A2').setValue('Laba operasional = Omzet − HPP (belanja bahan) − Biaya karyawan − Biaya tetap − Biaya bulanan. Belum termasuk biaya kantor pusat, pajak penghasilan & penyusutan (kecuali diisi di BIAYA_TETAP).')
    .setFontStyle('italic').setFontColor('#6B7280');

  const h = ['Kode Store', 'Nama Store', 'Omzet', 'HPP (bahan)', 'Laba Kotor', '% Laba Kotor', 'Biaya Karyawan', 'Biaya Tetap',
    'Biaya Bulanan', 'Laba Operasional', 'Margin %', 'Karyawan % Omzet'];
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
  sh.getRange('J5').setFormula('=MAP(E5:E200, G5:G200, H5:H200, I5:I200, LAMBDA(g, a, b, c, IF(g="", "", g-a-b-c)))');
  sh.getRange('K5').setFormula('=MAP(C5:C200, J5:J200, LAMBDA(o, l, IF(OR(o="", o=0), "", l/o)))');
  sh.getRange('L5').setFormula('=MAP(C5:C200, G5:G200, LAMBDA(o, a, IF(OR(o="", o=0), "", a/o)))');
  ['C', 'D', 'E', 'G', 'H', 'I', 'J'].forEach(c => sh.getRange(c + '4').setFormula('=SUM(' + c + '5:' + c + '200)'));
  sh.getRange('F4').setFormula('=IF(C4=0, "", E4/C4)');
  sh.getRange('K4').setFormula('=IF(C4=0, "", J4/C4)');
  sh.getRange('L4').setFormula('=IF(C4=0, "", G4/C4)');
  sh.getRange('A4:L4').setFontWeight('bold').setBackground('#EFF6FF');

  sh.getRange('C4:E200').setNumberFormat('#,##0');
  sh.getRange('G4:J200').setNumberFormat('#,##0;[Red]-#,##0');
  sh.getRange('F4:F200').setNumberFormat('0.0%');
  sh.getRange('K4:L200').setNumberFormat('0.0%;[Red]-0.0%');
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(ISNUMBER($J4), $J4<0)')
      .setBackground('#FDE8E6').setRanges([sh.getRange('A4:L200')]).build()
  ]);
  sh.setFrozenColumns(2);
  lebarKolom_(sh, [100, 210, 120, 120, 120, 90, 120, 110, 110, 130, 85, 100]);
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
  const agg = new Map();
  const tambah = (bulan, store, kelompok, kategori, n) => {
    if (!store || !n) return;
    const k = [bulan, store, kelompok, kategori].join('|');
    agg.set(k, (agg.get(k) || 0) + n);
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
      kary.filter(aktif).forEach(x => tambah(b, x.store, 'Karyawan', x.kategori, x.jumlah));
      tetap.filter(aktif).forEach(x => tambah(b, x.store, 'Tetap', x.kategori, x.jumlah));
      m++; if (m > 12) { m = 1; y++; }
    }
  }
  bulanan.forEach(r => tambah(r.bulan, r.store, 'Operasional', r.kategori, r.jumlah));
  // [bulan, kodeStore, kelompok (Karyawan|Tetap|Operasional), kategori/jabatan, jumlah]
  return [...agg.entries()].map(([k, v]) => k.split('|').concat([Math.round(v)]));
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
    ['REKAP_PROFIT', '-', 'Laba rugi per outlet untuk bulan di B1. Laba operasional = Omzet − HPP bahan − Karyawan − Biaya tetap − Biaya bulanan. Margin % = Laba operasional ÷ Omzet.']
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
