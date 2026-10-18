import json
import re
import sys
from pathlib import Path

import fitz


def normalize_name(parts):
    text = " ".join(str(part).strip() for part in parts if str(part).strip())
    return re.sub(r"\s+", " ", text).strip()


def is_course_code(value):
    return bool(re.fullmatch(r"[A-Z]{2,6}\d{3,4}", value.upper()))


def is_roll_number(value):
    return bool(re.fullmatch(r"\d{2}[A-Z]{2,3}\d{2,3}", value.upper()))


def is_seat_number(value):
    return bool(re.fullmatch(r"[A-Z]\d{2,3}", value.upper()))


def find_exam_date(text):
    match = re.search(r"\b(\d{2}/\d{2}/\d{4})\b", text)
    if not match:
        raise ValueError("Exam date is missing or invalid in the PDF.")
    return match.group(1)


def find_slot(text, exam_date):
    match = re.search(r"(Slot\s+[^\n]*?)\s+" + re.escape(exam_date) + r"\b", text, re.IGNORECASE)
    if not match:
        return None
    return match.group(1).strip()


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
                        name_parts = []
                        j = index + 3
                        course_code = None
                        while j < len(lines):
                            token = lines[j]
                            if is_course_code(token):
                                course_code = token
                                break
                            name_parts.append(token)
                            j += 1

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
                    name_parts = []
                    j = index + 2
                    course_code = None
                    while j < len(lines):
                        token = lines[j]
                        if is_course_code(token):
                            course_code = token
                            break
                        name_parts.append(token)
                        j += 1

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


if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            raise ValueError("A PDF file path is required.")
        result = parse_pdf(sys.argv[1])
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:  # pragma: no cover
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
