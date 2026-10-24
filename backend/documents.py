from __future__ import annotations

import subprocess
import tempfile
from io import BytesIO
from pathlib import Path
import re

from PIL import Image
import fitz
from docx import Document
from pptx import Presentation
import pytesseract


SUPPORTED_SUFFIXES = {".pdf", ".doc", ".docx", ".txt", ".md", ".ppt", ".pptx", ".py"}
MAX_EXTRACTED_CHARS = 250_000


def _pdf_text(path: Path) -> str:
    sections: list[str] = []
    with fitz.open(path) as pdf:
        for page_number, page in enumerate(pdf):
            text = page.get_text("text").strip()
            if len(text) < 40:
                try:
                    pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                    image = Image.open(BytesIO(pixmap.tobytes("png")))
                    text = pytesseract.image_to_string(image, lang="eng+deu").strip()
                except pytesseract.TesseractNotFoundError as error:
                    raise ValueError(
                        "Für gescannte PDFs wird Tesseract OCR benötigt. Installiere Tesseract mit den Sprachdaten für Deutsch und Englisch und starte das Backend neu."
                    ) from error
                except pytesseract.TesseractError as error:
                    raise ValueError(
                        "Die OCR konnte dieses gescannte PDF nicht lesen. Prüfe, ob die Sprachdaten für Deutsch und Englisch in Tesseract installiert sind."
                    ) from error
            if text:
                sections.append(f"[Page {page_number + 1}]\n{text}")
            if sum(map(len, sections)) >= MAX_EXTRACTED_CHARS:
                break
    return "\n\n".join(sections)[:MAX_EXTRACTED_CHARS]


def _legacy_office_to_pdf(path: Path) -> str:
    with tempfile.TemporaryDirectory(prefix="learn45-convert-") as temporary:
        try:
            subprocess.run(
                ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", temporary, str(path)],
                check=True,
                capture_output=True,
                text=True,
                timeout=90,
            )
        except FileNotFoundError as error:
            raise ValueError("Ältere .doc- und .ppt-Dateien benötigen LibreOffice. Installiere LibreOffice oder speichere die Datei als .docx/.pptx.") from error
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
            raise ValueError("Diese ältere Office-Datei konnte nicht konvertiert werden. Speichere sie als .docx oder .pptx.") from error
        converted = Path(temporary) / f"{path.stem}.pdf"
        if not converted.exists():
            raise ValueError("Diese ältere Office-Datei konnte nicht konvertiert werden. Speichere sie als .docx oder .pptx.")
        return _pdf_text(converted)


def extract_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        raise ValueError("Unterstützte Dateiformate: PDF, DOC/DOCX, TXT, MD und PPT/PPTX.")
    if suffix == ".pdf":
        text = _pdf_text(path)
    elif suffix in {".doc", ".ppt"}:
        text = _legacy_office_to_pdf(path)
    elif suffix == ".docx":
        document = Document(path)
        text = "\n".join(paragraph.text for paragraph in document.paragraphs)
        for table in document.tables:
            text += "\n" + "\n".join(" | ".join(cell.text for cell in row.cells) for row in table.rows)
    elif suffix == ".pptx":
        presentation = Presentation(path)
        text = "\n".join(
            shape.text
            for slide in presentation.slides
            for shape in slide.shapes
            if getattr(shape, "has_text_frame", False) and shape.text.strip()
        )
    else:
        text = path.read_text(encoding="utf-8-sig", errors="replace")
    cleaned = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    if not cleaned:
        raise ValueError("In dieser Datei wurde kein lesbarer Text gefunden.")
    return cleaned[:MAX_EXTRACTED_CHARS]


def relevant_excerpt(text: str, query: str, *, max_chars: int = 12_000) -> str:
    chunks = [chunk.strip() for chunk in re.split(r"\n\s*\n|(?=\[Page \d+\])", text) if chunk.strip()]
    if not chunks:
        return text[:max_chars]
    stop_words = {"the", "and", "that", "with", "from", "what", "when", "this", "which", "der", "die", "das", "und", "mit", "von", "was", "wie", "ist", "für", "ein", "eine"}
    terms = {term.lower() for term in re.findall(r"[a-zA-ZäöüÄÖÜß]{3,}", query) if term.lower() not in stop_words}
    if not terms:
        return "\n\n".join(chunks[:4])[:max_chars]
    scored = []
    for index, chunk in enumerate(chunks):
        words = {term.lower() for term in re.findall(r"[a-zA-ZäöüÄÖÜß]{3,}", chunk)}
        scored.append((len(terms & words), index, chunk))
    selected = sorted(sorted(scored, key=lambda item: (-item[0], item[1]))[:6], key=lambda item: item[1])
    return "\n\n".join(item[2] for item in selected if item[0] > 0)[:max_chars] or "\n\n".join(chunks[:4])[:max_chars]
