# Backend Anti-Cheat — Coin Flip

## Kenapa ini penting (baca dulu sebelum ngoding)

Di versi lama (file HTML kamu), semua ini jalan **di browser user**:
- Variabel `balance`
- Fungsi `flip()` yang nentuin menang/kalah
- `stepIndex` buat ladder

Masalahnya: **apapun yang jalan di browser, sepenuhnya di bawah kendali orang yang pegang browser itu**. User bisa buka DevTools, ketik `balance = 999999999`, atau ubah fungsi `flip` biar selalu `win = true`. Nggak ada cara nutup itu selama logikanya di client.

Solusinya: pindahin 3 hal ini ke server —
1. **Saldo** (disimpan di database, bukan variabel JS)
2. **RNG / hasil flip** (dilempar di server, browser cuma nampilin hasil yang dikirim balik)
3. **Status ronde** (server yang inget kamu lagi di step berapa — browser nggak bisa "ngaku")

## Cara jalanin dari HP (pakai Replit — gratis, di browser)

1. Buka **replit.com** di browser HP kamu, bikin akun (gratis).
2. Tap **Create App/Repl** → pilih template **Node.js**.
3. Di panel file Replit, hapus `index.js` bawaan, lalu bikin 3 file ini dan copy-paste isinya dari project ini:
   - `package.json`
   - `db.js`
   - `server.js`
4. Buka tab **Shell** di Replit, ketik:
   ```
   npm install
   ```
5. Tap tombol **Run**. Kalau berhasil, muncul `Server jalan di port 3000` dan Replit kasih kamu URL publik (misal `https://nama-project.namamu.repl.co`).
6. Test pakai tab **Shell** juga, contoh daftar akun:
   ```
   curl -X POST http://localhost:3000/api/register -H "Content-Type: application/json" -d '{"username":"budi","password":"rahasia123"}'
   ```

## Daftar endpoint

| Endpoint | Fungsi |
|---|---|
| `POST /api/register` | Daftar akun baru, saldo mulai 1000 |
| `POST /api/login` | Login |
| `GET /api/balance` | Lihat saldo asli dari database |
| `POST /api/flip` | Pasang taruhan (ronde baru) atau lanjut flip (ronde aktif) |
| `POST /api/cashout` | Ambil kemenangan sesuai step sekarang |
| `POST /api/reset-my-balance` | Reset saldo **akun sendiri** ke 1000 |

## Kenapa TIDAK ada endpoint "atur user lain menang/kalah"

Sengaja nggak dibuat. Kalau endpoint itu ada, siapa pun yang pegang akses admin bisa nentuin hasil taruhan orang lain secara sepihak — di sistem yang pakai currency kayak WL/DL (yang punya nilai tukar uang nyata), itu jadi alat curang. Semua endpoint di atas cuma bisa mengubah data milik user yang sedang login (`req.session.userId`), nggak bisa nyentuh akun orang lain.

## Langkah selanjutnya (kalau mau lanjut)

- Sambungkan file HTML kamu (`vanoprojek.html`) ke backend ini: ganti fungsi `flip()` dan `updateBalance()` supaya pakai `fetch('/api/flip', ...)` dll, bukan variabel lokal.
- Tambah tabel `transactions` bisa dipakai bikin halaman "riwayat" biar user bisa lihat semua taruhannya.
- Kalau mau belajar lebih jauh soal deteksi anomali: bikin query yang cek kalau ada user yang win-rate-nya jauh di atas 50% terus — itu tanda ada bug atau eksploitasi.

Kalau kamu mau, aku bisa lanjut bantu sambungin file HTML kamu ke backend ini biar beneran jalan end-to-end — tinggal bilang aja.

## Update: Sistem Login/Daftar Sungguhan

Backend sekarang punya sistem akun asli (username, email, password) dan halaman
`vanoprojek.html` sudah disambungkan ke situ lewat tombol Masuk/Daftar.

### Struktur folder yang benar sekarang:
```
coinflip-backend/
├── server.js
├── db.js
├── package.json
└── public/
    └── vanoprojek.html   <-- taruh file HTML di sini
```

### Cara jalanin:
```
mkdir -p ~/coinflip-backend/public
cp ~/storage/shared/coding/*.js ~/coinflip-backend/
cp ~/storage/shared/coding/*.json ~/coinflip-backend/
cp ~/storage/shared/coding/vanoprojek.html ~/coinflip-backend/public/
cd ~/coinflip-backend
npm install
node server.js
```

### PENTING - cara buka halamannya:
Jangan buka file HTML langsung lewat file manager / Acode preview (itu pakai
`file://`, bukan server, jadi tombol login tidak akan bisa menghubungi API).

Buka lewat browser HP dengan alamat:
```
http://localhost:3000/vanoprojek.html
```

Kalau server di-tunnel/diakses dari device lain, ganti `localhost` dengan
alamat IP atau domain server-nya.

### Yang bisa dicoba:
1. Tap **Daftar** → isi email, username, password (minimal 6 karakter) → akun
   baru dibuat, saldo mulai 1000 WL, langsung "login".
2. Refresh halaman → nama kamu tetap muncul di pojok kanan atas (sesi
   tersimpan lewat cookie).
3. Tap **Keluar** → sesi berakhir, tombol Masuk/Daftar muncul lagi.
4. Coba daftar dengan email yang sama dua kali → akan ditolak ("Email sudah
   terdaftar").

### Catatan
Fitur coin flip di halaman ini masih pakai variabel lokal browser (belum
disambungkan ke `/api/flip`). Saldo yang muncul setelah login adalah saldo
ASLI dari server, tapi begitu main game, perubahannya masih sementara di
browser saja. Itu langkah berikutnya kalau mau lanjut.
