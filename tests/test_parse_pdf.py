import sys
import tempfile
import unittest
from pathlib import Path

import fitz

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from parse_pdf import find_exam_date, parse_pdf


def write_pdf(path, pages):
    document = fitz.open()
    for lines in pages:
        page = document.new_page()
        for line_number, line in enumerate(lines):
            page.insert_text((72, 72 + line_number * 18), line)
    document.save(path)
    document.close()


def student_lines(seat, roll, name_lines, course="MECH101"):
    return [seat, roll, *name_lines, course]


class PdfParserTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.pdf_path = Path(self.temp_dir.name) / "synthetic.pdf"

    def parse_pages(self, pages):
        write_pdf(self.pdf_path, pages)
        return parse_pdf(self.pdf_path)

    def test_extracts_date_and_slot_from_heading(self):
        result = self.parse_pages(
            [
                [
                    "Slot 2 (S3 & S5) 18/10/2026 Sunday",
                    "Room",
                    "107",
                    "Sl No",
                    "Seat",
                    "Roll No",
                    "Name",
                    "Course Code",
                    "1",
                    *student_lines("A01", "24ME001", ["Alice Johnson"]),
                ]
            ]
        )

        self.assertEqual(result["examDate"], "18/10/2026")
        self.assertEqual(result["slot"], "Slot 2 (S3 & S5)")

    def test_extracts_wrapped_names_as_one_name(self):
        result = self.parse_pages(
            [
                [
                    "18/10/2026",
                    "Room",
                    "107",
                    "1",
                    *student_lines("A01", "24ME001", ["Alice", "Mary", "Johnson"]),
                ]
            ]
        )

        self.assertEqual(result["records"][0]["name"], "Alice Mary Johnson")

    def test_parses_records_across_page_boundaries(self):
        result = self.parse_pages(
            [
                [
                    "18/10/2026",
                    "Room",
                    "107",
                    "1",
                    *student_lines("A01", "24ME001", ["Alice Johnson"]),
                ],
                [
                    "Sl No",
                    "Seat",
                    "Roll No",
                    "Name",
                    "Course Code",
                    "2",
                    *student_lines("A02", "24ME002", ["Bob George"]),
                ],
            ]
        )

        self.assertEqual(
            [(record["rollNo"], record["roomNo"]) for record in result["records"]],
            [("24ME001", "107"), ("24ME002", "107")],
        )

    def test_updates_room_when_room_changes(self):
        result = self.parse_pages(
            [
                [
                    "18/10/2026",
                    "Room",
                    "107",
                    "1",
                    *student_lines("A01", "24ME001", ["Alice Johnson"]),
                    "Room",
                    "108",
                    "2",
                    *student_lines("A01", "24ME002", ["Bob George"]),
                ]
            ]
        )

        self.assertEqual(
            [(record["rollNo"], record["roomNo"]) for record in result["records"]],
            [("24ME001", "107"), ("24ME002", "108")],
        )

    def test_rejects_duplicate_roll_numbers(self):
        with self.assertRaisesRegex(ValueError, "Duplicate roll number"):
            self.parse_pages(
                [
                    [
                        "18/10/2026",
                        "Room",
                        "107",
                        "1",
                        *student_lines("A01", "24ME001", ["Alice Johnson"]),
                        "2",
                        *student_lines("A02", "24ME001", ["Alice Johnson"]),
                    ]
                ]
            )

    def test_rejects_duplicate_seats_within_a_room(self):
        with self.assertRaisesRegex(ValueError, "Conflicting seat assignment"):
            self.parse_pages(
                [
                    [
                        "18/10/2026",
                        "Room",
                        "107",
                        "1",
                        *student_lines("A01", "24ME001", ["Alice Johnson"]),
                        "2",
                        *student_lines("A01", "24ME002", ["Bob George"]),
                    ]
                ]
            )

    def test_rejects_impossible_exam_dates(self):
        with self.assertRaisesRegex(ValueError, "Exam date is missing or invalid"):
            find_exam_date("Exam date: 31/02/2026")

    def test_rejects_pdf_with_no_exam_date(self):
        with self.assertRaisesRegex(ValueError, "Exam date is missing or invalid"):
            self.parse_pages([["Room", "107"]])

    def test_rejects_malformed_pdf(self):
        self.pdf_path.write_bytes(b"not a PDF")

        with self.assertRaises(fitz.FileDataError):
            parse_pdf(self.pdf_path)

    def test_rejects_pdf_with_no_student_records(self):
        with self.assertRaisesRegex(ValueError, "No valid student records"):
            self.parse_pages([["18/10/2026", "Room", "107", "No students listed"]])


if __name__ == "__main__":
    unittest.main()
