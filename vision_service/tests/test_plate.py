from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from vision_service.app.plate import analyze_video, fix_plate_text, normalize_plate


class PlatePipelineTests(unittest.TestCase):
    def test_normalize_and_fix(self) -> None:
        self.assertEqual(normalize_plate("gj 06 cs-2026"), "GJ06CS2026")
        self.assertEqual(fix_plate_text("GJ06CS2O26"), "GJ06CS2026")

    def test_clear_synthetic_plate_matches_expected_vehicle(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "plate.mp4"
            writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 5, (960, 540))
            for frame_index in range(10):
                frame = np.full((540, 960, 3), 215, dtype=np.uint8)
                x = 120 + frame_index * 4
                cv2.rectangle(frame, (x, 175), (x + 650, 420), (30, 60, 90), -1)
                px, py = x + 205, 320
                cv2.rectangle(frame, (px, py), (px + 260, py + 72), (250, 250, 250), -1)
                cv2.rectangle(frame, (px, py), (px + 260, py + 72), (0, 0, 0), 3)
                cv2.putText(frame, "GJ06CS2026", (px + 10, py + 49), cv2.FONT_HERSHEY_SIMPLEX, 1.25, (0, 0, 0), 3, cv2.LINE_AA)
                writer.write(frame)
            writer.release()

            result = analyze_video(path, expected_plate="GJ06CS2026", sample_interval_seconds=0.5, max_sampled_frames=5)
            self.assertTrue(result["matched_registered_plate"])
            self.assertEqual(result["matched_plate"], "GJ06CS2026")
            self.assertGreaterEqual(result["detections"][0]["read_count"], 2)


if __name__ == "__main__":
    unittest.main()
