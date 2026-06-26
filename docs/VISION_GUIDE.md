# CrediSafe Vision Guide

## What the service verifies

### Vehicle identity

The service searches for registration plates in the full frame and inside detected vehicle regions. OCR results are validated against Indian registration formats and compared with the selected CrediSafe vehicle.

### Road observations

The included generic YOLO model can detect common scene objects such as vehicles, people, traffic lights and cell phones. A phone close to a detected person is marked for review, not treated as a confirmed violation.

### Helmet support

Helmet detection is intentionally model-driven. Add a validated Ultralytics-compatible helmet model and set:

```env
VISION_HELMET_MODEL_PATH=C:\path\to\helmet-model.pt
```

Without that model, the interface clearly displays `Not analysed`.

## Result states

- `Matched`: selected vehicle plate confirmed
- `Mismatch`: readable plate differs from selected vehicle
- `Plate detected`: readable plate found without an expected vehicle
- `Low confidence`: OCR result needs review
- `Unreadable`: plate candidate found but OCR failed
- `No plate`: no suitable plate region found

## Best recording conditions

- 720p or 1080p
- daylight or strong lighting
- stable camera
- one close vehicle
- plate visible for several frames
- minimal motion blur
- short clip under the configured upload limit
