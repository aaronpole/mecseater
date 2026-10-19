import hmac
import os
import tempfile
from pathlib import Path

import fitz
from fastapi import FastAPI, HTTPException, Request

from mecseater_pdf import parse_pdf

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
MAX_PDF_BYTES = 20 * 1024 * 1024


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
            return parse_pdf(pdf_path)
    except (fitz.FileDataError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="PDF could not be parsed.") from exc
