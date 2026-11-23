import re
from datetime import datetime
from pathlib import Path

import fitz


def normalize_name(parts):
    text = " ".join(str(part).strip() for part in parts if str(part).strip())
    return re.sub(r"\s+", " ", text).strip()


def is_course_code(value):
    return bool(re.fullmatch(r"[A-Z]{2,6}\d{3,4}", value.upper()))


def is_roll_number(value):
    normalized = value.strip().upper()
    # Legacy IDs (for example, 24ME001) and KTU IDs with institute,
    # year, programme, and optional work-programme components.
    return bool(
        re.fullmatch(r"(?:\d{2}[A-Z]{2,3}\d{3}|[A-Z]{2,4}\d{2}[A-Z]{2,5}\d{3})", normalized)
    )


def is_seat_number(value):
    return bool(re.fullmatch(r"[A-Z]\d{2,3}", value.upper()))


def find_exam_date(text):
    match = re.search(r"\b(\d{2}[/-]\d{2}[/-]\d{4})\b", text)
    if not match:
        raise ValueError("Exam date is missing or invalid in the PDF.")
    value = match.group(1)
    date_format = "%d/%m/%Y" if "/" in value else "%d-%m-%Y"
    try:
        parsed_date = datetime.strptime(value, date_format)
    except ValueError as exc:
        raise ValueError("Exam date is missing or invalid in the PDF.") from exc
    return parsed_date.strftime("%d/%m/%Y")


def find_slot(text, exam_date):
    match = re.search(r"(Slot\s+[^\n]*?)\s+" + re.escape(exam_date) + r"\b", text, re.IGNORECASE)
    if match:
        return match.group(1).strip()

    # KTU headings name the session after the date: "23-11-2026 Monday AN".
    session = re.search(
        r"\b\d{2}[/-]\d{2}[/-]\d{4}\s+(?:[A-Za-z]+day\s+)?(FN|AN)\b", text, re.IGNORECASE
    )
    if session:
        return session.group(1).upper()
    return None


def split_trailing_course_code(token):
    """Split "LONG NAME PCCST501" into ("LONG NAME", "PCCST501").

    PyMuPDF puts a long name and its course code on one text line. Returns
    (token, None) when the token does not end with a course code.
    """
    parts = token.rsplit(None, 1)
    if len(parts) == 2 and is_course_code(parts[1]):
        return parts[0], parts[1]
    return token, None


def read_name_and_course_code(lines, start):
    """Collect name lines from `start` until the course code.

    Returns (name_parts, course_code, index_of_course_code_line).
    """
    name_parts = []
    j = start
    while j < len(lines):
        token = lines[j]
        if is_course_code(token):
            return name_parts, token, j
        name_part, course_code = split_trailing_course_code(token)
        if course_code:
            name_parts.append(name_part)
            return name_parts, course_code, j
        name_parts.append(token)
        j += 1
    return name_parts, None, j


def parse_pdf(pdf_path):
    pdf_path = Path(pdf_path).resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc = fitz.open(str(pdf_path))
    pages = [page.get_text("text") for page in doc]
    combined = "\n".join(pages)
    exam_date = find_exam_date(combined)
    slot = find_slot(combined, exam_date)

    current_room = None
    records = []
    seen_rolls = {}
    seen_seats = {}

    for page_text in pages:
        lines = [line.strip() for line in page_text.replace("\r", "").split("\n") if line.strip()]
        index = 0

        while index < len(lines):
            line = lines[index]

            # KTU seating PDFs commonly put the room number on the same
            # line ("ROOM 107"); older layouts put it on the next line.
            room_match = re.fullmatch(r"ROOM\s+(.+)", line, re.IGNORECASE)
            if room_match:
                current_room = room_match.group(1).strip()
                index += 1
                continue

            if line.lower() == "room":
                if index + 1 < len(lines):
                    candidate = lines[index + 1].strip()
                    if candidate and not candidate.lower().startswith("sl"):
                        current_room = candidate
                index += 1
                continue

            if line.lower() in {"sl no", "seat", "roll no", "name", "course code", "signature", "room"}:
                index += 1
                continue

            if "b.tech" in line.lower() or line.lower().startswith("slot") or any(day in line.lower() for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]):
                index += 1
                continue

            if re.fullmatch(r"\d+", line):
                if index + 2 < len(lines):
                    seat = lines[index + 1]
                    roll = lines[index + 2]
                    if current_room and is_seat_number(seat) and is_roll_number(roll):
                        name_parts, course_code, j = read_name_and_course_code(lines, index + 3)

                        if course_code and name_parts:
                            name = normalize_name(name_parts)
                            record = {"name": name, "rollNo": roll.upper(), "roomNo": current_room, "seatNo": seat.upper()}
                            if record["rollNo"] in seen_rolls:
                                raise ValueError(f"Duplicate roll number found: {record['rollNo']}")
                            if record["roomNo"] in seen_seats and record["seatNo"] in seen_seats[record["roomNo"]]:
                                raise ValueError(f"Conflicting seat assignment found for room {record['roomNo']} seat {record['seatNo']}")
                            seen_rolls[record["rollNo"]] = True
                            seen_seats.setdefault(record["roomNo"], set()).add(record["seatNo"])
                            records.append(record)
                            index = j + 1
                            continue
            elif is_seat_number(line) and current_room and index + 1 < len(lines):
                seat = line
                roll = lines[index + 1]
                if is_roll_number(roll):
                    name_parts, course_code, j = read_name_and_course_code(lines, index + 2)

                    if course_code and name_parts:
                        name = normalize_name(name_parts)
                        record = {"name": name, "rollNo": roll.upper(), "roomNo": current_room, "seatNo": seat.upper()}
                        if record["rollNo"] in seen_rolls:
                            raise ValueError(f"Duplicate roll number found: {record['rollNo']}")
                        if record["roomNo"] in seen_seats and record["seatNo"] in seen_seats[record["roomNo"]]:
                            raise ValueError(f"Conflicting seat assignment found for room {record['roomNo']} seat {record['seatNo']}")
                        seen_rolls[record["rollNo"]] = True
                        seen_seats.setdefault(record["roomNo"], set()).add(record["seatNo"])
                        records.append(record)
                        index = j + 1
                        continue

            index += 1

    if not records:
        raise ValueError("No valid student records were extracted from the PDF.")

    return {
        "examDate": exam_date,
        "slot": slot,
        "records": records,
    }
