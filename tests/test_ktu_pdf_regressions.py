import sys
import tempfile
import unittest
from pathlib import Path

import fitz

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "pdf-parser"))

from mecseater_pdf import find_exam_date, is_roll_number, parse_pdf


def write_pdf(path, lines):
    document = fitz.open()
    page = document.new_page()
    for line_number, line in enumerate(lines):
        page.insert_text((72, 72 + line_number * 16), line)
    document.save(path)
    document.close()


class KtuPdfRegressionTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.pdf_path = Path(self.temp_dir.name) / "ktu-seating.pdf"

    def test_accepts_slash_and_hyphen_dates_and_normalizes_them(self):
        self.assertEqual(find_exam_date("Exam 18/10/2026 Sunday"), "18/10/2026")
        self.assertEqual(find_exam_date("23-11-2026 Monday FN"), "23/11/2026")

    def test_rejects_impossible_dates_with_either_separator(self):
        for value in ("31/02/2026", "31-02-2026"):
            with self.subTest(value=value):
                with self.assertRaisesRegex(ValueError, "Exam date is missing or invalid"):
                    find_exam_date(value)

    def test_accepts_ktu_roll_number_formats_and_legacy_ids(self):
        valid_ids = (
            "MDL23EBE050",
            "CEC23EC012",
            "LMDL23CS198",
            "MDL23CSBS067",
            "MDL22ECWP001",
            "LMDL23EVLSI064",
            "24ME001",
        )
        for value in valid_ids:
            with self.subTest(value=value):
                self.assertTrue(is_roll_number(value))

    def test_rejects_unstructured_roll_number_values(self):
        for value in ("STUDENT123", "MDL23", "MDL23EBE05X", "23-11-2026"):
            with self.subTest(value=value):
                self.assertFalse(is_roll_number(value))

    def test_parses_synthetic_ktu_layout_with_hyphen_date_and_long_ids(self):
        write_pdf(
            self.pdf_path,
            [
                "B.Tech S7 (R,S) Exam Nov 2026 (2019 Scheme)",
                "23-11-2026 Monday FN",
                "Room",
                "107",
                "SL NO",
                "SEAT",
                "KTU ID",
                "NAME",
                "COURSE CODE",
                "1",
                "A01",
                "MDL23EBE050",
                "RIFA NOWRIN K V",
                "EBT401",
                "2",
                "A02",
                "CEC23EC012",
                "AUSTIN ANTONY",
                "ECT401",
                "3",
                "A03",
                "MDL23CSBS067",
                "AFSAL P P",
                "CST401",
                "4",
                "A04",
                "MDL22ECWP001",
                "PAULSON T VARGHESE",
                "EET401",
                "5",
                "A05",
                "LMDL23EVLSI064",
                "SYNTHETIC VLSI STUDENT",
                "EVT401",
            ],
        )

        result = parse_pdf(self.pdf_path)

        self.assertEqual(result["examDate"], "23/11/2026")
        self.assertIsNone(result["slot"])
        self.assertEqual(
            [(row["rollNo"], row["seatNo"], row["roomNo"]) for row in result["records"]],
            [
                ("MDL23EBE050", "A01", "107"),
                ("CEC23EC012", "A02", "107"),
                ("MDL23CSBS067", "A03", "107"),
                ("MDL22ECWP001", "A04", "107"),
                ("LMDL23EVLSI064", "A05", "107"),
            ],
        )


    def test_parses_ktu_layout_with_room_number_on_same_header_line(self):
        write_pdf(
            self.pdf_path,
            [
                "B.Tech S5 (R) Exam Nov 2026 (2024 Scheme)",
                "23-11-2026 Monday AN",
                "ROOM 107",
                "SL",
                "NO",
                "SEAT KTU ID",
                "NAME",
                "COURSE CODE",
                "1",
                "A01",
                "MDL24EBE049",
                "SYNTHETIC STUDENT ONE",
                "PCEBT501",
                "2",
                "A02",
                "LMDL24CSBS067",
                "SYNTHETIC STUDENT TWO",
                "PCCST501",
            ],
        )

        result = parse_pdf(self.pdf_path)

        self.assertEqual(result["examDate"], "23/11/2026")
        self.assertEqual(
            [(row["rollNo"], row["seatNo"], row["roomNo"]) for row in result["records"]],
            [
                ("MDL24EBE049", "A01", "107"),
                ("LMDL24CSBS067", "A02", "107"),
            ],
        )


if __name__ == "__main__":
    unittest.main()
