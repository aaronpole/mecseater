import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "pdf-parser"))
from mecseater_pdf import find_exam_date, find_slot, is_course_code, is_roll_number, is_seat_number, normalize_name, parse_pdf


if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            raise ValueError("A PDF file path is required.")
        result = parse_pdf(sys.argv[1])
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:  # pragma: no cover
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
