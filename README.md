# Dashboard Restoran

Dashboard performa restoran (per outlet & gabungan) untuk grup FnB multi-brand
(Uri Gukbap · Bakmi Awei 88 · Baboy · Bakmi Dua Wajah). Data diambil langsung dari
Google Sheet "HPP" lewat Apps Script. Halaman ini statis, di-host di GitHub Pages.

## Cara pakai

1. Di Google Sheet: menu **🍜 HPP › Buat / ganti kunci dashboard**. Muncul kunci + URL Apps Script.
2. Buka dashboard → **Pengaturan** → isi URL (`…/exec`) dan kunci → **Simpan & sambungkan**.
   Keduanya hanya disimpan di browser itu (localStorage), tidak ikut ke GitHub.
3. Mau lihat contoh dulu? **Pengaturan › Coba pakai data demo** (data fiktif).

## Isi dashboard

Filter periode, brand & outlet berlaku untuk semua tab. Angka utama di atas: omzet, laba operasional + margin,
food cost, biaya karyawan, rata-rata per struk, jumlah anomali (semua dibanding periode sebelumnya).

| Tab | Isi |
|---|---|
| **Ringkasan** | Panel *Kemarin & bulan ini* (omzet kemarin vs minggu lalu, bulan berjalan + proyeksi + jalur target, status input tiap outlet) · omzet per bulan per outlet · tren margin / prime cost / food cost · tabel performa (status, capaian target, prime cost) · per brand · perlu perhatian · Analisis AI · tren bulanan |
| **Outlet** | Kartu tiap outlet (omzet, tren, capaian target) → klik untuk detail: ringkasan angka (target, margin, prime cost, titik impas, kemarin, saldo kas), omzet harian, margin per bulan, laba rugi, tim, bahan terbesar, anomali |
| **Penjualan** | Omzet harian + rata-rata 7 hari · rata-rata per hari dalam minggu · rata-rata per struk · heatmap pola ramai outlet × hari · tabel penjualan per outlet |
| **Cashflow** | Kas masuk vs keluar per bulan · laporan arus kas bulanan (saldo awal → kas masuk → kas keluar → arus bersih → saldo akhir) · cashflow per cabang · saldo kas harian · saldo awal & mutasi manual |
| **Profit** | Margin per outlet per bulan · laba rugi per outlet (klik untuk rincian biaya) · titik impas per outlet · biaya per pos |
| **Belanja & Pembelian** | Belanja bahan per kategori · food cost per outlet · tabel bahan (harga vs periode sebelumnya) · pembelian non-bahan per kategori & sumber uang · riwayat belanja & pembelian lengkap (cari, catatan, link foto nota) |
| **Anomali** | Semua temuan deteksi otomatis, bisa difilter per jenis, tiap kartu ada grafiknya |

Perbandingan "vs periode sebelumnya" selalu **setara**: kalau periode mencakup bulan berjalan, pembandingnya dipotong
di tanggal yang sama (mis. 1–28 Sep vs 1–28 Agu). Tiap grafik punya tombol **Tabel**, dan filter tersimpan di link
(bisa di-bookmark / dibagikan).

**Target** diisi di sheet **TARGET_OUTLET** (target omzet per bulan, batas food cost, target margin per outlet).
**Prime cost** = (bahan + karyawan) ÷ omzet, patokan ≤ 65%. **Titik impas** = omzet per hari minimal supaya tidak rugi
(biaya tetap ÷ (1 − rasio biaya variabel)).

Status outlet: **Kritis** kalau rugi atau food cost > batas + 5 poin; **Perlu perhatian** kalau margin < 10%,
food cost > batas (35% atau batas outlet di TARGET_OUTLET), margin di bawah target outlet, atau ada anomali tingkat tinggi.

## Apa yang dideteksi (tab Anomali)

Semua deteksi jalan di browser, murni statistik (median & MAD / robust z-score), **tanpa token AI**:

| Dimensi | Deteksi |
|---|---|
| Per bahan | Harga melonjak vs histori 60 hari outlet itu sendiri · Harga lebih mahal dari outlet lain (bahan & bulan sama) · Kenaikan serentak di ≥3 outlet (kemungkinan harga pasar) · Pemakaian (qty) melonjak vs 3–6 bulan sebelumnya, disesuaikan dengan omzet |
| Per outlet | Food cost di atas batas · naik dari biasanya · lebih tinggi dari outlet lain |
| Per bulan | Porsi belanja per kategori terhadap omzet melonjak · total belanja melonjak (kalau omzet kosong) |
| Profit | Biaya bulanan per kategori melonjak (listrik, perbaikan, dll) · margin operasional turun / rugi · biaya karyawan > 30% omzet |
| Kualitas data | Omzet tidak diinput beberapa hari · outlet tidak input belanja >7 hari · kemungkinan input dobel |

Deteksi butuh histori ±3 bulan supaya perbandingannya adil.

## Profit & margin

Tab **Profit** menghitung laba rugi per outlet:
`Laba operasional = Omzet − HPP bahan − Karyawan − Biaya tetap − Biaya bulanan − Pembelian lain`, `Margin = Laba operasional ÷ Omzet`.
Sumbernya 3 sheet yang diisi HO: **MASTER_KARYAWAN** (per nama & jabatan), **BIAYA_TETAP** (sewa, internet, dll per bulan)
dan **BIAYA_BULANAN** (listrik, air, perbaikan, marketing, komisi ojol, dll). Ke dashboard hanya dikirim total per
jabatan/kategori — nama & gaji per orang tetap di Google Sheet. Bulan berjalan: biaya karyawan & tetap dihitung
proporsional dengan hari yang sudah lewat.

## Pembelian non-bahan

Tab **Pembelian** di app HP untuk barang di luar bahan baku (peralatan dapur, perlengkapan saji, kebersihan, ATK,
perbaikan kecil, transport/parkir). Masuk sheet **INPUT_PEMBELIAN**, terpisah dari INPUT_BELANJA, jadi **tidak
menaikkan food cost**, tapi tetap mengurangi laba operasional ("Pembelian lain"). Tiap kiriman mencatat
**Dibayar dari** (kas outlet tunai / uang pribadi-reimburse / transfer HO) sebagai dasar hitung kas bersih nanti.

## Cashflow per cabang

Sheet **SALDO_AWAL_KAS** berisi saldo awal tiap outlet (default **Rp100.000.000**, otomatis dibuat saat menu Setup)
dan tanggal kas mulai dihitung. Sheet **MUTASI_KAS** untuk uang keluar/masuk yang bukan omzet atau belanja
(setoran ke HO, tambahan modal, koreksi selisih). Dashboard menghitung:
`Kas = saldo awal + omzet − belanja bahan − pembelian lain − gaji − biaya tetap − tagihan ± mutasi`.
Gaji, biaya tetap & tagihan bulanan dianggap dibayar di akhir bulan; untuk bulan berjalan ditampilkan sebagai
"belum dibayar". Semua pengeluaran outlet mengurangi kas outlet, siapa pun yang membayar.

## Analisis AI (hemat token)

Tombol **✨ Analisis AI** (tab Ringkasan) hanya jalan saat diklik. Yang dikirim ke Claude hanya **ringkasan**
(performa tiap outlet, margin & food cost 3 bulan, anomali teratas, bahan terbesar), bukan data mentah — ±1.500–2.500 token
per analisis. Hasil disimpan di browser; selama data & filter belum berubah, hasil lama ditampilkan
tanpa memanggil AI lagi.

- API key Claude disimpan di **Script Properties** Apps Script (menu **🍜 HPP › Set API key Claude**),
  tidak pernah ada di halaman ini atau di GitHub.
- Pengaman biaya: maks. 30 analisis per hari (ubah `AI_MAKS_PER_HARI` di Code.gs).
- Model: Haiku 4.5 (default, paling hemat, ±$0,006/analisis), Sonnet 5 (lebih tajam, ±$0,012) atau Opus 5.5 (paling dalam, ±$0,024).

## File

- `index.html`, `style.css`, `app.js` — tampilan & logika dashboard
- `anomali.js` — mesin deteksi anomali (bisa dites di Node: `node -e "require('./anomali.js')"`)
- `demo.js` — generator data demo fiktif dengan anomali yang sengaja ditanam
- `apps-script/Code.gs`, `apps-script/Index.html` — salinan backend Google Apps Script & app HP tim outlet
