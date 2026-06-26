from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from vision_service.app import main


class VisionServiceSecurityTests(unittest.TestCase):
    def test_api_key_is_required_when_enabled(self) -> None:
        with patch.object(main, "REQUIRE_API_KEY", True), patch.dict(os.environ, {}, clear=False):
            os.environ.pop("VISION_API_KEY", None)
            with self.assertRaises(HTTPException) as context:
                main.require_api_key(None)
            self.assertEqual(context.exception.status_code, 503)

    def test_api_key_comparison_rejects_wrong_value(self) -> None:
        with patch.object(main, "REQUIRE_API_KEY", True), patch.dict(os.environ, {"VISION_API_KEY": "correct-secret"}):
            with self.assertRaises(HTTPException) as context:
                main.require_api_key("wrong-secret")
            self.assertEqual(context.exception.status_code, 401)

    def test_api_key_comparison_accepts_correct_value(self) -> None:
        with patch.object(main, "REQUIRE_API_KEY", True), patch.dict(os.environ, {"VISION_API_KEY": "correct-secret"}):
            main.require_api_key("correct-secret")


if __name__ == "__main__":
    unittest.main()
