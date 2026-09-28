# Dashboard HPP

Dashboard food cost & deteksi anomali belanja bahan baku untuk grup FnB multi-brand
(Uri Gukbap · Bakmi Awei 88 · Baboy · Bakmi Dua Wajah). Data diambil langsung dari
Google Sheet "HPP" lewat Apps Script. Halaman ini statis, di-host di GitHub Pages.

## Cara pakai

1. Di Google Sheet: menu **🍜 HPP › Buat / ganti kunci dashboard**. Muncul kunci + URL Apps Script.
2. Buka dashboard → **Pengaturan** → isi URL (`…/exec`) dan kunci → **Simpan & sambungkan**.
   Keduanya hanya disimpan di browser itu (localStorage), tidak ikut ke GitHub.
3. Mau lihat contoh dulu? **Pengaturan › Coba pakai data demo** (data fiktif).

## Apa yang dideteksi

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
`Laba operasional = Omzet − HPP bahan − Karyawan − Biaya tetap − Biaya bulanan`, `Margin = Laba operasional ÷ Omzet`.
Sumbernya 3 sheet yang diisi HO: **MASTER_KARYAWAN** (per nama & jabatan), **BIAYA_TETAP** (sewa, internet, dll per bulan)
dan **BIAYA_BULANAN** (listrik, air, perbaikan, marketing, komisi ojol, dll). Ke dashboard hanya dikirim total per
jabatan/kategori — nama & gaji per orang tetap di Google Sheet. Bulan berjalan: biaya karyawan & tetap dihitung
proporsional dengan hari yang sudah lewat.

## Analisis AI (hemat token)

Tombol **✨ Analisis AI** hanya jalan saat diklik. Yang dikirim ke Claude hanya **ringkasan**
(maks. 15 anomali teratas + food cost per outlet 3 bulan), bukan data mentah — ±1.500–2.500 token
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
