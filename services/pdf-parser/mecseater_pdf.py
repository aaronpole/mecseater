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


def extract_room_header(lines, index):
    """Handle ROOM 107, ROOM NO. 107, and ROOM followed by 107."""
    line = lines[index].strip()
    match = re.fullmatch(
        r"ROOM(?:\s+(?:NO\.?|NUMBER))?\.?\s*[:#-]?\s*(.*)",
        line,
        re.IGNORECASE,
    )
    if not match:
        return None, index

    room = match.group(1).strip()
    if room:
        return room, index + 1

    next_index = index + 1
    if next_index < len(lines):
        candidate = lines[next_index].strip()
        if candidate and not re.match(
            r"^(?:SL\b|SEAT\b|KTU\b|NAME\b|COURSE\b)",
            candidate,
            re.IGNORECASE,
        ):
            return candidate, next_index + 1

    return None, index + 1


def parse_inline_student_row(line):
    """Parse a full student row when PDF extraction keeps columns on one line."""
    match = re.fullmatch(
        r"(?:(\d+)\s+)?([A-Z]\d{2,3})\s+([A-Z0-9]+)\s+(.+?)\s+([A-Z]{2,6}\d{3,4})",
        line.strip(),
        re.IGNORECASE,
    )
    if not match:
        return None

    seat, roll, name, course = match.group(2), match.group(3), match.group(4), match.group(5)
    if not is_seat_number(seat) or not is_roll_number(roll) or not is_course_code(course):
        return None
    return {"name": normalize_name([name]), "rollNo": roll.upper(), "seatNo": seat.upper()}


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

            # KTU room headers vary across generated seating PDFs.
            room, next_index = extract_room_header(lines, index)
            if room is not None:
                current_room = room
                index = next_index
                continue

            # Some extractors preserve all table columns on one text line.
            inline_record = parse_inline_student_row(line)
            if inline_record and current_room:
                record = {**inline_record, "roomNo": current_room}
                if record["rollNo"] in seen_rolls:
                    raise ValueError(f"Duplicate roll number found: {record['rollNo']}")
                if record["roomNo"] in seen_seats and record["seatNo"] in seen_seats[record["roomNo"]]:
                    raise ValueError(f"Conflicting seat assignment found for room {record['roomNo']} seat {record['seatNo']}")
                seen_rolls[record["rollNo"]] = True
                seen_seats.setdefault(record["roomNo"], set()).add(record["seatNo"])
                records.append(record)
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
