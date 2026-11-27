import hmac
import json
import os
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

import fitz
from fastapi import FastAPI, HTTPException, Request

from mecseater_pdf import parse_pdf

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
MAX_PDF_BYTES = 20 * 1024 * 1024
GEMINI_MODEL = "gemini-2.5-flash"


def get_ai_diagnostic(pdf_path):
    """Return a short, non-authoritative explanation when deterministic parsing fails."""
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        with fitz.open(pdf_path) as document:
            extracted_text = "\n".join(page.get_text("text") for page in document)
        if not extracted_text.strip():
            return "The PDF contains no extractable text. It may be scanned or image-based."

        # Bound payload size and ask Gemini not to reproduce personal student data.
        extracted_text = extracted_text[:100_000]
        prompt = (
            "You are diagnosing why an examination seating PDF could not be parsed by a "
            "deterministic parser. Inspect the extracted PDF text and explain the likely "
            "layout or formatting issue in at most 3 short sentences. Do not extract, list, "
            "quote, or repeat any student names, roll numbers, or other personal data. "
            "Do not invent missing values. This is diagnostic advice only, not a source of "
            "seating records.\n\nPDF TEXT:\n" + extracted_text
        )
        request_body = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 180},
        }).encode("utf-8")
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{GEMINI_MODEL}:generateContent?key={api_key}"
        )
        req = urllib.request.Request(
            url,
            data=request_body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=12) as response:
            result = json.loads(response.read().decode("utf-8"))
        diagnostic = result["candidates"][0]["content"]["parts"][0]["text"].strip()
        return diagnostic[:700] if diagnostic else None
    except (OSError, ValueError, KeyError, IndexError, TypeError, urllib.error.URLError):
        # AI assistance must never prevent the normal parser error response.
        return None


@app.post("/parse")
async def parse(request: Request):
    expected_secret = os.environ.get("PDF_PARSER_SECRET", "")
    if not expected_secret:
        raise HTTPException(status_code=503, detail="Parser service is not configured.")

    authorization = request.headers.get("authorization", "")
    supplied_secret = authorization.removeprefix("Bearer ").strip()
    if not authorization.startswith("Bearer ") or not hmac.compare_digest(supplied_secret, expected_secret):
        raise HTTPException(status_code=401, detail="Unauthorized.")

    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/pdf":
        raise HTTPException(status_code=415, detail="A PDF document is required.")

    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_PDF_BYTES:
                raise HTTPException(status_code=413, detail="PDF exceeds the size limit.")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid content length.") from exc

    pdf_bytes = bytearray()
    async for chunk in request.stream():
        pdf_bytes.extend(chunk)
        if len(pdf_bytes) > MAX_PDF_BYTES:
            raise HTTPException(status_code=413, detail="PDF exceeds the size limit.")

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "upload.pdf"
            pdf_path.write_bytes(pdf_bytes)
            try:
                return parse_pdf(pdf_path)
            except ValueError as exc:
                diagnostic = get_ai_diagnostic(pdf_path)
                if diagnostic:
                    raise HTTPException(
                        status_code=422,
                        detail={"detail": "PDF could not be parsed.", "aiDiagnostic": diagnostic},
                    ) from exc
                raise HTTPException(status_code=422, detail="PDF could not be parsed.") from exc
    except fitz.FileDataError as exc:
        raise HTTPException(status_code=422, detail="PDF could not be parsed.") from exc
