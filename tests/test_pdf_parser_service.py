import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import fitz
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "pdf-parser"))

import main

TEST_SECRET = "test-only-parser-secret"
HEADERS = {"Authorization": f"Bearer {TEST_SECRET}", "Content-Type": "application/pdf"}


def make_pdf():
    with tempfile.TemporaryDirectory() as temp_dir:
        pdf_path = Path(temp_dir) / "synthetic.pdf"
        document = fitz.open()
        page = document.new_page()
        lines = [
            "Slot 2 18/10/2026 Sunday",
            "Room",
            "107",
            "1",
            "A01",
            "24ME001",
            "Synthetic Student",
            "MECH101",
        ]
        for line_number, line in enumerate(lines):
            page.insert_text((72, 72 + line_number * 18), line)
        document.save(pdf_path)
        document.close()
        return pdf_path.read_bytes()


class PdfParserServiceTests(unittest.TestCase):
    def setUp(self):
        self.secret_patch = patch.dict(os.environ, {"PDF_PARSER_SECRET": TEST_SECRET})
        self.secret_patch.start()
        self.addCleanup(self.secret_patch.stop)
        self.client = TestClient(main.app)

    def test_parses_pdf_bytes_and_returns_extracted_records(self):
        response = self.client.post("/parse", content=make_pdf(), headers=HEADERS)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "examDate": "18/10/2026",
                "slot": "Slot 2",
                "records": [
                    {
                        "name": "Synthetic Student",
                        "rollNo": "24ME001",
                        "roomNo": "107",
                        "seatNo": "A01",
                    }
                ],
            },
        )

    def test_rejects_invalid_pdf_bytes(self):
        response = self.client.post("/parse", content=b"not a PDF", headers=HEADERS)

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"], "PDF could not be parsed.")

    def test_rejects_missing_or_invalid_authentication(self):
        response = self.client.post(
            "/parse",
            content=make_pdf(),
            headers={"Content-Type": "application/pdf", "Authorization": "Bearer wrong-secret"},
        )

        self.assertEqual(response.status_code, 401)

    def test_reports_unconfigured_authentication_secret(self):
        with patch.dict(os.environ, {"PDF_PARSER_SECRET": ""}):
            response = self.client.post("/parse", content=make_pdf(), headers=HEADERS)

        self.assertEqual(response.status_code, 503)

    def test_returns_safe_parser_error_without_leaking_details(self):
        with patch.object(main, "parse_pdf", side_effect=ValueError("Synthetic private parser detail")):
            response = self.client.post("/parse", content=make_pdf(), headers=HEADERS)

        self.assertEqual(response.status_code, 422)
        self.assertNotIn("Synthetic private parser detail", response.text)

    def test_rejects_non_pdf_content_type(self):
        response = self.client.post(
            "/parse",
            content=b"not a PDF",
            headers={"Authorization": f"Bearer {TEST_SECRET}", "Content-Type": "text/plain"},
        )

        self.assertEqual(response.status_code, 415)


if __name__ == "__main__":
    unittest.main()
