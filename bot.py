import base64
import hashlib
import hmac
import io
import logging
import os

import zxingcpp
from PIL import Image, UnidentifiedImageError
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters


logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("marbothgxbot")
TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]


def secret_code(payload: str) -> str:
    """Create a stable, opaque code for the QR payload using the bot token as key."""
    digest = hmac.new(TOKEN.encode(), payload.strip().encode(), hashlib.sha256).digest()
    return base64.b32encode(digest).decode("ascii").rstrip("=")[:12]


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.effective_message.reply_text(
        "Kirim gambar barcode QR, nanti saya balas dengan secret code."
    )


async def read_qr(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    photo = message.photo[-1]
    try:
        telegram_file = await context.bot.get_file(photo.file_id)
        image_data = await telegram_file.download_as_bytearray()
        if len(image_data) > 20 * 1024 * 1024:
            await message.reply_text("Ukuran gambar terlalu besar. Kirim gambar yang lebih kecil.")
            return
        with Image.open(io.BytesIO(image_data)) as image:
            results = zxingcpp.read_barcodes(
                image, formats=zxingcpp.BarcodeFormat.QRCode
            )
    except (UnidentifiedImageError, OSError, ValueError):
        await message.reply_text("Gambar tidak terbaca. Coba kirim ulang QR yang lebih jelas.")
        return
    except Exception:
        logger.exception("Gagal mengambil atau memindai gambar QR")
        await message.reply_text("QR belum bisa diproses. Coba kirim ulang sebentar lagi.")
        return

    if not results or not results[0].text:
        await message.reply_text("QR tidak ditemukan. Coba kirim gambar yang lebih jelas.")
        return

    await message.reply_text("Secret code: " + secret_code(results[0].text))


def main() -> None:
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler(["start", "help"], start))
    app.add_handler(MessageHandler(filters.PHOTO, read_qr))
    app.run_polling(drop_pending_updates=False)


if __name__ == "__main__":
    main()
