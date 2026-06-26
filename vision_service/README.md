# CrediSafe Vision Service

This FastAPI service turns a short road/dashcam clip into **registration-plate verification evidence**.

## What is real in this build

- OpenCV samples the uploaded video and finds plate-shaped regions.
- Tesseract OCR reads candidate Indian registration numbers.
- Multiple reads are combined through majority/near-duplicate voting.
- The result can be matched to the vehicle registered in CrediSafe.
- Uploaded files are deleted immediately after processing.

## What is deliberately not claimed

This service does **not** detect signal compliance, helmet use, phone use, lane discipline, braking behaviour or rewards. The old prototype assigned those rules randomly; that behaviour has been removed from the merged product.

## Windows setup

1. Install Python 3.11 or 3.12.
2. Install Tesseract OCR and ensure `tesseract.exe` is available on PATH.
3. Create and activate a virtual environment:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r vision_service\requirements.txt
```

4. Set the API key in both the root `.env.local` and the Python terminal.
5. Run:

```powershell
python -m uvicorn vision_service.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Health check: `http://127.0.0.1:8000/health`

## Model file

`models/yolov8n.pt` is preserved from the received developer project but is **not used by the verified plate-OCR pipeline**. It is a generic COCO detector and does not provide helmet, red-light or driving-behaviour detection by itself.
