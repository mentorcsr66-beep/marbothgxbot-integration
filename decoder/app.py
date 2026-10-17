import base64
import hmac
import io
import os

import zxingcpp
from flask import Flask, jsonify, request
from PIL import Image, UnidentifiedImageError

app = Flask(__name__)
SHARED_KEY = os.environ["DECODER_SHARED_KEY"]

@app.get("/health")
def health():
    return jsonify(status="ok")

@app.post("/decode")
def decode():
    supplied = request.headers.get("X-Decoder-Key", "")
    if not hmac.compare_digest(supplied, SHARED_KEY):
        return jsonify(error="unauthorized"), 403
    data = request.get_json(silent=True) or {}
    try:
        image_bytes = base64.b64decode(data.get("image_base64", ""), validate=True)
        if len(image_bytes) > 20 * 1024 * 1024:
            return jsonify(error="image_too_large"), 413
        with Image.open(io.BytesIO(image_bytes)) as image:
            results = zxingcpp.read_barcodes(image, formats=zxingcpp.BarcodeFormat.QRCode)
    except (ValueError, UnidentifiedImageError, OSError):
        return jsonify(error="invalid_image"), 400
    if not results:
        return jsonify(payload=None)
    return jsonify(payload=results[0].text)
