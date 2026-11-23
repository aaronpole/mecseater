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
        self.assertEqual(result["slot"], "FN")
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

    def test_reads_forenoon_and_afternoon_slot_after_the_date(self):
        for heading, expected in (("23-11-2026 Monday AN", "AN"), ("24/11/2026 Tuesday FN", "FN")):
            with self.subTest(heading=heading):
                write_pdf(
                    self.pdf_path,
                    [heading, "ROOM 107", "1", "A01", "MDL24EBE049", "SYNTHETIC STUDENT ONE", "PCEBT501"],
                )
                self.assertEqual(parse_pdf(self.pdf_path)["slot"], expected)

    def test_splits_course_code_off_a_long_name_on_the_same_line(self):
        # PyMuPDF joins a long name and its course code into one text line.
        # The next student's row must not be swallowed into that name.
        write_pdf(
            self.pdf_path,
            [
                "B.Tech S5 (R) Exam Nov 2026 (2024 Scheme)",
                "23-11-2026 Monday AN",
                "ROOM 315",
                "11",
                "A11",
                "MDL24CS132",
                "SYNTHETIC STUDENT ELEVEN",
                "PCCST501",
                "12",
                "A12",
                "MDL24CS133",
                "SYNTHETIC STUDENT WITH LONGNAME PCCST501",
                "13",
                "A13",
                "MDL24CS134",
                "SYNTHETIC STUDENT THIRTEEN",
                "PCCST501",
            ],
        )

        result = parse_pdf(self.pdf_path)

        self.assertEqual(
            [(row["rollNo"], row["seatNo"], row["name"]) for row in result["records"]],
            [
                ("MDL24CS132", "A11", "SYNTHETIC STUDENT ELEVEN"),
                ("MDL24CS133", "A12", "SYNTHETIC STUDENT WITH LONGNAME"),
                ("MDL24CS134", "A13", "SYNTHETIC STUDENT THIRTEEN"),
            ],
        )



    def test_supports_common_room_header_variations(self):
        for header_lines, expected_room in (
            (["ROOM 107"], "107"),
            (["ROOM NO. 107"], "107"),
            (["ROOM NUMBER: 107"], "107"),
            (["ROOM", "107"], "107"),
            (["ROOM NO.", "107"], "107"),
        ):
            with self.subTest(header=header_lines):
                write_pdf(
                    self.pdf_path,
                    [
                        "B.Tech S5 Exam Nov 2026",
                        "23-11-2026 Monday AN",
                        *header_lines,
                        "1",
                        "A01",
                        "MDL24EBE049",
                        "SYNTHETIC STUDENT",
                        "PCEBT501",
                    ],
                )
                result = parse_pdf(self.pdf_path)
                self.assertEqual(result["records"][0]["roomNo"], expected_room)

    def test_parses_student_row_when_columns_are_extracted_on_one_line(self):
        write_pdf(
            self.pdf_path,
            [
                "B.Tech S5 Exam Nov 2026",
                "23-11-2026 Monday AN",
                "ROOM NO. 201",
                "1 A01 MDL24EBE049 SYNTHETIC STUDENT PCEBT501",
                "2 A02 LMDL24CSBS067 ANOTHER SYNTHETIC STUDENT PCCST501",
            ],
        )

        result = parse_pdf(self.pdf_path)

        self.assertEqual(
            [(row["rollNo"], row["seatNo"], row["roomNo"]) for row in result["records"]],
            [
                ("MDL24EBE049", "A01", "201"),
                ("LMDL24CSBS067", "A02", "201"),
            ],
        )

if __name__ == "__main__":
    unittest.main()
