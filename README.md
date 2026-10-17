# @marbothgxbot — bot QR di FadeHost

Bot ini memakai polling Telegram. Kirim foto QR ke https://t.me/marbothgxbot, lalu bot membalas secret code. Komputer Anda tidak perlu menyala. Kode bot ada di bot.py dan dependensinya di requirements.txt.

## Deploy

1. Di FadeHost, buka Bots → Host a bot → Telegram bot.
2. Pilih Your own repository, hubungkan GitHub bila diminta, lalu pilih repo privat ini dan branch main.
3. Pilih paket gratis untuk bot polling. Runtime Python seharusnya terdeteksi dari requirements.txt; perintah mulai python bot.py.
4. Isi hanya TELEGRAM_BOT_TOKEN dengan token dari BotFather di panel FadeHost. Jangan simpan token di GitHub atau kirim lewat chat.
5. Deploy, lalu kirim /start dan foto QR untuk memastikan bot membalas.

FadeHost menyebut satu bot pertama gratis, polling always-on, dan 256 MB RAM untuk paket gratis. Detail paket dan ketersediaan dapat berubah; pastikan paket yang dipilih memang gratis sebelum deploy.

Secret code adalah HMAC deterministik: QR yang sama menghasilkan kode yang sama selama token bot tidak diganti. QR asli dan hasilnya tidak disimpan. Google Sheets dan Apps Script yang dibuat sebelumnya tidak diperlukan untuk menjalankan versi bot ini.

Folder apps_script/ dan decoder/ adalah rancangan Cloud Run lama dan tidak dipakai oleh deploy FadeHost.
