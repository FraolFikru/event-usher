# Event Usher – CBE Payment Scanner

Lightweight prototype for event entrance:  
Take a photo of a CBE success screen → auto-extracts Transaction ID + Amount → logs entry with guest count.

## Structure (modular)

```
event-usher/
├── main.py              ← Python HTTP server
├── ocr_parser.py        ← OCR + CBE parsing logic
├── static/
│   ├── index.html       ← UI
│   ├── app.js           ← Frontend logic
│   └── style.css        ← Extra styles
└── README.md
```

## How to run

1. Make sure you have Python 3 + Tesseract installed:
   ```bash
   # Ubuntu/Debian
   sudo apt install tesseract-ocr
   pip install pillow pytesseract
   ```

2. Start the server:
   ```bash
   cd event-usher
   python main.py
   ```

3. On your phone (same Wi-Fi / hotspot):
   - Find your laptop IP (`ip addr` or `ipconfig`)
   - Open: `http://YOUR-IP:8080`

4. Take a photo of the CBE receipt → it auto-fills → adjust guests if needed → Confirm.

## Notes

- Data is saved in the phone’s browser localStorage (survives refresh).
- Images are compressed so storage doesn’t fill up quickly.
- OCR runs on the Python side → much faster & more accurate than browser Tesseract.
- Guest count is auto-calculated from Amount ÷ Price Per Person.
