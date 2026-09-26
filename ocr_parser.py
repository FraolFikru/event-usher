"""
CBE Receipt OCR + Parser
Modular module – handles image preprocessing and extraction of
Transaction ID + Amount from Commercial Bank of Ethiopia success screens.
"""

import re
from io import BytesIO
from PIL import Image, ImageOps, ImageEnhance, ImageFilter
import pytesseract


def preprocess_image(image: Image.Image) -> Image.Image:
    """Make the image easier for Tesseract to read."""
    # Convert to grayscale
    img = image.convert("L")

    # Increase contrast
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2.2)

    # Slight sharpen
    img = img.filter(ImageFilter.SHARPEN)

    # Resize if too large (speeds up OCR a lot)
    max_side = 1000
    if max(img.size) > max_side:
        img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)

    # Optional: binary threshold for cleaner text
    img = img.point(lambda x: 0 if x < 140 else 255, "1")

    return img


def extract_text(image: Image.Image) -> str:
    """Run Tesseract on a preprocessed image."""
    processed = preprocess_image(image)
    # PSM 6 = assume a single uniform block of text
    custom_config = r"--oem 3 --psm 6"
    text = pytesseract.image_to_string(processed, config=custom_config)
    return text


def parse_cbe_text(text: str) -> dict:
    """
    Extract Transaction ID and main Amount from CBE OCR text.
    Returns dict with keys: tx_id, amount, raw_text
    """
    text = text.replace("\n", " ").replace("  ", " ")

    # --- Transaction ID (CBE format usually starts with FT) ---
    tx_id = ""
    ft_match = re.search(r"FT[0-9A-Z]{8,16}", text, re.IGNORECASE)
    if ft_match:
        tx_id = ft_match.group(0).upper()
    else:
        # Fallback patterns
        id_match = re.search(r"(?:Transaction\s*ID|ID)[:\s]*([A-Z0-9]{8,})", text, re.IGNORECASE)
        if id_match:
            tx_id = id_match.group(1).upper()

    # --- Amount ---
    # Find all ETB / Birr style numbers
    amount_matches = re.findall(r"(?:ETB|Br|Birr)?\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    amounts = []
    for m in amount_matches:
        try:
            val = float(m.replace(",", ""))
            if 50 <= val <= 500000:  # reasonable range for event payments
                amounts.append(val)
        except ValueError:
            continue

    amount = 0.0
    if amounts:
        # Prefer whole numbers (the actual transfer amount, not fees)
        whole = [a for a in amounts if a == int(a) or a % 1 == 0]
        if whole:
            amount = max(whole)
        else:
            amount = max(amounts)

    return {
        "tx_id": tx_id,
        "amount": int(round(amount)),
        "raw_text": text[:500]  # for debugging
    }


def process_receipt(image_bytes: bytes) -> dict:
    """
    Full pipeline: bytes → PIL Image → OCR → parsed fields
    """
    try:
        image = Image.open(BytesIO(image_bytes))
        # Auto-orient if EXIF present
        image = ImageOps.exif_transpose(image)

        text = extract_text(image)
        result = parse_cbe_text(text)
        result["success"] = bool(result["tx_id"] or result["amount"] > 0)
        return result
    except Exception as e:
        return {
            "tx_id": "",
            "amount": 0,
            "raw_text": "",
            "success": False,
            "error": str(e)
        }
