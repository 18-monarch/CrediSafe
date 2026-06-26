r"""
FASTag Rewards - Backend with REAL Number Plate Detection
-----------------------------------------------------------
Plates are no longer picked from a hardcoded list. For every uploaded video:
  1. OpenCV's Haar Cascade locates plate-shaped rectangles in sampled frames.
  2. Tesseract OCR reads the actual characters off each cropped plate region.
  3. A regex check keeps only text that matches an Indian plate format
     (e.g. GJ01AB1234) - this filters out OCR noise/garbage.
  4. Each *real, unique* plate found gets rewarded once per video.

Honest limitation: deciding whether a driver actually followed a rule
(signal compliance, speed limit, seatbelt, lane discipline...) needs a real
trained vision model (YOLO + tracking + behaviour analysis), which is out of
scope for plain OpenCV + OCR. So once a real plate is detected, the specific
rule/points it's credited for is still chosen pseudo-randomly for the demo -
only the PLATE NUMBER itself is now genuinely read from the video.

Requirements (install once):
    pip install pytesseract
    # Tesseract OCR engine itself (NOT a pip package):
    #   Ubuntu/Debian:  sudo apt-get install tesseract-ocr
    #   macOS:          brew install tesseract
    #   Windows:        https://github.com/UB-Mannheim/tesseract/wiki
    # If tesseract isn't on your PATH (common on Windows), set this below:
    #   pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3, os, uuid, cv2, re, random
from datetime import datetime

try:
    import pytesseract
    TESSERACT_OK = True
except ImportError:
    TESSERACT_OK = False

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
DB_PATH    = os.path.join(BASE_DIR, "fastag.db")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = Flask(__name__)
CORS(app)

@app.after_request
def cors(r):
    r.headers["Access-Control-Allow-Origin"]  = "*"
    r.headers["Access-Control-Allow-Headers"] = "Content-Type"
    r.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return r

@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")

# ── Real plate detector (ships free with opencv-python, no extra download) ──
PLATE_CASCADE_PATH = cv2.data.haarcascades + "haarcascade_russian_plate_number.xml"
plate_cascade = cv2.CascadeClassifier(PLATE_CASCADE_PATH)

# Indian plate pattern - works for ALL Indian states
# Format: [STATE_CODE(2)][RTO_CODE(1-2)][SERIES(1-3)][NUMBER(4)]
# Examples: GJ01AB1234, DL8CAB1234, MH12DE5678, KA03MN9876, TN09BC1234
PLATE_REGEX  = re.compile(r'^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$')
PLATE_SHAPE  = re.compile(r'^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$')

# All valid Indian state/UT codes for validation (as of 2026)
VALID_STATE_CODES = {
    'AP', 'AR', 'AS', 'BR', 'CG', 'GA', 'GJ', 'HR', 'HP', 'JH', 'KA', 'KL',
    'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'OR', 'PB', 'RJ', 'SK', 'TN',
    'TS', 'TR', 'UP', 'UK', 'WB', 'AN', 'CH', 'DH', 'DD', 'DL', 'JK', 'LA',
    'LD', 'PY', 'BH'  # BH = Bihar (alternative), some older registrations
}

# Common Tesseract misreads, used to "nudge" a near-miss back into shape -
# e.g. a 5 that should have been an S because that position expects a letter.
LETTER_FIX = {'0':'O', '1':'I', '5':'S', '8':'B', '2':'Z', '6':'G', '4':'A'}
DIGIT_FIX  = {'O':'0', 'I':'1', 'L':'1', 'S':'5', 'B':'8', 'Z':'2', 'G':'6', 'Q':'0', 'A':'4'}

def fix_plate_text(text):
    """If `text` is close to a valid Indian plate but a character or two
    landed in the wrong character class (digit where a letter was expected,
    or vice versa), try to coerce it into shape. Returns corrected text or
    None if no plausible correction exists."""
    n = len(text)
    if n < 8 or n > 11:
        return None
    for rto_len in (1, 2):
        for series_len in (1, 2, 3):
            if 2 + rto_len + series_len + 4 != n:
                continue
            state  = text[0:2]
            rto    = text[2:2+rto_len]
            series = text[2+rto_len:2+rto_len+series_len]
            num    = text[-4:]

            state_fixed  = ''.join(LETTER_FIX.get(c, c) if not c.isalpha() else c for c in state)
            series_fixed = ''.join(LETTER_FIX.get(c, c) if not c.isalpha() else c for c in series)
            rto_fixed    = ''.join(DIGIT_FIX.get(c, c) if not c.isdigit() else c for c in rto)
            num_fixed    = ''.join(DIGIT_FIX.get(c, c) if not c.isdigit() else c for c in num)

            candidate = state_fixed + rto_fixed + series_fixed + num_fixed
            if PLATE_REGEX.match(candidate):
                return candidate
    return None

RULES = [
    {"key":"signal",   "label":"Signal Compliance",  "icon":"🚦","pts":15},
    {"key":"speed",    "label":"Speed Limit OK",      "icon":"🛣️","pts":20},
    {"key":"lane",     "label":"Lane Discipline",     "icon":"🚗","pts":10},
    {"key":"nophone",  "label":"No-Phone Zone",       "icon":"📵","pts":12},
    {"key":"puc",      "label":"PUC Valid Bonus",     "icon":"♻️","pts":25},
    {"key":"parking",  "label":"Legal Parking",       "icon":"🅿️","pts": 8},
    {"key":"seatbelt", "label":"Seatbelt Detected",   "icon":"🛡️","pts":10},
    {"key":"night",    "label":"Night Drive Safe",    "icon":"🌙","pts":30},
]

# ── DB ──
def init_db():
    con = sqlite3.connect(DB_PATH)
    
    # Create vehicles table
    con.execute("""CREATE TABLE IF NOT EXISTS vehicles(
        plate TEXT PRIMARY KEY, 
        points INTEGER DEFAULT 0, 
        updated TEXT
    )""")
    
    # Create events table
    con.execute("""CREATE TABLE IF NOT EXISTS events(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate TEXT, 
        rule TEXT, 
        icon TEXT, 
        points INTEGER,
        frame_sec REAL, 
        timestamp TEXT, 
        video_id TEXT
    )""")
    
    # Check if 'updated' column exists in vehicles table, if not add it
    cursor = con.execute("PRAGMA table_info(vehicles)")
    columns = [row[1] for row in cursor.fetchall()]
    if 'updated' not in columns:
        print("   🔧 Migrating database: Adding 'updated' column to vehicles table")
        con.execute("ALTER TABLE vehicles ADD COLUMN updated TEXT")
    
    con.commit()
    con.close()

init_db()

# ── ROUTES ──

@app.route("/api/status")
def status():
    return jsonify({
        "status": "running",
        "plate_detector": "opencv-haarcascade",
        "ocr": "tesseract" if TESSERACT_OK else "NOT INSTALLED - run: pip install pytesseract"
    })

@app.route("/api/upload", methods=["POST","OPTIONS"])
def upload():
    if request.method == "OPTIONS":
        return jsonify({"ok":True})

    if "video" not in request.files:
        return jsonify({"error":"No video"}), 400

    try:
        f        = request.files["video"]
        vid_id   = str(uuid.uuid4())[:8]
        path     = os.path.join(UPLOAD_DIR, f"{vid_id}.mp4")
        f.save(path)

        detections = process(path, vid_id)

        # Save to DB
        con = sqlite3.connect(DB_PATH)
        for d in detections:
            con.execute("""INSERT INTO vehicles(plate,points,updated) VALUES(?,?,?)
                ON CONFLICT(plate) DO UPDATE SET points=points+excluded.points, updated=excluded.updated""",
                (d["plate"], d["points"], d["timestamp"]))
            con.execute("""INSERT INTO events(plate,rule,icon,points,frame_sec,timestamp,video_id)
                VALUES(?,?,?,?,?,?,?)""",
                (d["plate"],d["rule"],d["icon"],d["points"],d["frame_sec"],d["timestamp"],vid_id))
        con.commit(); con.close()

        # Clean up uploaded video file to save disk space
        try:
            os.remove(path)
        except OSError:
            pass

        return jsonify({
            "video_id": vid_id,
            "detections": detections,
            "summary": {
                "total_detected": len(detections),
                "unique_plates":  len(set(d["plate"] for d in detections)),
                "total_points":   sum(d["points"] for d in detections),
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500


def clean_plate_text(raw):
    """Keep only A-Z/0-9 from raw OCR output."""
    return re.sub(r'[^A-Z0-9]', '', raw.upper())


def is_valid_plate(text):
    """Reject OCR noise - only accept text shaped like a real Indian plate.
    Validates both format AND state code against all Indian states/UTs."""
    if not PLATE_REGEX.match(text):
        return False
    # Extract state code (first 2 characters) and verify it's valid
    state_code = text[:2]
    return state_code in VALID_STATE_CODES


DETECT_MAX_WIDTH  = 800   # cascade runs on a downscaled copy of the frame - much faster
MAX_CANDIDATES_PER_FRAME = 8  # cap OCR calls per frame so noisy cascades can't stall processing


def read_plate_from_roi(gray_roi, debug_label=""):
    """Run Tesseract on a cropped plate region. Returns clean text or None.
    Always prints what Tesseract actually read (even if rejected) so you can
    debug real footage from the terminal - e.g. see if it's reading 'GJ0lAB1234'
    (a 1 misread as l) so you know it's close but not validating.
    
    Now validates plates from ALL Indian states, not just Gujarat."""
    if not TESSERACT_OK or gray_roi.size == 0:
        return None
    try:
        roi = cv2.resize(gray_roi, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
        roi = cv2.bilateralFilter(roi, 11, 17, 17)
        roi = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
        config = "--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        raw_text = pytesseract.image_to_string(roi, config=config)
        text = clean_plate_text(raw_text)
        if not text:
            return None

        if is_valid_plate(text):
            state_code = text[:2]
            print(f"   🔎 OCR read{debug_label}: '{text}' (State: {state_code})  ✅ valid")
            return text

        fixed = fix_plate_text(text)
        if fixed and is_valid_plate(fixed):
            state_code = fixed[:2]
            print(f"   🔎 OCR read{debug_label}: '{text}' → corrected '{fixed}' (State: {state_code})  ✅ valid")
            return fixed

        print(f"   🔎 OCR read{debug_label}: '{text}'  ❌ rejected (not valid Indian plate format or invalid state code)")
        return None
    except Exception:
        return None


def process(path, vid_id):
    """
    Real detection pipeline (no fake plate pool, no random plate picking):
      1. Sample ~1 frame per second.
      2. Haar cascade finds plate-shaped rectangles (on a downscaled frame,
         for speed) then OCR reads the matching region from the full-res frame.
      3. Tesseract OCRs each candidate region; near-misses get nudged back
         into shape via fix_plate_text() (handles common K/X, 5/S, etc misreads).
      4. The SAME physical plate gets read slightly differently almost every
         frame (sensor noise, motion blur). Instead of rewarding whichever
         random misread happens to validate first, we collect every reading
         across the whole video and reward the text that was read MOST OFTEN -
         a simple majority vote that's far more reliable than "first lucky hit".
      5. Each plate is rewarded once per video with a (still simulated)
         compliance rule - see module docstring for why that part isn't real yet.
    """
    if not TESSERACT_OK:
        raise RuntimeError(
            "pytesseract is not installed. Run: pip install pytesseract "
            "and make sure the Tesseract OCR engine is installed on your system."
        )

    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return []

    fps          = cap.get(cv2.CAP_PROP_FPS) or 25
    sample_every = max(1, int(fps))  # ~1 sampled frame per second
    frame_idx    = 0
    max_frames_to_read = 3000  # safety cap so huge videos don't hang

    raw_hits = []  # (plate_text, frame_sec, bbox) - every accepted OCR read, before voting

    try:
        while frame_idx < max_frames_to_read:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_every != 0:
                frame_idx += 1
                continue

            ts        = round(frame_idx / fps, 1)
            full_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            h0, w0    = full_gray.shape[:2]
            scale     = min(1.0, DETECT_MAX_WIDTH / w0)

            small_gray = cv2.resize(full_gray, None, fx=scale, fy=scale) if scale < 1.0 else full_gray
            small_gray = cv2.equalizeHist(small_gray)

            candidates = plate_cascade.detectMultiScale(
                small_gray, scaleFactor=1.05, minNeighbors=5, minSize=(70, 22)
            )[:MAX_CANDIDATES_PER_FRAME]

            for (x, y, w, h) in candidates:
                # map detection coords from the downscaled frame back to full-res,
                # so OCR reads the original sharp pixels, not a blurrier shrunk copy
                fx, fy, fw, fh = (int(v / scale) for v in (x, y, w, h))
                roi = full_gray[fy:fy+fh, fx:fx+fw]
                plate_text = read_plate_from_roi(roi, debug_label=f" @ t={ts}s")
                if plate_text:
                    raw_hits.append((plate_text, ts, (fx, fy, fw, fh)))

            frame_idx += 1
            if len(raw_hits) >= 300:  # safety cap on raw OCR attempts, not final detections
                break
    finally:
        cap.release()

    # Majority vote: the same physical plate gets read slightly differently
    # almost every frame, so trust whichever exact text was read most often.
    counts     = {}
    first_seen = {}
    for text, ts, bbox in raw_hits:
        counts[text] = counts.get(text, 0) + 1
        if text not in first_seen:
            first_seen[text] = (ts, bbox)

    # Prefer plates confirmed by 2+ reads; only fall back to single sightings
    # if literally nothing repeated (e.g. a very short clip).
    confirmed = [t for t, c in counts.items() if c >= 2]
    final_plates = confirmed if confirmed else list(counts.keys())
    final_plates.sort(key=lambda t: -counts[t])

    detections = []
    for plate_text in final_plates[:15]:
        ts, (fx, fy, fw, fh) = first_seen[plate_text]
        rule = random.choice(RULES)
        detections.append({
            "plate":     plate_text,
            "rule":      rule["label"],
            "rule_key":  rule["key"],
            "icon":      rule["icon"],
            "points":    rule["pts"],
            "frame_sec": ts,
            "timestamp": datetime.now().isoformat(),
            "video_id":  vid_id,
            "bbox":      {"x1": fx, "y1": fy, "x2": fx+fw, "y2": fy+fh},
            "ocr_confidence_reads": counts[plate_text],
        })

    print(f"✅ Processed {path} → {len(detections)} real plate(s) detected from ALL Indian states (from {len(raw_hits)} OCR reads)")
    return detections


@app.route("/api/plate/<plate>")
def plate_info(plate):
    plate = re.sub(r'[^A-Z0-9]','',plate.upper())
    con   = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    v = con.execute("SELECT * FROM vehicles WHERE plate=?",(plate,)).fetchone()
    e = con.execute("SELECT * FROM events WHERE plate=? ORDER BY id DESC LIMIT 20",(plate,)).fetchall()
    con.close()
    if not v:
        return jsonify({"found":False,"plate":plate,"points":0,"history":[]})
    return jsonify({
        "found":   True,
        "plate":   plate,
        "points":  v["points"],
        "history": [{"rule":x["rule"],"icon":x["icon"],"points":x["points"],
                     "timestamp":x["timestamp"],"video_id":x["video_id"]} for x in e]
    })

@app.route("/api/leaderboard")
def leaderboard():
    con  = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    rows = con.execute("SELECT plate,points FROM vehicles ORDER BY points DESC LIMIT 10").fetchall()
    con.close()
    return jsonify([{"plate":r["plate"],"points":r["points"]} for r in rows])

@app.route("/api/stats")
def stats():
    con = sqlite3.connect(DB_PATH)
    tv = con.execute("SELECT COUNT(*) FROM vehicles").fetchone()[0]
    te = con.execute("SELECT COUNT(*) FROM events").fetchone()[0]
    tp = con.execute("SELECT COALESCE(SUM(points),0) FROM events").fetchone()[0]
    con.close()
    return jsonify({"total_vehicles":tv,"total_events":te,"total_points":tp})

if __name__ == "__main__":
    print("\n🚗 FASTag Backend — Real Plate Detection Mode (ALL INDIA)")
    print("   OpenCV Haar Cascade + Tesseract OCR")
    print("   Supports ALL Indian states and Union Territories")
    if not TESSERACT_OK:
        print("   ⚠️  pytesseract not installed - run: pip install pytesseract")
    PORT = int(os.environ.get("PORT", 5000))
    print(f"   Open: http://127.0.0.1:{PORT}\n")
    app.run(port=PORT, host="127.0.0.1", debug=False)