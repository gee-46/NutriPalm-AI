"""
Fixture helpers for OCR tests ONLY.

Generates real PDF/image bytes on the fly (a text-layer PDF via reportlab,
and a rasterized "scan" via PIL + img2pdf) so the OCR test suite exercises
the actual pdfplumber / pdf2image / Tesseract code paths rather than only
testing extractor.py against hand-written strings.

Nothing in app/ imports from this module.
"""
from __future__ import annotations

import io

SAMPLE_LINES = [
    "SAMRUDDHI AGRI LABS - SOIL HEALTH REPORT",
    "Sample ID: 9981",
    "Farmer: Test Farmer   Plot: East-3A",
    "",
    "Available Nitrogen (N)      245 kg/ha",
    "Available Phosphorus (P)    18 kg/ha",
    "Available Potassium (K)     142 kg/ha",
    "Soil pH                     6.8",
    "Electrical Conductivity (EC) 0.42 dS/m",
    "Organic Carbon (OC)         0.62 %",
]

SAMPLE_VALUES = {
    "nitrogen": 245.0,
    "phosphorus": 18.0,
    "potassium": 142.0,
    "ph": 6.8,
    "electrical_conductivity": 0.42,
    "organic_carbon": 0.62,
}


def text_layer_pdf_bytes(lines: list[str] = SAMPLE_LINES) -> bytes:
    """A real text-layer PDF (pdfplumber will find the embedded text)."""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    y = 800
    for line in lines:
        c.drawString(50, y, line)
        y -= 20
    c.showPage()
    c.save()
    return buf.getvalue()


def scanned_page_image(lines: list[str] = SAMPLE_LINES, size: tuple[int, int] = (1700, 1300)):
    """A PIL Image that looks like a scanned printed report (no text layer
    when embedded in a PDF -- must go through real Tesseract OCR)."""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", size, "white")
    draw = ImageDraw.Draw(img)
    font = None
    for font_path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\calibri.ttf",
        "arial.ttf",
    ]:
        try:
            font = ImageFont.truetype(font_path, 32)
            break
        except Exception:
            continue
    if font is None:
        font = ImageFont.load_default()

    y = 30
    for line in lines:
        draw.text((40, y), line, fill="black", font=font)
        y += 62
    return img


def scanned_pdf_bytes(lines: list[str] = SAMPLE_LINES) -> bytes:
    """A PDF whose page is purely an embedded image (no text layer) --
    forces the pipeline's OCR route."""
    import img2pdf

    img = scanned_page_image(lines)
    png_buf = io.BytesIO()
    img.save(png_buf, format="PNG")
    return img2pdf.convert(png_buf.getvalue())


def scanned_png_bytes(lines: list[str] = SAMPLE_LINES) -> bytes:
    img = scanned_page_image(lines)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


MICRONUTRIENT_LINES = [
    "HASSAN AGRI TESTING LABORATORY",
    "SOIL HEALTH CARD - DETAILED ANALYSIS REPORT",
    "Sample ID: 77452     Farmer: Ramesh K.     Plot: North-Field",
    "",
    "MACRONUTRIENTS",
    "Available Nitrogen (N)         168 kg/ha",
    "Available Phosphorus (P)      21 kg/ha",
    "Available Potassium (K)       210 kg/ha",
    "Soil pH                       6.55",
    "Electrical Conductivity (EC)  0.38 dS/m",
    "Organic Carbon (OC)           0.71 %",
    "",
    "MICRONUTRIENTS (DTPA Extractable)",
    "Available Zinc (Zn)           0.62 ppm",
    "Available Iron (Fe)           12.4 ppm",
    "Available Manganese (Mn)      8.1 ppm",
    "Available Copper (Cu)         1.05 ppm",
    "Available Boron (B)           0.42 ppm",
    "Available Sulphur (S)         14.6 ppm",
]

MICRONUTRIENT_MACRO_VALUES = {
    "nitrogen": 168.0,
    "phosphorus": 21.0,
    "potassium": 210.0,
    "ph": 6.55,
    "electrical_conductivity": 0.38,
    "organic_carbon": 0.71,
}

MICRONUTRIENT_VALUES = {
    "zinc": 0.62,
    "iron": 12.4,
    "manganese": 8.1,
    "copper": 1.05,
    "boron": 0.42,
    "sulfur": 14.6,
}


def micronutrient_report_pdf_bytes() -> bytes:
    """A real scanned-style PDF (no text layer -- forces actual Tesseract
    OCR) of a realistic Indian soil-health-card layout that includes a
    micronutrients section."""
    import img2pdf

    img = scanned_page_image(MICRONUTRIENT_LINES, size=(1900, 1500))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return img2pdf.convert(buf.getvalue())


def report_without_micronutrients_pdf_bytes() -> bytes:
    """A real text-layer PDF with only macronutrients -- no micronutrient
    section at all -- to confirm those fields come back null, not guessed."""
    return text_layer_pdf_bytes(
        lines=[
            "Available Nitrogen (N)      168 kg/ha",
            "Available Phosphorus (P)    21 kg/ha",
            "Available Potassium (K)     210 kg/ha",
            "Soil pH                     6.55",
            "Organic Carbon (OC)         0.71 %",
        ]
    )
    """
    A 2-page PDF: page 1 is a real text layer, page 2 is a scanned image
    with no text layer, so the pipeline must route each page independently
    and still return combined, correct results.
    """
    import img2pdf
    from pypdf import PdfWriter, PdfReader
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    # Page 1: text-layer cover page.
    text_buf = io.BytesIO()
    c = canvas.Canvas(text_buf, pagesize=A4)
def multi_page_pdf_bytes() -> bytes:
    """
    A 2-page PDF: page 1 is a real text layer, page 2 is a scanned image
    with no text layer, so the pipeline must route each page independently
    and still return combined, correct results.
    """
    import img2pdf
    from pypdf import PdfWriter, PdfReader
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    # Page 1: text-layer cover page.
    text_buf = io.BytesIO()
    c = canvas.Canvas(text_buf, pagesize=A4)
    c.drawString(50, 800, "SAMRUDDHI AGRI LABS - SOIL HEALTH REPORT")
    c.drawString(50, 780, "Sample ID: 9981")
    c.drawString(50, 760, "Farmer: Test Farmer   Plot: East-3A")
    c.showPage()
    c.save()

    # Page 2: scanned parameter table (image only).
    img = scanned_page_image(
        [
            "Available Nitrogen (N)      245 kg/ha",
            "Available Phosphorus (P)    18 kg/ha",
            "Available Potassium (K)     142 kg/ha",
            "Soil pH                     6.8",
            "Electrical Conductivity (EC) 0.42 dS/m",
            "Organic Carbon (OC)         0.62 %",
        ]
    )
    png_buf = io.BytesIO()
    img.save(png_buf, format="PNG")
    scan_pdf_bytes = img2pdf.convert(png_buf.getvalue())

    writer = PdfWriter()
    for page in PdfReader(io.BytesIO(text_buf.getvalue())).pages:
        writer.add_page(page)
    for page in PdfReader(io.BytesIO(scan_pdf_bytes)).pages:
        writer.add_page(page)

    out_buf = io.BytesIO()
    writer.write(out_buf)
    return out_buf.getvalue()
