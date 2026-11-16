# POS Pintar UMKM

Aplikasi kasir web dengan Laravel 12, API JSON, dan MySQL. Antarmuka kasir ada di Laravel Blade dan memakai API backend yang sama.

## Menjalankan secara lokal (XAMPP)

1. Pastikan PHP 8.2+ dan Composer tersedia. Nyalakan **MySQL** di XAMPP.
2. Buat database MySQL bernama `pos_pintar` (collation `utf8mb4_unicode_ci` disarankan).
3. Periksa `.env`: isi `DB_DATABASE`, `DB_USERNAME`, dan `DB_PASSWORD` sesuai MySQL lokal.
4. Dari folder ini jalankan:

   ```powershell
   php artisan migrate
   php artisan serve
   ```

5. Untuk database baru, buat akun pertama dengan `php artisan pos:create-initial-accounts`. Perintah ini membuat owner dan kasir awal, lalu menampilkan password acak satu kali. Simpan kredensial tersebut.
6. Jalankan `php artisan serve`, buka `http://127.0.0.1:8000`, lalu login memakai username dan password yang ditampilkan.

## Deploy ke Vercel

Proyek ini berjalan sebagai aplikasi Laravel di container FrankenPHP; Vercel membangun asset Vite dari `resources` saat image dibuat. Root Directory Vercel harus menunjuk ke folder proyek ini.

Tambahkan environment variables berikut di **Vercel Project Settings → Environment Variables**:

- `APP_KEY`: hasil `php artisan key:generate --show` dari mesin lokal.
- `APP_URL`: URL deployment Vercel.
- `DB_CONNECTION=mysql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, dan `DB_PASSWORD`: koneksi ke database MySQL yang dapat diakses dari internet. MySQL lokal XAMPP tidak dapat digunakan langsung oleh deployment.
- `SESSION_DRIVER=database`, `CACHE_STORE=database`, dan `QUEUE_CONNECTION=database` agar data tidak bergantung pada filesystem container yang sementara.
- `MIDTRANS_SERVER_KEY` dan `MIDTRANS_BASE_URL` jika pembayaran QRIS diaktifkan.

Setelah database eksternal siap, jalankan `php artisan migrate --force` satu kali dengan kredensial database produksi. Setelah mengimpor repo, deploy ulang di Vercel. File `vercel.json` mengarahkan trafik ke container Laravel sehingga Vercel tidak mencari folder output statis `dist`.

## QRIS Midtrans

QRIS dinamis memerlukan akun merchant Midtrans yang sudah mengaktifkan QRIS. Pengembangan memakai sandbox terlebih dahulu. Isi `.env`:

```dotenv
MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_BASE_URL=https://api.sandbox.midtrans.com
```

Atur URL notifikasi pembayaran di dashboard sandbox ke:
`https://ALAMAT-PUBLIC-ANDA/api/payments/midtrans/notification`

Untuk pengujian lokal, gunakan tunnel HTTPS yang diarahkan ke port Laravel. Jangan menaruh Server Key di browser. Ganti base URL dan Server Key ke kredensial produksi hanya setelah proses onboarding merchant dan pengujian sandbox selesai.

Saat QRIS dibuat, transaksi berstatus `pending` dan stok dicadangkan. Stok baru dikurangi setelah notifikasi Midtrans terverifikasi. Transaksi tunai langsung berstatus lunas. Jika Server Key belum diisi, permintaan QRIS akan memberi pesan konfigurasi yang jelas.

## API ringkas

Semua respons API berformat JSON. Setelah login, kirim header `Authorization: Bearer <token>`.

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/login` | Login dengan username dan password |
| PATCH | `/api/password` | Ubah password akun aktif (password saat ini wajib) |
| GET | `/api/me` | Profil owner aktif |
| GET, POST | `/api/products` | Daftar dan tambah produk |
| PUT, DELETE | `/api/products/{id}` | Ubah atau hapus produk |
| POST | `/api/transactions` | Membuat transaksi tunai atau QRIS |
| GET | `/api/transactions` | Riwayat transaksi |
| GET | `/api/dashboard` | Ringkasan penjualan dan stok |
| POST | `/api/payments/midtrans/notification` | Webhook status pembayaran |

## Catatan

- API menggunakan bearer token acak; database hanya menyimpan hash token. Password di-hash Laravel.
- Buat akun owner melalui perintah terminal `php artisan pos:create-owner`; pendaftaran publik dinonaktifkan.
- Owner dapat mengelola produk dan membuat akun kasir dari menu **Akun Kasir**. Kasir hanya dapat membuat penjualan serta melihat produk dan stok.
- Owner dan kasir dapat mengubah password dari tombol **Ubah password** di bagian atas aplikasi. Password lama diverifikasi dan semua sesi lama akun tersebut dicabut.
- Kasir terhubung ke inventaris toko owner; endpoint backend juga membatasi akses kasir dari pengelolaan produk, dashboard, akun kasir, dan riwayat transaksi.
- Setiap akun owner hanya dapat melihat dan mengubah produknya sendiri.
- Stok dan transaksi diproses dalam transaksi database dengan penguncian stok.
- File `POS PINTAR UMKM.html` di folder induk adalah prototipe awal. Versi Laravel yang dikembangkan ada di folder `pos-pintar`.
- Jalankan migrasi hanya setelah database `pos_pintar` siap.
