#!/usr/bin/env python3
"""Build CAP CLAIR's SUP AIP overlay from the official French SIA listing.

Parser V3.2 is layout-aware, publication-regression-safe and reference-aware. It reads PyMuPDF text blocks,
rebuilds common multi-column SIA tables, recognises temporary LFR designators,
and keeps previously valid individual geometries if a parser upgrade loses only
part of a publication. It remains conservative: a boundary that depends on an
external coastline, frontier or another airspace is reported instead of being
silently approximated.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import re
import sys
import time
import unicodedata
from difflib import SequenceMatcher
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urljoin

import fitz  # PyMuPDF
import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

SOURCE_URL = "https://www.sia.aviation-civile.gouv.fr/documents/supaip/aip/id/6"
PARSER_VERSION = "capclair-supaip-parser-3.0.2"
USER_AGENT = "CAP-CLAIR-SUPAIP-BETA/3.0.2 (+automatic SIA public-document reader)"
ZONE_TITLE_RE = re.compile(
    r"\b(?:ZRT|ZDT|ZIT|TRA|TSA|zone(?:s)?\s+(?:r[eé]glement[eé]e|dangereuse|interdite|r[eé]serv[eé]e)(?:s)?\s+temporaire(?:s)?|CTR\s+temporaire|TMA\s+temporaire)\b",
    re.IGNORECASE,
)
ZONE_TOKEN_RE = re.compile(r"\b(ZRT|ZDT|ZIT|TRA|TSA|CTR|TMA|RMZ|TMZ|FBZ)\b", re.IGNORECASE)
TEMPORARY_LFR_CODE_RE = re.compile(r"\bLF\s*-?\s*R\s*(?P<number>\d{2,3})(?P<suffix>[A-Z0-9]{0,3})\b", re.IGNORECASE)
ZONE_START_RE = re.compile(
    r"(?<![A-Z0-9/])(?:ZRT/ZDT\b|ZRT\b|ZDT\b|ZIT\b|TRA(?=\b|\d)|TSA(?=\b|\d)|CTR(?:\s+TEMPORAIRE)?\b|TMA(?:\s+TEMPORAIRE)?\b|RMZ\b|TMZ\b|FBZ\b)",
    re.IGNORECASE,
)
VALIDITY_RE = re.compile(r"Valide\s+du\s+(\d{4}-\d{2}-\d{2})\s+au\s+(\d{4}-\d{2}-\d{2})", re.IGNORECASE)
UPDATE_DATE_RE = re.compile(r"Date\s+de\s+derni[eè]re\s+mise\s+[àa]\s+jour\s+de\s+la\s+liste\s*:\s*(\d{2}/\d{2}/\d{4})", re.IGNORECASE)
SUP_NUMBER_RE = re.compile(r"\b(\d{3})\s*/\s*(\d{2,4})\b")

DMS_RE = re.compile(
    r"(?P<latd>\d{2})\s*[°º]\s*(?P<latm>\d{1,2})\s*['’′]\s*(?P<lats>\d{1,2}(?:[.,]\d+)?)\s*(?:[\"”″]|''|’’)?\s*(?P<lath>[NS])"
    r"\s*[,;\-–— ]+\s*"
    r"(?P<lond>\d{1,3})\s*[°º]\s*(?P<lonm>\d{1,2})\s*['’′]\s*(?P<lons>\d{1,2}(?:[.,]\d+)?)\s*(?:[\"”″]|''|’’)?\s*(?P<lonh>[EW])",
    re.IGNORECASE,
)
COMPACT_DMS_RE = re.compile(
    r"(?<!\d)(?P<latd>\d{2})(?P<latm>\d{2})(?P<lats>\d{2}(?:[.,]\d+)?)(?P<lath>[NS])"
    r"\s*[,;/\- ]+\s*"
    r"(?P<lond>\d{3})(?P<lonm>\d{2})(?P<lons>\d{2}(?:[.,]\d+)?)(?P<lonh>[EW])(?!\d)",
    re.IGNORECASE,
)

LIMIT_ATOM = r"(?:SFC|GND|UNL|FL\s*\d{2,3}|\d{1,5}\s*(?:FT|M)\s*(?:AMSL|ASFC|AGL|QNH)?)"
VERTICAL_SLASH_RE = re.compile(
    rf"(?P<lower>{LIMIT_ATOM}(?:\s*-\s*{LIMIT_ATOM})?)\s*/\s*(?P<upper>{LIMIT_ATOM})",
    re.IGNORECASE,
)
VERTICAL_DASH_RE = re.compile(rf"(?P<lower>{LIMIT_ATOM})\s+-\s+(?P<upper>{LIMIT_ATOM})", re.IGNORECASE)
CIRCLE_RE = re.compile(
    r"(?:cercle|circonf[eé]rence)\s+de\s+(?P<radius>\d+(?:[.,]\d+)?)\s*(?P<unit>NM|N\s*M|KM|M)"
    r"(?:\s*\([^)]*\))?\s+de\s+rayon",
    re.IGNORECASE,
)
ARC_RE = re.compile(
    r"arc\s+(?P<direction>anti\s*-?\s*horaire|horaire)\s+de\s+(?P<radius>\d+(?:[.,]\d+)?)\s*(?P<unit>NM|N\s*M|KM|M)"
    r"\s+de\s+rayon\s+centr[eé]\s+sur",
    re.IGNORECASE,
)
EXTERNAL_BOUNDARY_RE = re.compile(
    r"\b(?:fronti[eè]re|ligne\s+de\s+c[oô]te|rivage|limite\s+maritime|thalweg|identiques?\s+[àa]\s+celles?)\b",
    re.IGNORECASE,
)
EXCLUSION_RE = re.compile(r"\b(?:[àa]\s+l['’]exclusion|hors\s+la\s+partie|se\s+substitue)\b", re.IGNORECASE)
AIRSPACE_REFERENCE_RE = re.compile(
    r"(?:limites?\s+(?:lat[eé]rales?\s+)?(?:sont\s+)?(?:identiques?|correspondant(?:es)?|reprises?)\s+[àa]\s+celles?\s+(?:de\s+)?|"
    r"reprend(?:re|ant)?\s+les\s+limites?\s+(?:lat[eé]rales?\s+)?(?:de\s+)?)"
    r"(?:la\s+zone\s+)?LF\s*-?\s*(?P<type>[RPD])\s*(?P<name>\d+[A-Z0-9]*)",
    re.IGNORECASE,
)
FBZ_SECTION_RE = re.compile(
    r"(?:ZONES?\s+TAMPON\s+ASSOCI[EÉ]ES?|FBZ\s*-\s*FLIGHT\s+BUFFER\s+ZONE)",
    re.IGNORECASE,
)
NON_SPATIAL_TITLE_RE = re.compile(
    r"\b(?:modification\s+temporaire\s+de\s+l['’]itin[eé]raire\s+h[eé]licopt[eè]res?|"
    r"itin[eé]raire\s+h[eé]licopt[eè]res?)\b",
    re.IGNORECASE,
)

GENERIC_ZONE_NAME_RE = re.compile(
    r"^(?:ZRT/ZDT|ZRT|ZDT|ZIT|TRA|TSA|CTR|TMA|RMZ|TMZ|FBZ)[.\s:-]*(?:ACTIVABLE\s+H24)?$",
    re.IGNORECASE,
)
ZONE_METADATA_NAME_RE = re.compile(
    r"\b(?:ACTIVABLE\s+H24|PUBLI[EÉ]E?\s+[ÀA]|LIMITES?\s+(?:LAT[EÉ]RALES?|VERTICALES?)|"
    r"DATES?\s+ET\s+HEURES?|CONDITIONS?\s+D['’]ACTIVATION)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ListingEntry:
    sup_aip: str
    title: str
    valid_from: str
    valid_to: str
    pdf_url: str
    vfr: bool
    fingerprint: str


@dataclass(frozen=True)
class CoordinateMatch:
    lon: float
    lat: float
    start: int
    end: int


@dataclass(frozen=True)
class PdfBlock:
    page_index: int
    x0: float
    y0: float
    x1: float
    y1: float
    text: str

    @property
    def center_x(self) -> float:
        return (self.x0 + self.x1) / 2.0

    @property
    def center_y(self) -> float:
        return (self.y0 + self.y1) / 2.0


@dataclass(frozen=True)
class PdfPageLayout:
    page_index: int
    width: float
    height: float
    blocks: tuple[PdfBlock, ...]


@dataclass(frozen=True)
class PdfDocumentLayout:
    text: str
    pages: tuple[PdfPageLayout, ...]


@dataclass
class ParsedZone:
    name: str
    zone_type: str
    geometry: dict[str, Any] | None
    lower_limit: str = ""
    upper_limit: str = ""
    vertical_extracted: bool = False
    confidence: str = "high"
    page_index: int | None = None
    position_y: float = 0.0
    warnings: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ParseResult:
    features: list[dict[str, Any]]
    warnings: list[str]
    expected_named_geometry_count: int
    declared_zone_count: int | None
    missing_vertical_count: int
    ignored_reference_object_count: int


_AIRSPACE_CATALOG_CACHE: list[dict[str, Any]] | None = None


def clean_space(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("\u200b", " ").replace("\xad", "")
    return re.sub(r"\s+", " ", value).strip()


def clean_listing_title(value: str) -> str:
    value = BeautifulSoup(value, "html.parser").get_text(" ", strip=True)
    value = value.replace("\\'", "'")
    return clean_space(value)


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = value.replace("\x00", "").replace("\u00ad", "")
    value = value.replace("–", "-").replace("—", "-")
    value = value.replace("’", "'").replace("′", "'").replace("″", '"').replace("”", '"')
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def make_session() -> requests.Session:
    retry = Retry(
        total=4,
        connect=4,
        read=4,
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5"})
    session.mount("https://", HTTPAdapter(max_retries=retry))
    return session


def fetch_bytes(session: requests.Session, url: str, timeout: int = 60) -> bytes:
    response = session.get(url, timeout=timeout)
    response.raise_for_status()
    return response.content


def normalize_sup_number(raw: str) -> str:
    match = SUP_NUMBER_RE.search(raw)
    if not match:
        return raw.strip()
    year = match.group(2)
    if len(year) == 4:
        year = year[-2:]
    return f"{match.group(1)}/{year}"


def parse_listing(html: str) -> tuple[list[ListingEntry], str | None]:
    soup = BeautifulSoup(html, "html.parser")
    entries_by_number: dict[str, ListingEntry] = {}

    for anchor in soup.find_all("a", href=True):
        anchor_text = clean_listing_title(anchor.get_text(" ", strip=True))
        number_match = SUP_NUMBER_RE.search(anchor_text)
        if not number_match:
            continue

        href = urljoin(SOURCE_URL, anchor.get("href", ""))
        if "/documents/download/" not in href and not href.lower().endswith(".pdf"):
            continue

        container = anchor
        container_text = anchor_text
        validity_match = None
        for _ in range(8):
            container_text = clean_listing_title(container.get_text(" ", strip=True))
            validity_match = VALIDITY_RE.search(container_text)
            if validity_match:
                break
            if container.parent is None:
                break
            container = container.parent

        if not validity_match:
            continue

        sup_aip = normalize_sup_number(number_match.group(0))
        title = re.sub(r"^\s*\d{3}\s*/\s*\d{2,4}\s*", "", anchor_text).strip(" -")
        title = clean_listing_title(title or anchor_text)
        valid_from, valid_to = validity_match.groups()
        vfr = bool(re.search(r"\bVFR\b", container_text, re.IGNORECASE))
        fingerprint_raw = "|".join((sup_aip, title, valid_from, valid_to, href, PARSER_VERSION))
        fingerprint = hashlib.sha256(fingerprint_raw.encode("utf-8")).hexdigest()[:20]
        entries_by_number[sup_aip] = ListingEntry(
            sup_aip=sup_aip,
            title=title,
            valid_from=valid_from,
            valid_to=valid_to,
            pdf_url=href,
            vfr=vfr,
            fingerprint=fingerprint,
        )

    page_text = clean_listing_title(soup.get_text(" ", strip=True))
    source_updated_at = None
    update_match = UPDATE_DATE_RE.search(page_text)
    if update_match:
        day, month, year = update_match.group(1).split("/")
        source_updated_at = f"{year}-{month}-{day}T00:00:00Z"

    return sorted(entries_by_number.values(), key=lambda item: item.sup_aip, reverse=True), source_updated_at


def extract_pdf_document(pdf_bytes: bytes) -> PdfDocumentLayout:
    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages: list[PdfPageLayout] = []
    page_texts: list[str] = []
    try:
        for page_index, page in enumerate(document):
            page_text = page.get_text("text", sort=True)
            page_texts.append(f"\n--- PAGE {page_index + 1} ---\n{page_text}")
            blocks: list[PdfBlock] = []
            for x0, y0, x1, y1, text, *_ in page.get_text("blocks", sort=False):
                normalized = normalize_text(text)
                if not normalized:
                    continue
                blocks.append(PdfBlock(page_index, float(x0), float(y0), float(x1), float(y1), normalized))
            pages.append(PdfPageLayout(page_index, float(page.rect.width), float(page.rect.height), tuple(blocks)))
    finally:
        document.close()
    return PdfDocumentLayout(normalize_text("\n".join(page_texts)), tuple(pages))


def extract_pdf_text(pdf_bytes: bytes) -> str:
    return extract_pdf_document(pdf_bytes).text


def dms_to_decimal(deg: str, minute: str, second: str, hemisphere: str) -> float:
    value = float(deg) + float(minute) / 60.0 + float(second.replace(",", ".")) / 3600.0
    if hemisphere.upper() in ("S", "W"):
        value *= -1
    return value


def coordinate_matches(text: str) -> list[CoordinateMatch]:
    matches: list[CoordinateMatch] = []
    occupied: list[tuple[int, int]] = []
    for pattern in (DMS_RE, COMPACT_DMS_RE):
        for match in pattern.finditer(text):
            if any(match.start() < end and match.end() > start for start, end in occupied):
                continue
            lat = dms_to_decimal(match.group("latd"), match.group("latm"), match.group("lats"), match.group("lath"))
            lon = dms_to_decimal(match.group("lond"), match.group("lonm"), match.group("lons"), match.group("lonh"))
            if not (40.0 <= lat <= 52.5 and -8.5 <= lon <= 12.5):
                continue
            matches.append(CoordinateMatch(lon=lon, lat=lat, start=match.start(), end=match.end()))
            occupied.append((match.start(), match.end()))
    matches.sort(key=lambda item: item.start)
    return matches


def point_equal(a: tuple[float, float], b: tuple[float, float], tolerance: float = 1e-5) -> bool:
    return abs(a[0] - b[0]) <= tolerance and abs(a[1] - b[1]) <= tolerance


def close_ring(points: list[tuple[float, float]]) -> list[list[float]]:
    unique: list[tuple[float, float]] = []
    for point in points:
        if not unique or not point_equal(point, unique[-1]):
            unique.append(point)
    if len(unique) < 3:
        return []
    if not point_equal(unique[0], unique[-1]):
        unique.append(unique[0])
    return [[round(lon, 7), round(lat, 7)] for lon, lat in unique]


def destination_point(center_lon: float, center_lat: float, radius_nm: float, bearing_deg: float) -> tuple[float, float]:
    earth_radius_nm = 3440.065
    angular = radius_nm / earth_radius_nm
    bearing = math.radians(bearing_deg)
    lat1 = math.radians(center_lat)
    lon1 = math.radians(center_lon)
    lat2 = math.asin(math.sin(lat1) * math.cos(angular) + math.cos(lat1) * math.sin(angular) * math.cos(bearing))
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular) * math.cos(lat1),
        math.cos(angular) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lon2), math.degrees(lat2)


def circle_polygon(center_lon: float, center_lat: float, radius_nm: float, steps: int = 96) -> dict[str, Any]:
    coordinates = [
        [round(lon, 7), round(lat, 7)]
        for lon, lat in (destination_point(center_lon, center_lat, radius_nm, 360.0 * index / steps) for index in range(steps + 1))
    ]
    return {"type": "Polygon", "coordinates": [coordinates]}


def initial_bearing(center: tuple[float, float], point: tuple[float, float]) -> float:
    lon1, lat1 = map(math.radians, center)
    lon2, lat2 = map(math.radians, point)
    delta_lon = lon2 - lon1
    y = math.sin(delta_lon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(delta_lon)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def interpolate_arc(
    start: tuple[float, float],
    end: tuple[float, float],
    center: tuple[float, float],
    radius_nm: float,
    clockwise: bool,
) -> list[tuple[float, float]]:
    start_bearing = initial_bearing(center, start)
    end_bearing = initial_bearing(center, end)
    if clockwise:
        sweep = (end_bearing - start_bearing) % 360.0
    else:
        sweep = -((start_bearing - end_bearing) % 360.0)
    steps = max(8, min(180, int(abs(sweep) / 3.0) + 1))
    points: list[tuple[float, float]] = []
    for index in range(steps + 1):
        bearing = start_bearing + sweep * index / steps
        points.append(destination_point(center[0], center[1], radius_nm, bearing))
    points[0] = start
    points[-1] = end
    return points


def normalize_vertical_limit(value: str) -> str:
    normalized = clean_space(value).upper()
    normalized = re.sub(r"FL\s*(\d+)", r"FL \1", normalized)
    normalized = re.sub(r"\s*FT\b", " ft", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def extract_vertical_pair(text: str) -> tuple[str, str] | None:
    normalized = normalize_text(text)
    match = VERTICAL_SLASH_RE.search(normalized) or VERTICAL_DASH_RE.search(normalized)
    if not match:
        return None
    lower = normalize_vertical_limit(match.group("lower"))
    upper = normalize_vertical_limit(match.group("upper"))
    return lower, upper


def extract_vertical_limits(text: str) -> list[tuple[str, str]]:
    values: list[tuple[str, str]] = []
    for pattern in (VERTICAL_SLASH_RE, VERTICAL_DASH_RE):
        for match in pattern.finditer(normalize_text(text)):
            pair = (normalize_vertical_limit(match.group("lower")), normalize_vertical_limit(match.group("upper")))
            if pair not in values:
                values.append(pair)
    return values


ZONE_NAME_STOP_RE = re.compile(
    r"\b(?:LIMITES?\s+(?:LAT[EÉ]RALES?|VERTICALES?)|DATES?\s+ET\s+HEURES?|ACTIVIT[EÉ]|STATUT|GESTIONNAIRE(?:S)?|INFORMATION\s+DES\s+USAGERS|ERNIP\s+identification)\b",
    re.IGNORECASE,
)
SERVICE_SUFFIX_RE = re.compile(
    r"\b(?:PARIS|BORDEAUX|BREST|NANTES|LILLE|COGNAC|ORLY|IROISE|LORIENT|LANV[EÉ]OC|OCHEY|AQUITAINE|MARSEILLE|CLERMONT|TOULOUSE|BIARRITZ|PYR[EÉ]N[EÉ]ES|MARSAN|ARMOR|MARINA|RAMBERT)\s+(?:CTL|APP|INFO|ACC|CDC)\b",
    re.IGNORECASE,
)


def clean_zone_name(value: str) -> str:
    name = clean_space(value).strip(" /,;:-")
    cut_positions: list[int] = []
    for pattern in (ZONE_NAME_STOP_RE, SERVICE_SUFFIX_RE, DMS_RE, COMPACT_DMS_RE):
        match = pattern.search(name)
        if match:
            cut_positions.append(match.start())
    degree_match = re.search(r"\b\d{2,3}\s*[°º]", name)
    if degree_match:
        cut_positions.append(degree_match.start())
    frequency_match = re.search(r"\b\d{3}[.,]\d{3}\s*MHz\b", name, re.IGNORECASE)
    if frequency_match:
        cut_positions.append(frequency_match.start())
    if cut_positions:
        name = name[: min(cut_positions)]
    vertical = VERTICAL_SLASH_RE.search(name) or VERTICAL_DASH_RE.search(name)
    if vertical:
        name = name[: vertical.start()]
    name = clean_space(name).strip(" /,;:-(")
    name = re.sub(r"\s+[NSEW]$", "", name, flags=re.IGNORECASE).strip()
    if re.fullmatch(r"(?:ZRT/ZDT|ZRT|ZDT|ZIT|TRA|TSA|CTR|TMA|RMZ|TMZ|FBZ)(?:\s+(?:ILES?\s+DE|ILE\s+DE))?", name, re.IGNORECASE):
        return ""
    return name


def zone_identity_key(name: str) -> str:
    cleaned = clean_zone_name(name)
    cleaned = re.sub(r"\s*\((?:PPS|IHEDN)[^)]*\)\s*", " ", cleaned, flags=re.IGNORECASE)
    normalized = unicodedata.normalize("NFKD", cleaned).encode("ascii", "ignore").decode("ascii").upper()
    normalized = re.sub(r"[^A-Z0-9/]+", " ", normalized)
    return clean_space(normalized)


def normalize_temporary_lfr_code(value: str) -> str:
    match = TEMPORARY_LFR_CODE_RE.search(value)
    if not match:
        return ""
    return f"LFR{match.group('number')}{match.group('suffix').upper()}"


def temporary_lfr_names(value: str) -> list[str]:
    names: list[str] = []
    for match in TEMPORARY_LFR_CODE_RE.finditer(clean_space(value)):
        name = f"LFR{match.group('number')}{match.group('suffix').upper()}"
        if name not in names:
            names.append(name)
    return names


def split_zone_names(value: str) -> list[str]:
    text = clean_space(value).strip(" :")
    starts = [match.start() for match in ZONE_START_RE.finditer(text)]
    names: list[str] = []
    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else len(text)
        name = clean_zone_name(text[start:end])
        if not name:
            continue
        if re.search(r"\b(?:lorsqu['’]elle|interf[eé]rente|sont\s+utilisables?|ne\s+seront\s+pas)\b", name, re.IGNORECASE):
            continue
        if name.upper() in {"ZRT/ZDT ORG", "ZRT ORG", "ZDT ORG"}:
            continue
        if name and name not in names:
            names.append(name)
    if not names:
        names.extend(temporary_lfr_names(text))
    return names


def leading_zone_name(value: str) -> str:
    text = clean_space(value)
    match = ZONE_START_RE.match(text)
    if not match:
        return normalize_temporary_lfr_code(text) if TEMPORARY_LFR_CODE_RE.fullmatch(text.strip()) else ""
    stop = ZONE_NAME_STOP_RE.search(text, match.end())
    candidate = text[: stop.start()] if stop else text
    return clean_zone_name(candidate)


def starts_with_zone(value: str) -> bool:
    cleaned = clean_space(value)
    if TEMPORARY_LFR_CODE_RE.match(cleaned):
        return True
    return bool(
        re.match(
            r"^\s*(?:ZRT/ZDT\b|ZRT\b|ZDT\b|ZIT\b|TRA(?=\b|\d)|TSA(?=\b|\d)|CTR\b|TMA\b|RMZ\b|TMZ\b|FBZ\b)",
            cleaned,
            re.IGNORECASE,
        )
    )


def is_zone_heading_block(block: PdfBlock) -> bool:
    text = clean_space(block.text)
    if not starts_with_zone(text) or "°" in text:
        return False
    if len(text) > 320:
        return False
    if re.search(r"\b(?:ACTIVIT[EÉ]|STATUT|CONDITIONS|INFORMATION|GESTIONNAIRE|SERVICES|TOUTES\s+LES\s+ZONES)\b", text, re.IGNORECASE):
        return False
    # A heading can include the shared table title "LIMITES ..." followed by
    # the actual zone name. Do not reject it when one unambiguous name follows.
    if re.search(r"\bLIMITES\b", text, re.IGNORECASE) and len(split_zone_names(text)) != 1:
        return False
    return bool(split_zone_names(text))


def zone_type_from_name(name: str, title: str) -> str:
    match = re.match(
        r"^\s*(ZRT/ZDT|ZRT|ZDT|ZIT|TRA(?=\b|\d)|TSA(?=\b|\d)|CTR|TMA|RMZ|TMZ|FBZ)",
        name,
        re.IGNORECASE,
    )
    if match:
        return match.group(1).upper()
    if TEMPORARY_LFR_CODE_RE.search(name):
        return "ZRT"
    match = ZONE_TOKEN_RE.search(title)
    return match.group(1).upper() if match else "Zone temporaire"


def radius_to_nm(value: str, unit: str) -> float:
    radius = float(value.replace(",", "."))
    normalized_unit = unit.replace(" ", "").upper()
    if normalized_unit == "KM":
        radius /= 1.852
    elif normalized_unit == "M":
        radius /= 1852.0
    return radius


def geometry_from_text(text: str) -> tuple[dict[str, Any] | None, str, list[str]]:
    normalized = normalize_text(text)
    coordinates = coordinate_matches(normalized)
    warnings: list[str] = []
    confidence = "high"

    circle_match = CIRCLE_RE.search(normalized)
    if circle_match and coordinates:
        center = next((coord for coord in coordinates if coord.start >= circle_match.start()), coordinates[0])
        radius_nm = radius_to_nm(circle_match.group("radius"), circle_match.group("unit"))
        if not (0.02 <= radius_nm <= 250.0):
            return None, "medium", ["Rayon circulaire hors plage de contrôle."]
        if EXCLUSION_RE.search(normalized):
            warnings.append("Exclusion interne non découpée: contour extérieur affiché par prudence.")
            confidence = "medium"
        return circle_polygon(center.lon, center.lat, radius_nm), confidence, warnings

    if len(coordinates) < 3:
        return None, "medium", ["Moins de trois coordonnées exploitables."]

    if EXTERNAL_BOUNDARY_RE.search(normalized):
        return None, "medium", ["Limite dépendant d'une frontière, d'une côte ou d'un autre espace aérien."]

    points = [(coord.lon, coord.lat) for coord in coordinates]
    arc_matches = list(ARC_RE.finditer(normalized))
    if arc_matches:
        for arc_match in reversed(arc_matches):
            center_index = next(
                (
                    index
                    for index, coordinate in enumerate(coordinates)
                    if coordinate.start >= arc_match.start() and coordinate.start <= arc_match.end() + 300
                ),
                None,
            )
            if center_index is None or center_index == 0 or center_index >= len(coordinates) - 1:
                return None, "medium", ["Arc détecté mais centre ou extrémités non identifiés."]
            radius_nm = radius_to_nm(arc_match.group("radius"), arc_match.group("unit"))
            clockwise = not bool(re.search(r"anti", arc_match.group("direction"), re.IGNORECASE))
            arc_points = interpolate_arc(points[center_index - 1], points[center_index + 1], points[center_index], radius_nm, clockwise)
            points = points[: center_index - 1] + arc_points + points[center_index + 2 :]
            coordinates = coordinates[: center_index] + coordinates[center_index + 1 :]

    ring = close_ring(points)
    if len(ring) < 4:
        return None, "medium", ["Polygone incomplet."]
    if not point_equal(points[0], points[-1]):
        confidence = "medium"
        warnings.append("Contour fermé automatiquement entre la dernière et la première coordonnée.")
    if EXCLUSION_RE.search(normalized):
        confidence = "medium"
        warnings.append("Exclusion interne non découpée: contour extérieur affiché par prudence.")
    return {"type": "Polygon", "coordinates": [ring]}, confidence, warnings


def load_airspace_catalog(path: Path = Path("src/data/airspaceCatalog.ts")) -> list[dict[str, Any]]:
    global _AIRSPACE_CATALOG_CACHE
    if _AIRSPACE_CATALOG_CACHE is not None:
        return _AIRSPACE_CATALOG_CACHE
    try:
        raw = path.read_text(encoding="utf-8")
        prefix = "export const AIRSPACE_CATALOG = "
        start = raw.index(prefix) + len(prefix)
        end = raw.rindex(" as AirspaceCatalogItem[];")
        payload = json.loads(raw[start:end])
        _AIRSPACE_CATALOG_CACHE = payload if isinstance(payload, list) else []
    except (OSError, ValueError, json.JSONDecodeError):
        _AIRSPACE_CATALOG_CACHE = []
    return _AIRSPACE_CATALOG_CACHE


def catalog_reference_geometry(reference_type: str, reference_name: str) -> dict[str, Any] | None:
    target_type = reference_type.upper()
    target_name = re.sub(r"[^A-Z0-9]", "", reference_name.upper())
    for item in load_airspace_catalog():
        item_type = re.sub(r"[^A-Z]", "", str(item.get("type") or "").upper())
        item_name = re.sub(r"[^A-Z0-9]", "", str(item.get("name") or "").upper())
        if item_type != target_type or item_name != target_name:
            continue
        polygons: list[list[list[float]]] = []
        for part in item.get("parts", []):
            points = part.get("points") or []
            ring = close_ring([(float(point[1]), float(point[0])) for point in points if len(point) >= 2])
            if len(ring) >= 4:
                polygons.append(ring)
        if not polygons:
            return None
        if len(polygons) == 1:
            return {"type": "Polygon", "coordinates": [polygons[0]]}
        return {"type": "MultiPolygon", "coordinates": [[[point for point in ring]] for ring in polygons]}
    return None


def resolve_permanent_airspace_references(zones: list[ParsedZone], document_text: str) -> None:
    references: list[tuple[str, str, dict[str, Any]]] = []
    for match in AIRSPACE_REFERENCE_RE.finditer(normalize_text(document_text)):
        geometry = catalog_reference_geometry(match.group("type"), match.group("name"))
        if geometry:
            key = (match.group("type").upper(), match.group("name").upper())
            if not any(existing[0:2] == key for existing in references):
                references.append((key[0], key[1], geometry))
    missing = [zone for zone in zones if zone.geometry is None]
    if not missing or not references:
        return
    if len(references) == 1:
        assignments = [(zone, references[0]) for zone in missing]
    elif len(references) == len(missing):
        assignments = list(zip(missing, references))
    else:
        return
    for zone, (reference_type, reference_name, geometry) in assignments:
        zone.geometry = copy.deepcopy(geometry)
        zone.confidence = "high"
        zone.warnings = [warning for warning in zone.warnings if "Limite dépendant" not in warning]
        zone.warnings.append(
            f"Limites latérales reprises du catalogue CAP CLAIR LF-{reference_type}{reference_name}, conformément au PDF SIA."
        )


def block_distance_to_y(block: PdfBlock, y: float) -> float:
    if block.y0 <= y <= block.y1:
        return 0.0
    return min(abs(y - block.y0), abs(y - block.y1))


def self_contained_zones(page: PdfPageLayout) -> list[ParsedZone]:
    zones: list[ParsedZone] = []
    for block in page.blocks:
        name = leading_zone_name(block.text)
        if not name:
            continue
        vertical = extract_vertical_pair(block.text)
        geometry, confidence, warnings = geometry_from_text(block.text)
        if not geometry or not vertical:
            continue
        zones.append(
            ParsedZone(
                name=name,
                zone_type=zone_type_from_name(name, ""),
                geometry=geometry,
                lower_limit=vertical[0],
                upper_limit=vertical[1],
                vertical_extracted=True,
                confidence=confidence,
                page_index=page.page_index,
                position_y=block.y0,
                warnings=warnings,
            )
        )
    return zones



def embedded_column_zones(page: PdfPageLayout) -> list[ParsedZone]:
    """Parse table cells that contain name, coordinates and a detached vertical block.

    Some SIA PDFs, notably SUP AIP 207/25, expose each table cell as one
    PyMuPDF block while the vertical value (for example SFC/UNL) is emitted as
    a second tiny block immediately underneath. The standard grid parser
    expects separate heading blocks and therefore misses these cells entirely.
    """
    vertical_blocks: list[tuple[PdfBlock, tuple[str, str]]] = []
    for candidate in page.blocks:
        pair = extract_vertical_pair(candidate.text)
        if pair:
            vertical_blocks.append((candidate, pair))

    zones: list[ParsedZone] = []
    for block in page.blocks:
        normalized = normalize_text(block.text)
        if not re.search(r"LIMITES?\s+LAT[EÉ]RALES?", normalized, re.IGNORECASE):
            continue
        if len(coordinate_matches(normalized)) < 3:
            continue
        names = split_zone_names(normalized)
        if len(names) != 1:
            continue

        name = names[0]
        geometry, confidence, warnings = geometry_from_text(normalized)
        vertical = extract_vertical_pair(normalized)
        if vertical is None:
            # The meaningful column centre is close to x0 + 45 pt. This also
            # handles a first cell whose block is widened by a page-wide table
            # title while its coordinates remain in the left-most column.
            target_x = block.x0 + min(45.0, max(1.0, (block.x1 - block.x0) / 2.0))
            candidates = [
                (candidate, pair)
                for candidate, pair in vertical_blocks
                if block.y1 - 6.0 <= candidate.y0 <= block.y1 + 60.0
                and (
                    candidate.x0 - 8.0 <= target_x <= candidate.x1 + 8.0
                    or abs(candidate.center_x - target_x) <= 42.0
                )
            ]
            if candidates:
                _, vertical = min(
                    candidates,
                    key=lambda item: (
                        max(0.0, item[0].y0 - block.y1),
                        abs(item[0].center_x - target_x),
                    ),
                )

        if geometry is None and vertical is None:
            continue
        zones.append(
            ParsedZone(
                name=name,
                zone_type=zone_type_from_name(name, ""),
                geometry=geometry,
                lower_limit=vertical[0] if vertical else "",
                upper_limit=vertical[1] if vertical else "",
                vertical_extracted=bool(vertical),
                confidence=confidence,
                page_index=page.page_index,
                position_y=block.y0,
                warnings=warnings,
            )
        )
    return zones

def row_table_zones(page: PdfPageLayout) -> list[ParsedZone]:
    headings = [
        block
        for block in page.blocks
        if block.x0 < page.width * 0.30 and is_zone_heading_block(block) and len(split_zone_names(block.text)) == 1
    ]
    coordinate_blocks = [
        block
        for block in page.blocks
        if page.width * 0.22 <= block.x0 <= page.width * 0.62 and len(coordinate_matches(block.text)) >= 3
    ]
    vertical_blocks = [block for block in page.blocks if extract_vertical_pair(block.text)]
    if not headings or not coordinate_blocks:
        return []

    zones: list[ParsedZone] = []
    for heading in sorted(headings, key=lambda item: item.center_y):
        name = split_zone_names(heading.text)[0]
        coordinate_candidates = [
            block
            for block in coordinate_blocks
            if block_distance_to_y(block, heading.center_y) <= 55.0
        ]
        coordinate_block = min(coordinate_candidates, key=lambda block: block_distance_to_y(block, heading.center_y), default=None)

        vertical = extract_vertical_pair(heading.text)
        if not vertical:
            vertical_candidates = [
                block
                for block in vertical_blocks
                if block.x0 >= page.width * 0.40 and block_distance_to_y(block, heading.center_y) <= 55.0
            ]
            vertical_block = min(vertical_candidates, key=lambda block: block_distance_to_y(block, heading.center_y), default=None)
            vertical = extract_vertical_pair(vertical_block.text) if vertical_block else None

        if coordinate_block:
            geometry_text = coordinate_block.text
            geometry, confidence, warnings = geometry_from_text(geometry_text)
        else:
            geometry, confidence, warnings = None, "medium", []

        if geometry or vertical:
            zones.append(
                ParsedZone(
                    name=name,
                    zone_type=zone_type_from_name(name, ""),
                    geometry=geometry,
                    lower_limit=vertical[0] if vertical else "",
                    upper_limit=vertical[1] if vertical else "",
                    vertical_extracted=bool(vertical),
                    confidence=confidence,
                    page_index=page.page_index,
                    position_y=heading.y0,
                    warnings=warnings,
                )
            )
    return zones


def grouped_heading_rows(page: PdfPageLayout) -> list[tuple[float, list[PdfBlock], list[str], list[PdfBlock]]]:
    heading_blocks = [block for block in page.blocks if is_zone_heading_block(block)]
    raw_groups: list[list[PdfBlock]] = []
    for block in sorted(heading_blocks, key=lambda item: (item.y0, item.x0)):
        group = next((items for items in raw_groups if abs(items[0].y0 - block.y0) <= 6.0), None)
        if group is None:
            raw_groups.append([block])
        else:
            group.append(block)

    groups: list[tuple[float, list[PdfBlock], list[str], list[PdfBlock]]] = []
    for blocks in raw_groups:
        y = min(block.y0 for block in blocks)
        names: list[str] = []
        for block in sorted(blocks, key=lambda item: item.x0):
            names.extend(split_zone_names(block.text))
        markers = [
            block
            for block in page.blocks
            if y < block.y0 < y + 105.0 and re.search(r"LIMITES\s+LAT", block.text, re.IGNORECASE)
        ]
        markers.sort(key=lambda item: item.center_x)
        if names and len(markers) == len(names):
            groups.append((y, blocks, names, markers))
    return groups


def grid_zones(page: PdfPageLayout) -> list[ParsedZone]:
    groups = grouped_heading_rows(page)
    zones: list[ParsedZone] = []
    for group_index, (heading_y, _, names, markers) in enumerate(groups):
        next_y = groups[group_index + 1][0] if group_index + 1 < len(groups) else page.height - 20.0
        centers = [marker.center_x for marker in markers]
        boundaries = [0.0]
        boundaries.extend((centers[index] + centers[index + 1]) / 2.0 for index in range(len(centers) - 1))
        boundaries.append(page.width)

        for index, (name, marker) in enumerate(zip(names, markers)):
            column_blocks = [
                block
                for block in page.blocks
                if marker.y0 - 2.0 <= block.y0 < next_y
                and boundaries[index] <= block.center_x < boundaries[index + 1]
            ]
            column_blocks.sort(key=lambda item: item.y0)
            column_text = "\n".join(block.text for block in column_blocks)
            geometry, confidence, warnings = geometry_from_text(column_text)
            vertical = extract_vertical_pair(column_text)
            if geometry or vertical:
                zones.append(
                    ParsedZone(
                        name=name,
                        zone_type=zone_type_from_name(name, ""),
                        geometry=geometry,
                        lower_limit=vertical[0] if vertical else "",
                        upper_limit=vertical[1] if vertical else "",
                        vertical_extracted=bool(vertical),
                        confidence=confidence,
                        page_index=page.page_index,
                        position_y=heading_y,
                        warnings=warnings,
                    )
                )
    return zones


TABLE_STOP_RE = re.compile(
    r"^(?:DISPOSITIONS?|ORGANISMES?|GESTIONNAIRE|CONDITIONS|SERVICES|DATES?\s+ET\s+HEURES?|INFORMATION\s+DES\s+USAGERS)\b",
    re.IGNORECASE,
)
ZONE_SUFFIX_RE = re.compile(r"^(ALPHA|BRAVO|CHARLIE|DELTA|ECHO|FOXTROT|GOLF|HOTEL)\b", re.IGNORECASE)


@dataclass(frozen=True)
class ColumnHeading:
    name: str
    center_x: float
    y: float


def reconstructed_column_headings(page: PdfPageLayout) -> list[ColumnHeading]:
    """Return zone headings with an approximate column centre.

    SIA tables often expose one visual row as several unrelated PDF blocks.
    This helper handles both a block containing several designators and the
    Romorantin pattern where a shared prefix is followed by ALPHA/BRAVO/etc.
    """
    headings: list[ColumnHeading] = []
    suffix_blocks: list[PdfBlock] = []
    consumed_base_ids: set[int] = set()

    for block in page.blocks:
        suffix_match = ZONE_SUFFIX_RE.match(clean_space(block.text))
        if suffix_match and len(clean_space(block.text)) < 100:
            suffix_blocks.append(block)

    for suffix in suffix_blocks:
        suffix_name = ZONE_SUFFIX_RE.match(clean_space(suffix.text))
        if not suffix_name:
            continue
        candidates: list[PdfBlock] = []
        for block in page.blocks:
            names = split_zone_names(block.text)
            if len(names) != 1 or block.y0 > suffix.y0 + 2.0:
                continue
            if suffix.y0 - block.y1 > 45.0:
                continue
            horizontal_overlap = min(block.x1, suffix.x1) - max(block.x0, suffix.x0)
            if horizontal_overlap >= -8.0:
                candidates.append(block)
        if not candidates:
            continue
        base = min(candidates, key=lambda item: (max(0.0, suffix.y0 - item.y1), abs(item.center_x - suffix.center_x)))
        base_name = split_zone_names(base.text)[0]
        full_name = clean_zone_name(f"{base_name} {suffix_name.group(1).upper()}")
        if full_name:
            headings.append(ColumnHeading(full_name, suffix.center_x, min(base.y0, suffix.y0)))
            consumed_base_ids.add(id(base))

    for block in page.blocks:
        names = split_zone_names(block.text)
        if not names or id(block) in consumed_base_ids:
            continue
        text = clean_space(block.text)
        if len(text) > 340 or "°" in text:
            continue
        if re.search(r"\b(?:ACTIVIT[EÉ]|STATUT|CONDITIONS|INFORMATION|GESTIONNAIRE|SERVICES|TOUTES\s+LES\s+ZONES)\b", text, re.IGNORECASE):
            continue
        if len(names) == 1:
            headings.append(ColumnHeading(names[0], block.center_x, block.y0))
            continue
        width = max(1.0, block.x1 - block.x0)
        for index, name in enumerate(names):
            center = block.x0 + width * ((index + 0.5) / len(names))
            headings.append(ColumnHeading(name, center, block.y0))

    unique: dict[str, ColumnHeading] = {}
    for heading in headings:
        key = zone_identity_key(heading.name)
        current = unique.get(key)
        if not key:
            continue
        if current is None or heading.y > current.y:
            unique[key] = heading
    return sorted(unique.values(), key=lambda item: item.center_x)


def column_cluster_zones(page: PdfPageLayout) -> list[ParsedZone]:
    """Parse visually aligned columns even when PDF blocks are split oddly."""
    coordinate_blocks = [block for block in page.blocks if len(coordinate_matches(block.text)) >= 3]
    if not coordinate_blocks:
        return []
    headings = reconstructed_column_headings(page)
    if not headings:
        return []

    coord_min_y = min(block.y0 for block in coordinate_blocks)
    relevant = [heading for heading in headings if heading.y <= coord_min_y + 35.0 and coord_min_y - heading.y <= 220.0]
    if not relevant:
        return []

    centers = [heading.center_x for heading in relevant]
    boundaries = [0.0]
    boundaries.extend((centers[index] + centers[index + 1]) / 2.0 for index in range(len(centers) - 1))
    boundaries.append(page.width)
    table_start = min(heading.y for heading in relevant)
    stop_candidates = [
        block.y0
        for block in page.blocks
        if block.y0 > coord_min_y and TABLE_STOP_RE.match(clean_space(block.text))
    ]
    table_end = min(stop_candidates) if stop_candidates else page.height - 20.0

    page_verticals = [pair for block in page.blocks if table_start <= block.y0 < table_end if (pair := extract_vertical_pair(block.text))]
    shared_vertical = page_verticals[0] if page_verticals and len(set(page_verticals)) == 1 else None

    zones: list[ParsedZone] = []
    for index, heading in enumerate(relevant):
        column_blocks = [
            block
            for block in page.blocks
            if table_start - 4.0 <= block.y0 < table_end
            and boundaries[index] <= block.center_x < boundaries[index + 1]
        ]
        column_blocks.sort(key=lambda item: (item.y0, item.x0))
        column_text = "\n".join(block.text for block in column_blocks)
        geometry, confidence, warnings = geometry_from_text(column_text)
        coordinate_column_blocks = [block for block in column_blocks if coordinate_matches(block.text)]
        vertical = None
        if coordinate_column_blocks:
            coordinate_end = max(block.y1 for block in coordinate_column_blocks)
            vertical_candidates = [
                (block, pair)
                for block in page.blocks
                if (pair := extract_vertical_pair(block.text))
                and coordinate_end - 4.0 <= block.y0 <= coordinate_end + 80.0
            ]
            if vertical_candidates:
                _, vertical = min(
                    vertical_candidates,
                    key=lambda item: (
                        abs(item[0].y0 - coordinate_end),
                        0 if item[0].x0 <= heading.center_x <= item[0].x1 else abs(item[0].center_x - heading.center_x),
                    ),
                )
        vertical = vertical or extract_vertical_pair(column_text) or shared_vertical
        if geometry or vertical:
            zones.append(
                ParsedZone(
                    name=heading.name,
                    zone_type=zone_type_from_name(heading.name, ""),
                    geometry=geometry,
                    lower_limit=vertical[0] if vertical else "",
                    upper_limit=vertical[1] if vertical else "",
                    vertical_extracted=bool(vertical),
                    confidence=confidence,
                    page_index=page.page_index,
                    position_y=heading.y,
                    warnings=warnings,
                )
            )
    return zones


def single_zone_layout_fallback(document: PdfDocumentLayout, title: str) -> list[ParsedZone]:
    """Recover a one-zone publication whose limits table omits the zone name."""
    if declared_zone_count(title) != 1:
        return []
    candidate_names: list[str] = []
    for page in document.pages:
        for block in page.blocks:
            for name in split_zone_names(block.text):
                if name not in candidate_names and name.upper() not in {"ZRT", "ZDT", "ZIT"}:
                    candidate_names.append(name)
    if not candidate_names:
        return []
    # Prefer the shortest explicit designation. It is usually the map label,
    # whereas longer occurrences often include prose from the title.
    name = min(candidate_names, key=lambda item: (len(item), item))
    for page in document.pages:
        blocks_with_coordinates = [block for block in page.blocks if len(coordinate_matches(block.text)) >= 3]
        if not blocks_with_coordinates:
            continue
        page_text = "\n".join(block.text for block in sorted(page.blocks, key=lambda item: (item.y0, item.x0)))
        geometry, confidence, warnings = geometry_from_text(page_text)
        vertical = extract_vertical_pair(page_text)
        if geometry or vertical:
            return [
                ParsedZone(
                    name=name,
                    zone_type=zone_type_from_name(name, title),
                    geometry=geometry,
                    lower_limit=vertical[0] if vertical else "",
                    upper_limit=vertical[1] if vertical else "",
                    vertical_extracted=bool(vertical),
                    confidence=confidence,
                    page_index=page.page_index,
                    position_y=min(block.y0 for block in blocks_with_coordinates),
                    warnings=warnings,
                )
            ]
    return []


def text_fallback_zones(text: str, title: str) -> list[ParsedZone]:
    section_match = re.search(r"LIMITES\s+LAT[EÉ]RALES(?:\s+ET\s+VERTICALES)?", text, re.IGNORECASE)
    section = text[section_match.end() :] if section_match else text
    lines = section.splitlines()
    heading_indices: list[tuple[int, str]] = []
    for index, line in enumerate(lines):
        cleaned = clean_space(line)
        names = split_zone_names(cleaned)
        if len(names) == 1 and starts_with_zone(cleaned) and len(cleaned) < 160:
            heading_indices.append((index, names[0]))

    zones: list[ParsedZone] = []
    for position, (line_index, name) in enumerate(heading_indices):
        end_index = heading_indices[position + 1][0] if position + 1 < len(heading_indices) else min(len(lines), line_index + 80)
        body = "\n".join(lines[line_index:end_index])
        geometry, confidence, warnings = geometry_from_text(body)
        vertical = extract_vertical_pair(body)
        if geometry or vertical:
            zones.append(
                ParsedZone(
                    name=name,
                    zone_type=zone_type_from_name(name, title),
                    geometry=geometry,
                    lower_limit=vertical[0] if vertical else "",
                    upper_limit=vertical[1] if vertical else "",
                    vertical_extracted=bool(vertical),
                    confidence=confidence,
                    warnings=warnings,
                )
            )
    return zones


def zone_core_tokens(name: str) -> set[str]:
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii").upper()
    tokens = set(re.findall(r"[A-Z0-9]+", normalized))
    return tokens - {"ZRT", "ZDT", "ZIT", "TRA", "TSA", "HIGH", "LOW", "LIFT", "TEMPO", "UNIQUEMENT", "PPS", "IHEDN"}


def inherit_shared_geometries(zones: list[ParsedZone]) -> None:
    ordered = sorted(zones, key=lambda zone: ((zone.page_index if zone.page_index is not None else 10_000), zone.position_y))
    for index, zone in enumerate(ordered):
        if zone.geometry is not None or not zone.vertical_extracted or zone.page_index is None:
            continue
        core = zone_core_tokens(zone.name)
        if not core:
            continue
        candidates: list[tuple[float, ParsedZone]] = []
        for previous in ordered[:index]:
            if previous.page_index != zone.page_index or previous.geometry is None:
                continue
            distance = zone.position_y - previous.position_y
            if not (0.0 < distance <= 150.0):
                continue
            previous_core = zone_core_tokens(previous.name)
            overlap = len(core & previous_core) / max(1, len(core | previous_core))
            if overlap >= 0.45:
                candidates.append((distance - overlap * 100.0, previous))
        if not candidates:
            continue
        source = min(candidates, key=lambda item: item[0])[1]
        zone.geometry = copy.deepcopy(source.geometry)
        zone.confidence = "medium"
        zone.warnings.append(f"Limites latérales reprises de la zone adjacente {source.name} dans le même tableau SIA.")


def parsed_zone_score(zone: ParsedZone) -> int:
    return (100 if zone.geometry else 0) + (20 if zone.vertical_extracted else 0) + (5 if zone.confidence == "high" else 0)


def deduplicate_zones(zones: list[ParsedZone]) -> list[ParsedZone]:
    by_name: dict[str, ParsedZone] = {}
    for zone in zones:
        key = zone_identity_key(zone.name)
        if not key:
            continue
        current = by_name.get(key)
        if current is None or parsed_zone_score(zone) > parsed_zone_score(current):
            by_name[key] = zone
        elif current and zone.warnings:
            for warning in zone.warnings:
                if warning not in current.warnings:
                    current.warnings.append(warning)
    return list(by_name.values())


def compact_airspace_code(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").upper()
    return re.sub(r"[^A-Z0-9]", "", normalized)


def is_target_zone_name(name: str, entry_title: str) -> bool:
    """Return True only for an operational temporary-zone object.

    A temporary zone may legitimately include a permanent-looking LF-R code in
    its official name, for example ``ZRT LF-R400A`` or ``ZRT AVEL LF-R17 A1``.
    Such names must remain operational. Only a *bare* CTR/TMA/RMZ/TMZ/LF-R
    reference is filtered when the SUP AIP title does not explicitly create it.
    """
    cleaned = clean_zone_name(name)
    if not cleaned or GENERIC_ZONE_NAME_RE.fullmatch(cleaned) or ZONE_METADATA_NAME_RE.search(cleaned):
        return False
    upper = clean_space(cleaned).upper()
    if upper.startswith("FBZ"):
        return False

    explicit_temporary = re.match(
        r"^(?:ZRT/ZDT|ZRT|ZDT|ZIT|TRA(?=\b|\d)|TSA(?=\b|\d))",
        upper,
    )
    if explicit_temporary:
        return True

    token = re.match(r"^(CTR|TMA|RMZ|TMZ)\b", upper)
    if token:
        zone_type = token.group(1)
        return bool(re.search(rf"\b{zone_type}\s+TEMPORAIRE(?:S)?\b", entry_title, re.IGNORECASE))

    lfr_code = normalize_temporary_lfr_code(cleaned)
    if lfr_code:
        title_code = compact_airspace_code(entry_title)
        if lfr_code not in title_code:
            return False
        if re.search(r"MODIFICATION\s+DES?\s+ZONES?\s+LF\s*-?\s*R", entry_title, re.IGNORECASE):
            return False
        if not re.search(r"CR[EÉ]ATION", entry_title, re.IGNORECASE):
            return False

    return True

def filter_target_zones(zones: list[ParsedZone], entry: ListingEntry) -> tuple[list[ParsedZone], list[str]]:
    """Remove only clearly non-operational labels, never a plausible zone.

    We deliberately avoid geometry-based deletion: two operational zones can
    share the same lateral contour while having different rules or names.
    """
    filtered: list[ParsedZone] = []
    ignored: list[str] = []
    for zone in zones:
        if is_target_zone_name(zone.name, entry.title):
            filtered.append(zone)
        else:
            ignored.append(zone.name)
    return filtered, list(dict.fromkeys(filter(None, ignored)))


def declared_zone_count(title: str) -> int | None:
    cleaned = clean_space(title).lower()
    numeric_counts = [
        int(value)
        for value in re.findall(
            r"(\d+)\s+(?:zones?\s+)?(?:r[eé]glement[eé]es?|dangereuses?|interdites?|r[eé]serv[eé]es?|zrt|zdt|zit|tra|tsa)\b",
            cleaned,
        )
    ]
    if numeric_counts:
        return sum(numeric_counts)
    total_match = re.search(r"cr[eé]ation\s+de\s+(\d+)\s+zones?", cleaned)
    if total_match:
        return int(total_match.group(1))
    word_values = {"une": 1, "un": 1, "deux": 2, "trois": 3, "quatre": 4, "cinq": 5, "six": 6, "sept": 7, "huit": 8, "neuf": 9, "douze": 12, "seize": 16}
    word_counts = [
        word_values[word]
        for word in re.findall(
            r"\b(une|un|deux|trois|quatre|cinq|six|sept|huit|neuf|douze|seize)\s+(?:zones?\s+)?(?:r[eé]glement[eé]es?|dangereuses?|interdites?|r[eé]serv[eé]es?|zrt|zdt|zit|tra|tsa)\b",
            cleaned,
        )
    ]
    return sum(word_counts) if word_counts else None


def authoritative_row_headings(document: PdfDocumentLayout) -> dict[str, str]:
    headings: dict[str, str] = {}
    for page in document.pages:
        for block in page.blocks:
            if block.x0 >= page.width * 0.35 or not is_zone_heading_block(block):
                continue
            for name in split_zone_names(block.text):
                key = zone_identity_key(name)
                if key and key not in headings:
                    headings[key] = name
    return headings


def select_authoritative_row_zones(document: PdfDocumentLayout, candidates: list[ParsedZone]) -> list[ParsedZone]:
    headings = authoritative_row_headings(document)
    if len(headings) < 10:
        return candidates
    grouped: dict[str, list[ParsedZone]] = {}
    for zone in candidates:
        key = zone_identity_key(zone.name)
        if key in headings:
            grouped.setdefault(key, []).append(zone)
    selected: list[ParsedZone] = []
    for key, official_name in headings.items():
        options = grouped.get(key, [])
        if options:
            best = max(options, key=parsed_zone_score)
            best.name = official_name
            selected.append(best)
        else:
            selected.append(ParsedZone(name=official_name, zone_type=zone_type_from_name(official_name, ""), geometry=None))
    return selected


def expected_layout_names(document: PdfDocumentLayout) -> list[str]:
    names: list[str] = []
    for page in document.pages:
        for zone in self_contained_zones(page) + row_table_zones(page) + grid_zones(page) + embedded_column_zones(page):
            if zone.name not in names:
                names.append(zone.name)
    return names


def extract_activation_text(text: str) -> str:
    match = re.search(r"DATES\s+ET\s+HEURES?\s+D['’]?ACTIVIT[EÉ]", text, re.IGNORECASE)
    if not match:
        return "Activation et horaires à vérifier dans le PDF officiel et les NOTAM."
    tail = text[match.end() :]
    end = re.search(r"\n\s*(?:INFORMATION\s+DES\s+USAGERS|GESTIONNAIRE(?:S)?|STATUT)\b", tail, re.IGNORECASE)
    section = tail[: end.start()] if end else tail[:1600]
    cleaned = clean_space(section)
    if len(cleaned) > 900:
        cleaned = cleaned[:897].rstrip() + "..."
    return cleaned or "Activation et horaires à vérifier dans le PDF officiel et les NOTAM."


def infer_activation_mode(activation_text: str, full_text: str) -> str:
    sample = f"{activation_text} {full_text[:3000]}"
    if re.search(r"\b(?:NOTAM|activable|activation\s+sur\s+demande|pr[eé]avis)\b", sample, re.IGNORECASE):
        return "notam"
    return "schedule" if re.search(r"\b(?:H24|UTC|SR|SS|\d{4}\s*[àa-]\s*\d{4})\b", activation_text, re.IGNORECASE) else "published"


def extract_frequencies(text: str) -> str | None:
    lines: list[str] = []
    for line in text.splitlines():
        cleaned = clean_space(line)
        if re.search(r"\b\d{3}[.,]\d{3}\s*MHz\b", cleaned, re.IGNORECASE):
            if cleaned not in lines:
                lines.append(cleaned)
        if len(lines) >= 5:
            break
    return " | ".join(lines) if lines else None


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return normalized[:80] or "zone"


def make_unique_feature_id(
    sup_aip: str,
    name: str,
    geometry: dict[str, Any],
    lower_limit: str,
    upper_limit: str,
    used_ids: set[str],
) -> str:
    prefix = sup_aip.replace("/", "-")
    base_feature_id = f"{prefix}-{slugify(name)}"[:96].rstrip("-")
    feature_id = base_feature_id

    if feature_id in used_ids:
        identity_payload = {
            "name": name,
            "geometry": geometry,
            "lowerLimit": lower_limit,
            "upperLimit": upper_limit,
        }
        identity_hash = hashlib.sha256(
            json.dumps(identity_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()[:12]
        suffix = f"-{identity_hash}"
        feature_id = f"{base_feature_id[:96 - len(suffix)].rstrip('-')}{suffix}"

        duplicate_index = 2
        while feature_id in used_ids:
            suffix = f"-{identity_hash}-{duplicate_index}"
            feature_id = f"{base_feature_id[:96 - len(suffix)].rstrip('-')}{suffix}"
            duplicate_index += 1

    used_ids.add(feature_id)
    return feature_id


def is_spatial_document(entry: ListingEntry, document: PdfDocumentLayout) -> bool:
    if NON_SPATIAL_TITLE_RE.search(entry.title):
        return False
    if ZONE_TITLE_RE.search(entry.title):
        return True
    normalized = document.text.upper()
    return bool(
        (ZONE_TOKEN_RE.search(normalized) or TEMPORARY_LFR_CODE_RE.search(normalized))
        and re.search(r"LIMITES\s+LAT[EÉ]RALES(?:\s+ET\s+VERTICALES)?", normalized)
    )


def parse_spatial_document(entry: ListingEntry, document: PdfDocumentLayout) -> ParseResult:
    layout_zones: list[ParsedZone] = []
    grid_count = 0
    in_fbz_section = False
    for page in document.pages:
        page_text = "\n".join(block.text for block in page.blocks)
        fbz_heading = next((block for block in page.blocks if FBZ_SECTION_RE.search(block.text)), None)
        if in_fbz_section or (fbz_heading is not None and fbz_heading.y0 < page.height * 0.30):
            in_fbz_section = True
            continue
        self_zones = self_contained_zones(page)
        grid_page_zones = grid_zones(page)
        embedded_page_zones = embedded_column_zones(page)
        clustered_page_zones = column_cluster_zones(page)
        row_zones = row_table_zones(page)
        layout_zones.extend(self_zones)
        layout_zones.extend(grid_page_zones)
        layout_zones.extend(embedded_page_zones)
        layout_zones.extend(clustered_page_zones)
        if not grid_page_zones and not embedded_page_zones:
            layout_zones.extend(row_zones)
        grid_count += len(grid_page_zones) + len(embedded_page_zones) + len(clustered_page_zones)
        if FBZ_SECTION_RE.search(page_text):
            in_fbz_section = True

    operational_text = FBZ_SECTION_RE.split(document.text, maxsplit=1)[0]
    fallback_zones = text_fallback_zones(operational_text, entry.title)
    zones = layout_zones + fallback_zones
    declared_count = declared_zone_count(entry.title)
    if declared_count == 1:
        single_fallback = single_zone_layout_fallback(document, entry.title)
        if single_fallback and single_fallback[0].geometry:
            zones = single_fallback
    elif not any(zone.geometry for zone in zones):
        zones.extend(single_zone_layout_fallback(document, entry.title))
    if grid_count == 0:
        zones = select_authoritative_row_zones(document, zones)
    zones = deduplicate_zones(zones)
    inherit_shared_geometries(zones)
    resolve_permanent_airspace_references(zones, operational_text)
    zones = deduplicate_zones(zones)
    zones, ignored_reference_names = filter_target_zones(zones, entry)
    zones = deduplicate_zones(zones)

    expected_names = [zone.name for zone in zones]
    expected_named_geometry_count = max(len(expected_names), int(declared_count or 0))
    activation_text = extract_activation_text(document.text)
    activation_mode = infer_activation_mode(activation_text, document.text)
    frequency = extract_frequencies(document.text)
    features: list[dict[str, Any]] = []
    warnings: list[str] = [f"Objet de référence ignoré: {name}." for name in ignored_reference_names]
    used_feature_ids: set[str] = set()

    for zone in sorted(zones, key=lambda item: ((item.page_index if item.page_index is not None else 10_000), item.position_y, item.name)):
        if zone.geometry is None:
            warnings.append(f"{zone.name}: limites latérales non extraites.")
            continue
        lower = zone.lower_limit if zone.vertical_extracted else ""
        upper = zone.upper_limit if zone.vertical_extracted else ""
        feature_id = make_unique_feature_id(entry.sup_aip, zone.name, zone.geometry, lower, upper, used_feature_ids)
        properties: dict[str, Any] = {
            "id": feature_id,
            "name": zone.name,
            "zoneType": zone.zone_type or zone_type_from_name(zone.name, entry.title),
            "beta": True,
            "supAip": entry.sup_aip,
            "title": entry.title,
            "validFrom": f"{entry.valid_from}T00:00:00Z",
            "validTo": f"{entry.valid_to}T23:59:59Z",
            "activationMode": activation_mode,
            "activationText": activation_text,
            "lowerLimit": lower,
            "upperLimit": upper,
            "verticalLimitsExtracted": zone.vertical_extracted,
            "verticalLimitNotice": None if zone.vertical_extracted else "Limites verticales non extraites - consulter le PDF SIA",
            "sourcePdf": entry.pdf_url,
            "sourcePage": SOURCE_URL,
            "sourcePageNumber": (zone.page_index + 1) if zone.page_index is not None else None,
            "dataScope": "auto-sia",
            "geometrySource": "automatic-layout-v3",
            "geometryConfidence": zone.confidence,
            "geometryWarnings": zone.warnings,
            "sourceFingerprint": entry.fingerprint,
            "parserVersion": PARSER_VERSION,
        }
        if frequency:
            properties["frequency"] = frequency
        features.append({"type": "Feature", "id": feature_id, "properties": properties, "geometry": zone.geometry})
        for warning in zone.warnings:
            warnings.append(f"{zone.name}: {warning}")

    missing_vertical_count = sum(1 for feature in features if not feature["properties"].get("verticalLimitsExtracted"))
    if missing_vertical_count:
        warnings.append(f"{missing_vertical_count} zone(s) cartographiée(s) sans limites verticales extraites.")
    if not features:
        warnings.append("Aucune géométrie fiable extraite du PDF.")

    return ParseResult(
        features=features,
        warnings=list(dict.fromkeys(warnings)),
        expected_named_geometry_count=expected_named_geometry_count,
        declared_zone_count=declared_count,
        missing_vertical_count=missing_vertical_count,
        ignored_reference_object_count=len(ignored_reference_names),
    )


def parse_spatial_pdf(entry: ListingEntry, pdf_text: str) -> tuple[list[dict[str, Any]], list[str]]:
    """Text-only compatibility entry point used by unit tests and small simple PDFs."""
    document = PdfDocumentLayout(pdf_text, tuple())
    zones = text_fallback_zones(pdf_text, entry.title)
    activation_text = extract_activation_text(pdf_text)
    activation_mode = infer_activation_mode(activation_text, pdf_text)
    frequency = extract_frequencies(pdf_text)
    features: list[dict[str, Any]] = []
    warnings: list[str] = []
    used_ids: set[str] = set()
    for zone in zones:
        if not zone.geometry:
            continue
        lower = zone.lower_limit if zone.vertical_extracted else ""
        upper = zone.upper_limit if zone.vertical_extracted else ""
        feature_id = make_unique_feature_id(entry.sup_aip, zone.name, zone.geometry, lower, upper, used_ids)
        properties: dict[str, Any] = {
            "id": feature_id,
            "name": zone.name,
            "zoneType": zone.zone_type,
            "beta": True,
            "supAip": entry.sup_aip,
            "title": entry.title,
            "validFrom": f"{entry.valid_from}T00:00:00Z",
            "validTo": f"{entry.valid_to}T23:59:59Z",
            "activationMode": activation_mode,
            "activationText": activation_text,
            "lowerLimit": lower,
            "upperLimit": upper,
            "verticalLimitsExtracted": zone.vertical_extracted,
            "verticalLimitNotice": None if zone.vertical_extracted else "Limites verticales non extraites - consulter le PDF SIA",
            "sourcePdf": entry.pdf_url,
            "sourcePage": SOURCE_URL,
            "dataScope": "auto-sia",
            "geometrySource": "automatic-text-v2",
            "geometryConfidence": zone.confidence,
            "geometryWarnings": zone.warnings,
            "sourceFingerprint": entry.fingerprint,
            "parserVersion": PARSER_VERSION,
        }
        if frequency:
            properties["frequency"] = frequency
        features.append({"type": "Feature", "id": feature_id, "properties": properties, "geometry": zone.geometry})
        warnings.extend(zone.warnings)
    if not features:
        warnings.append("Aucune géométrie fiable extraite du PDF.")
    return features, list(dict.fromkeys(warnings))


def load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def existing_cache(output_dir: Path) -> tuple[dict[str, list[dict[str, Any]]], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    previous_geojson = load_json(output_dir / "supaip-current.geojson", {"features": []})
    feature_groups: dict[str, list[dict[str, Any]]] = {}
    for feature in previous_geojson.get("features", []):
        sup_aip = feature.get("properties", {}).get("supAip")
        if sup_aip:
            feature_groups.setdefault(sup_aip, []).append(feature)

    previous_unmapped = load_json(output_dir / "supaip-unmapped.json", {"publications": []})
    unmapped_by_sup = {
        item.get("supAip"): item
        for item in previous_unmapped.get("publications", [])
        if isinstance(item, dict) and item.get("supAip")
    }
    previous_manifest = load_json(output_dir / "supaip-manifest.json", {"publications": []})
    manifest_by_sup = {
        item.get("supAip"): item
        for item in previous_manifest.get("publications", [])
        if isinstance(item, dict) and item.get("supAip")
    }
    return feature_groups, unmapped_by_sup, manifest_by_sup


def can_reuse_features(features: list[dict[str, Any]], entry: ListingEntry) -> bool:
    return bool(features) and all(
        feature.get("properties", {}).get("sourceFingerprint") == entry.fingerprint
        and feature.get("properties", {}).get("parserVersion") == PARSER_VERSION
        for feature in features
    )


def can_reuse_unmapped(item: dict[str, Any] | None, entry: ListingEntry) -> bool:
    return bool(item) and item.get("sourceFingerprint") == entry.fingerprint and item.get("parserVersion") == PARSER_VERSION


def can_reuse_non_spatial(item: dict[str, Any] | None, entry: ListingEntry) -> bool:
    return bool(item) and not item.get("spatial") and item.get("sourceFingerprint") == entry.fingerprint and item.get("parserVersion") == PARSER_VERSION


def same_official_publication(entry: ListingEntry, cached_manifest: dict[str, Any] | None) -> bool:
    if not cached_manifest:
        return False
    cached_title = clean_space(str(cached_manifest.get("title") or ""))
    cached_pdf = clean_space(str(cached_manifest.get("sourcePdf") or ""))
    return cached_title == clean_space(entry.title) and cached_pdf == clean_space(entry.pdf_url)


def feature_geometry_signature(feature: dict[str, Any]) -> str:
    geometry = feature.get("geometry") or {}
    return stable_payload_hash(geometry) if geometry else ""


def feature_vertical_signature(feature: dict[str, Any]) -> tuple[str, str]:
    properties = feature.get("properties", {})
    return (
        normalize_vertical_limit(str(properties.get("lowerLimit") or "")),
        normalize_vertical_limit(str(properties.get("upperLimit") or "")),
    )


def feature_match_score(cached: dict[str, Any], candidate: dict[str, Any]) -> float:
    cached_properties = cached.get("properties", {})
    candidate_properties = candidate.get("properties", {})
    cached_id = str(cached.get("id") or cached_properties.get("id") or "")
    candidate_id = str(candidate.get("id") or candidate_properties.get("id") or "")
    cached_name = str(cached_properties.get("name") or "")
    candidate_name = str(candidate_properties.get("name") or "")
    cached_key = zone_identity_key(cached_name)
    candidate_key = zone_identity_key(candidate_name)
    cached_vertical = feature_vertical_signature(cached)
    candidate_vertical = feature_vertical_signature(candidate)
    vertical_compatible = cached_vertical == candidate_vertical or not all(cached_vertical) or not all(candidate_vertical)

    if cached_id and cached_id == candidate_id:
        return 100.0
    if cached_key and cached_key == candidate_key:
        return 96.0

    cached_geometry = feature_geometry_signature(cached)
    candidate_geometry = feature_geometry_signature(candidate)
    if cached_geometry and cached_geometry == candidate_geometry:
        if cached_vertical == candidate_vertical:
            return 94.0
        if vertical_compatible and cached_properties.get("zoneType") == candidate_properties.get("zoneType"):
            return 86.0

    if cached_key and candidate_key and vertical_compatible:
        similarity = SequenceMatcher(None, cached_key, candidate_key).ratio()
        if similarity >= 0.94:
            return 90.0 + similarity
        cached_tokens = set(cached_key.split())
        candidate_tokens = set(candidate_key.split())
        overlap = len(cached_tokens & candidate_tokens) / max(1, len(cached_tokens | candidate_tokens))
        if overlap >= 0.82:
            return 84.0 + overlap
    return 0.0


def clone_cached_feature_for_regression_fallback(
    entry: ListingEntry,
    feature: dict[str, Any],
    used_ids: set[str],
    complete_regression: bool,
) -> dict[str, Any]:
    feature_copy = copy.deepcopy(feature)
    properties = feature_copy.setdefault("properties", {})
    baseline_parser_version = str(properties.get("parserVersion") or "unknown")
    name = str(properties.get("name") or "Zone SUP AIP")
    lower = str(properties.get("lowerLimit") or "")
    upper = str(properties.get("upperLimit") or "")
    feature_id = str(feature_copy.get("id") or properties.get("id") or "")
    if not feature_id or feature_id in used_ids:
        feature_id = make_unique_feature_id(entry.sup_aip, name, feature_copy.get("geometry") or {}, lower, upper, used_ids)
    else:
        used_ids.add(feature_id)
    feature_copy["id"] = feature_id
    properties["id"] = feature_id
    properties["sourceFingerprint"] = entry.fingerprint
    properties["parserVersion"] = PARSER_VERSION
    properties["geometrySource"] = "previous-parser-regression-fallback"
    properties["geometryConfidence"] = "medium"
    properties["regressionFallback"] = True
    properties["regressionFallbackKind"] = "complete" if complete_regression else "partial"
    properties["regressionBaselineParserVersion"] = baseline_parser_version
    geometry_warnings = list(properties.get("geometryWarnings") or [])
    warning = (
        "Géométrie conservée depuis la dernière base valide après une régression complète du parseur."
        if complete_regression
        else "Zone conservée depuis la dernière base valide après une régression partielle du parseur."
    )
    if warning not in geometry_warnings:
        geometry_warnings.append(warning)
    properties["geometryWarnings"] = geometry_warnings
    return feature_copy


def reconcile_cached_features_on_regression(
    entry: ListingEntry,
    parsed_features: list[dict[str, Any]],
    cached_features: list[dict[str, Any]],
    cached_manifest: dict[str, Any] | None,
) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    """Reconcile one unchanged publication against the last committed base.

    Matching uses exact identifiers, canonical names, geometry and vertical
    limits. Every operational cached feature without a credible new equivalent
    is restored. The function returns the recovered names and any unresolved
    previous names; the latter must block publication of the candidate base.
    """
    if not cached_features or not same_official_publication(entry, cached_manifest):
        return parsed_features, [], []

    operational_cached = [
        feature
        for feature in cached_features
        if is_target_zone_name(str(feature.get("properties", {}).get("name") or ""), entry.title)
    ]
    if not operational_cached:
        return parsed_features, [], []

    matched_candidate_indexes: set[int] = set()
    unmatched_cached: list[dict[str, Any]] = []
    for cached in operational_cached:
        scored = [
            (feature_match_score(cached, candidate), index)
            for index, candidate in enumerate(parsed_features)
            if index not in matched_candidate_indexes
        ]
        best_score, best_index = max(scored, default=(0.0, -1))
        if best_score >= 80.0:
            matched_candidate_indexes.add(best_index)
        else:
            unmatched_cached.append(cached)

    if not unmatched_cached:
        return parsed_features, [], []

    complete_regression = not parsed_features
    used_ids = {
        str(feature.get("id") or feature.get("properties", {}).get("id") or "")
        for feature in parsed_features
        if feature.get("id") or feature.get("properties", {}).get("id")
    }
    recovered: list[dict[str, Any]] = []
    unresolved: list[str] = []
    for cached in unmatched_cached:
        try:
            recovered.append(
                clone_cached_feature_for_regression_fallback(entry, cached, used_ids, complete_regression)
            )
        except Exception:
            unresolved.append(str(cached.get("properties", {}).get("name") or "zone sans nom"))

    recovered_names = [str(feature.get("properties", {}).get("name") or "") for feature in recovered]
    return parsed_features + recovered, recovered_names, unresolved


def preserve_cached_features_on_complete_regression(
    entry: ListingEntry,
    parsed_features: list[dict[str, Any]],
    cached_features: list[dict[str, Any]],
    cached_manifest: dict[str, Any] | None,
) -> tuple[list[dict[str, Any]], bool]:
    if parsed_features:
        return parsed_features, False
    reconciled, recovered_names, _ = reconcile_cached_features_on_regression(
        entry, parsed_features, cached_features, cached_manifest
    )
    return reconciled, bool(recovered_names)


def preserve_cached_features_on_partial_regression(
    entry: ListingEntry,
    parsed_features: list[dict[str, Any]],
    cached_features: list[dict[str, Any]],
    cached_manifest: dict[str, Any] | None,
) -> tuple[list[dict[str, Any]], int]:
    if not parsed_features:
        return parsed_features, 0
    reconciled, recovered_names, _ = reconcile_cached_features_on_regression(
        entry, parsed_features, cached_features, cached_manifest
    )
    return reconciled, len(recovered_names)

def load_manual_overrides(path: Path) -> dict[str, list[dict[str, Any]]]:
    data = load_json(path, {"features": []})
    groups: dict[str, list[dict[str, Any]]] = {}
    for feature in data.get("features", []):
        properties = feature.setdefault("properties", {})
        sup_aip = properties.get("supAip")
        if not sup_aip:
            continue
        properties.setdefault("geometrySource", "manual-override")
        properties.setdefault("geometryConfidence", "high")
        properties.setdefault("verticalLimitsExtracted", bool(properties.get("lowerLimit") and properties.get("upperLimit")))
        properties.setdefault("dataScope", "manual-override")
        properties.setdefault("beta", True)
        groups.setdefault(sup_aip, []).append(feature)
    return groups


def validate_feature_collection(collection: dict[str, Any], previous_count: int) -> None:
    features = collection.get("features")
    if not isinstance(features, list) or not features:
        raise RuntimeError("Protection activée: la base candidate ne contient aucune zone.")
    if previous_count >= 20 and len(features) < max(5, int(previous_count * 0.35)):
        raise RuntimeError(
            f"Protection activée: chute anormale de {previous_count} à {len(features)} zones. L'ancienne base est conservée."
        )

    ids: set[str] = set()
    for feature in features:
        feature_id = feature.get("id") or feature.get("properties", {}).get("id")
        if not feature_id or feature_id in ids:
            raise RuntimeError(f"Identifiant SUP AIP absent ou dupliqué: {feature_id!r}")
        ids.add(feature_id)
        geometry = feature.get("geometry", {})
        if geometry.get("type") not in ("Polygon", "MultiPolygon"):
            raise RuntimeError(f"Géométrie non supportée pour {feature_id}")
        raw = json.dumps(geometry)
        if "NaN" in raw or "Infinity" in raw:
            raise RuntimeError(f"Coordonnée invalide pour {feature_id}")
        properties = feature.get("properties", {})
        if properties.get("verticalLimitsExtracted") and (not properties.get("lowerLimit") or not properties.get("upperLimit")):
            raise RuntimeError(f"Limites verticales incohérentes pour {feature_id}")


def write_json_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def stable_payload_hash(payload: Any) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def is_critical_parse_warning(value: str) -> bool:
    return bool(
        re.search(
            r"(?:limites? lat[eé]rales? non extraites?|sans limites verticales|"
            r"limite d[eé]pendant|arc d[eé]tect[eé]|polygone incomplet|moins de trois coordonn[eé]es|rayon circulaire hors)",
            value,
            re.IGNORECASE,
        )
    )


def is_conservative_parse_warning(value: str) -> bool:
    return bool(re.search(r"exclusion interne non d[eé]coup[eé]e", value, re.IGNORECASE))


INCOMPLETE_CAUSE_LABELS = {
    "zone-block-not-detected": "Blocs de zones non reconnus",
    "lateral-boundary-not-extracted": "Limites latérales non extraites",
    "internal-exclusion-not-cut": "Exclusions internes non découpées",
    "named-geometry-missing": "Géométries nommées manquantes",
    "vertical-limit-not-extracted": "Limites verticales non extraites",
    "safety-fallback": "Repli de sécurité depuis une ancienne géométrie",
    "other": "Autre format à contrôler",
}


def classify_incomplete_causes(
    parsed_features: list[dict[str, Any]],
    warnings: list[str],
    expected_named_count: int,
    missing_vertical_count: int,
    used_safety_fallback: bool,
) -> list[str]:
    causes: list[str] = []
    warning_text = " ".join(warnings)
    if not parsed_features and expected_named_count == 0:
        causes.append("zone-block-not-detected")
    if re.search(r"limites? lat[eé]rales? non extraites?", warning_text, re.IGNORECASE):
        causes.append("lateral-boundary-not-extracted")
    if re.search(r"exclusion interne non d[eé]coup[eé]e", warning_text, re.IGNORECASE):
        causes.append("internal-exclusion-not-cut")
    if expected_named_count > len(parsed_features):
        causes.append("named-geometry-missing")
    if missing_vertical_count > 0:
        causes.append("vertical-limit-not-extracted")
    if used_safety_fallback:
        causes.append("safety-fallback")
    return causes or ["other"]


def build_dataset(output_dir: Path, override_path: Path, polite_delay: float = 0.12) -> dict[str, Any]:
    session = make_session()
    listing_html = fetch_bytes(session, SOURCE_URL).decode("utf-8", errors="replace")
    entries, source_updated_at = parse_listing(listing_html)
    if len(entries) < 10:
        raise RuntimeError(f"Liste SIA anormalement courte: {len(entries)} publication(s).")

    previous_features, previous_unmapped, previous_manifest = existing_cache(output_dir)
    overrides = load_manual_overrides(override_path)
    previous_count = sum(len(items) for items in previous_features.values())
    previous_status = load_json(output_dir / "supaip-status.json", {})
    override_revision = stable_payload_hash(overrides)
    required_outputs = (
        output_dir / "supaip-current.geojson",
        output_dir / "supaip-status.json",
        output_dir / "supaip-unmapped.json",
        output_dir / "supaip-manifest.json",
    )
    manifest_is_current = len(previous_manifest) == len(entries) and all(
        (previous_manifest.get(entry.sup_aip) or {}).get("sourceFingerprint") == entry.fingerprint
        and (previous_manifest.get(entry.sup_aip) or {}).get("parserVersion") == PARSER_VERSION
        for entry in entries
    )
    if (
        previous_status.get("parserVersion") == PARSER_VERSION
        and previous_status.get("overrideRevision") == override_revision
        and manifest_is_current
        and all(path.exists() for path in required_outputs)
    ):
        return previous_status

    all_features: list[dict[str, Any]] = []
    unmapped: list[dict[str, Any]] = []
    manifest: list[dict[str, Any]] = []
    mapped_publications = 0
    fully_mapped_publications = 0
    conservatively_mapped_publications = 0
    fallback_mapped_publications = 0
    reused_publications = 0
    downloaded_publications = 0
    non_spatial_publications = 0
    zonal_publications = 0
    declared_zone_total = 0
    expected_named_total = 0
    missing_vertical_total = 0
    download_failures: list[str] = []
    safety_fallback_features = 0
    safety_fallback_details: list[dict[str, Any]] = []
    ignored_reference_object_total = 0
    regression_recovered_details: list[dict[str, Any]] = []
    unresolved_regressions: list[dict[str, Any]] = []

    for entry in entries:
        cached_features = previous_features.get(entry.sup_aip, [])
        cached_unmapped = previous_unmapped.get(entry.sup_aip)
        cached_manifest = previous_manifest.get(entry.sup_aip)
        parsed_features: list[dict[str, Any]] = []
        warnings: list[str] = []
        expected_named_count = 0
        declared_count: int | None = None
        missing_vertical_count = 0
        previous_partial = False
        spatial = False
        used_safety_fallback = False
        partial_fallback_count = 0
        regression_recovered_names: list[str] = []
        ignored_reference_object_count = 0

        if can_reuse_features(cached_features, entry):
            parsed_features = cached_features
            spatial = True
            reused_publications += 1
            expected_named_count = int((cached_manifest or {}).get("expectedNamedGeometryCount") or len(parsed_features))
            declared_count = (cached_manifest or {}).get("declaredZoneCount")
            missing_vertical_count = sum(1 for feature in parsed_features if not feature.get("properties", {}).get("verticalLimitsExtracted", True))
            previous_partial = bool((cached_manifest or {}).get("partial"))
            ignored_reference_object_count = int((cached_manifest or {}).get("ignoredReferenceObjectCount") or 0)
        elif can_reuse_unmapped(cached_unmapped, entry):
            spatial = True
            reused_publications += 1
            warnings = [cached_unmapped.get("reason", "Aucune géométrie fiable extraite.")]
            expected_named_count = int(cached_unmapped.get("expectedNamedGeometryCount") or 0)
            declared_count = cached_unmapped.get("declaredZoneCount")
            previous_partial = bool(cached_unmapped.get("partial"))
            ignored_reference_object_count = int(cached_unmapped.get("ignoredReferenceObjectCount") or 0)
        elif can_reuse_non_spatial(cached_manifest, entry):
            reused_publications += 1
            non_spatial_publications += 1
            manifest.append(cached_manifest)
            continue
        else:
            try:
                pdf_bytes = fetch_bytes(session, entry.pdf_url, timeout=90)
                downloaded_publications += 1
                document = extract_pdf_document(pdf_bytes)
                spatial = is_spatial_document(entry, document)
                if spatial:
                    result = parse_spatial_document(entry, document)
                    parsed_features = result.features
                    warnings = result.warnings
                    expected_named_count = result.expected_named_geometry_count
                    declared_count = result.declared_zone_count
                    missing_vertical_count = result.missing_vertical_count
                    ignored_reference_object_count = result.ignored_reference_object_count
                else:
                    non_spatial_publications += 1
            except Exception as error:
                download_failures.append(f"{entry.sup_aip}: {type(error).__name__}: {error}")
            time.sleep(polite_delay)

        if download_failures:
            continue

        cached_operational_before_classification = sum(
            1
            for feature in cached_features
            if is_target_zone_name(str(feature.get("properties", {}).get("name") or ""), entry.title)
        )
        if not spatial and cached_operational_before_classification:
            if same_official_publication(entry, cached_manifest):
                spatial = True
                warnings.append(
                    "Régression de classification détectée: publication spatiale précédente conservée par sécurité."
                )
            else:
                unresolved_regressions.append({
                    "supAip": entry.sup_aip,
                    "reason": "Une publication précédemment spatiale est devenue non spatiale après changement de source.",
                    "previousFeatureCount": cached_operational_before_classification,
                    "candidateFeatureCount": 0,
                    "sourceChanged": True,
                })

        if spatial:
            candidate_count_before_regression = len(parsed_features)
            previous_operational_count = sum(
                1
                for feature in cached_features
                if is_target_zone_name(str(feature.get("properties", {}).get("name") or ""), entry.title)
            )
            parsed_features, regression_recovered_names, unresolved_names = reconcile_cached_features_on_regression(
                entry, parsed_features, cached_features, cached_manifest
            )
            partial_fallback_count = len(regression_recovered_names)
            used_safety_fallback = bool(regression_recovered_names)
            if regression_recovered_names:
                warnings.append(
                    f"Régression du parseur détectée: {len(regression_recovered_names)} ancienne(s) zone(s) conservée(s) par sécurité."
                )
                expected_named_count = max(
                    expected_named_count,
                    int((cached_manifest or {}).get("expectedNamedGeometryCount") or previous_operational_count),
                    previous_operational_count,
                )
                missing_vertical_count = sum(
                    1
                    for feature in parsed_features
                    if not feature.get("properties", {}).get("verticalLimitsExtracted", False)
                )
                regression_recovered_details.append({
                    "supAip": entry.sup_aip,
                    "candidateFeatureCount": candidate_count_before_regression,
                    "previousFeatureCount": previous_operational_count,
                    "recoveredFeatureCount": len(regression_recovered_names),
                    "recoveredFeatureNames": regression_recovered_names,
                })
            if unresolved_names:
                unresolved_regressions.append({
                    "supAip": entry.sup_aip,
                    "reason": "Impossible de restaurer toutes les anciennes géométries opérationnelles.",
                    "featureNames": unresolved_names,
                })

        if not spatial:
            manifest.append({
                "supAip": entry.sup_aip,
                "title": entry.title,
                "spatial": False,
                "sourcePdf": entry.pdf_url,
                "sourceFingerprint": entry.fingerprint,
                "parserVersion": PARSER_VERSION,
            })
            continue

        zonal_publications += 1

        generated_ids = {feature.get("id") for feature in parsed_features}
        for override in overrides.get(entry.sup_aip, []):
            if override.get("id") not in generated_ids:
                override_copy = json.loads(json.dumps(override))
                props = override_copy.setdefault("properties", {})
                props["sourceFingerprint"] = entry.fingerprint
                props["parserVersion"] = PARSER_VERSION
                props["validFrom"] = f"{entry.valid_from}T00:00:00Z"
                props["validTo"] = f"{entry.valid_to}T23:59:59Z"
                lower = clean_space(str(props.get("lowerLimit") or ""))
                upper = clean_space(str(props.get("upperLimit") or ""))
                vertical_ok = bool(lower and upper and lower.lower() != "à vérifier" and upper.lower() != "à vérifier")
                props["verticalLimitsExtracted"] = vertical_ok
                props["verticalLimitNotice"] = None if vertical_ok else "Limites verticales non extraites - consulter le PDF SIA"
                props.setdefault("geometryWarnings", [])
                parsed_features.append(override_copy)

        previous_operational_count = sum(
            1
            for feature in cached_features
            if is_target_zone_name(str(feature.get("properties", {}).get("name") or ""), entry.title)
        )
        if previous_operational_count and len(parsed_features) < previous_operational_count:
            unresolved_regressions.append({
                "supAip": entry.sup_aip,
                "reason": "Chute publication par publication non compensée avant publication.",
                "previousFeatureCount": previous_operational_count,
                "candidateFeatureCount": len(parsed_features),
                "sourceChanged": not same_official_publication(entry, cached_manifest),
            })

        expected_named_count = max(
            expected_named_count,
            len(parsed_features),
            int((cached_manifest or {}).get("expectedNamedGeometryCount") or 0)
            if same_official_publication(entry, cached_manifest)
            else 0,
        )
        missing_vertical_count = sum(
            1 for feature in parsed_features if not feature.get("properties", {}).get("verticalLimitsExtracted", False)
        )
        declared_zone_total += int(declared_count or 0)
        expected_named_total += expected_named_count
        missing_vertical_total += missing_vertical_count
        ignored_reference_object_total += ignored_reference_object_count

        fallback_names = [
            str(feature.get("properties", {}).get("name") or "")
            for feature in parsed_features
            if feature.get("properties", {}).get("regressionFallback")
            or "safety-fallback" in str(feature.get("properties", {}).get("geometrySource") or "")
            or "regression-fallback" in str(feature.get("properties", {}).get("geometrySource") or "")
        ]
        used_safety_fallback = used_safety_fallback or bool(fallback_names)
        previous_partial = previous_partial or bool(fallback_names)

        critical_warnings = [warning for warning in warnings if is_critical_parse_warning(warning)]
        conservative_warnings = [warning for warning in warnings if is_conservative_parse_warning(warning)]
        geometry_missing = expected_named_count > 0 and len(parsed_features) < expected_named_count
        partial = bool(critical_warnings) or geometry_missing or missing_vertical_count > 0
        fallback = bool(parsed_features) and not partial and used_safety_fallback
        conservative = bool(parsed_features) and not partial and not fallback and bool(conservative_warnings)
        publication_state = (
            "unmapped" if not parsed_features
            else "partial" if partial
            else "fallback" if fallback
            else "conservative" if conservative
            else "complete"
        )

        if fallback_names:
            safety_fallback_features += len(fallback_names)
            safety_fallback_details.append({
                "supAip": entry.sup_aip,
                "featureCount": len(fallback_names),
                "featureNames": fallback_names,
            })

        if parsed_features:
            mapped_publications += 1
            if publication_state == "complete":
                fully_mapped_publications += 1
            elif publication_state == "conservative":
                conservatively_mapped_publications += 1
            elif publication_state == "fallback":
                fallback_mapped_publications += 1
            all_features.extend(parsed_features)
        reason_parts = list(critical_warnings)
        if conservative_warnings:
            reason_parts.extend(conservative_warnings)
        if geometry_missing:
            reason_parts.append(f"{len(parsed_features)}/{expected_named_count} géométries nommées extraites.")
        if missing_vertical_count:
            reason_parts.append(f"{missing_vertical_count} zone(s) sans limites verticales extraites.")
        if fallback_names:
            reason_parts.append(
                f"{len(fallback_names)} zone(s) conservée(s) depuis la dernière base valide par la protection anti-régression."
            )
        if not parsed_features:
            reason_parts.append("Aucune géométrie fiable extraite.")
        if publication_state != "complete":
            cause_codes = classify_incomplete_causes(
                parsed_features, warnings, expected_named_count, missing_vertical_count, used_safety_fallback
            )
            unmapped.append({
                "supAip": entry.sup_aip,
                "title": entry.title,
                "validFrom": entry.valid_from,
                "validTo": entry.valid_to,
                "sourcePdf": entry.pdf_url,
                "reason": " ".join(dict.fromkeys(reason_parts)),
                "status": publication_state,
                "partial": publication_state == "partial",
                "conservative": publication_state == "conservative",
                "fallback": publication_state == "fallback",
                "expectedNamedGeometryCount": expected_named_count,
                "mappedGeometryCount": len(parsed_features),
                "declaredZoneCount": declared_count,
                "missingVerticalCount": missing_vertical_count,
                "safetyFallbackFeatureCount": len(fallback_names),
                "safetyFallbackFeatureNames": fallback_names,
                "ignoredReferenceObjectCount": ignored_reference_object_count,
                "causeCodes": cause_codes,
                "causeLabels": [INCOMPLETE_CAUSE_LABELS[code] for code in cause_codes],
                "sourceFingerprint": entry.fingerprint,
                "parserVersion": PARSER_VERSION,
            })

        manifest.append({
            "supAip": entry.sup_aip,
            "title": entry.title,
            "spatial": True,
            "mappedGeometryCount": len(parsed_features),
            "expectedNamedGeometryCount": expected_named_count,
            "declaredZoneCount": declared_count,
            "missingVerticalCount": missing_vertical_count,
            "status": publication_state,
            "partial": publication_state == "partial",
            "conservative": publication_state == "conservative",
            "fallback": publication_state == "fallback",
            "safetyFallbackFeatureCount": len(fallback_names),
            "safetyFallbackFeatureNames": fallback_names,
            "ignoredReferenceObjectCount": ignored_reference_object_count,
            "sourcePdf": entry.pdf_url,
            "sourceFingerprint": entry.fingerprint,
            "parserVersion": PARSER_VERSION,
        })

    if download_failures:
        raise RuntimeError("Protection activée: tous les PDF SIA n'ont pas été récupérés. " + " | ".join(download_failures[:10]))
    if downloaded_publications + reused_publications != len(entries):
        raise RuntimeError(
            f"Protection activée: {downloaded_publications + reused_publications}/{len(entries)} publications seulement ont été traitées."
        )
    if unresolved_regressions:
        details = " | ".join(
            f"{item.get('supAip')}: {item.get('reason')}"
            for item in unresolved_regressions[:12]
        )
        raise RuntimeError(
            "Protection anti-régression activée: la base candidate ne sera ni écrite ni publiée. " + details
        )

    all_features.sort(
        key=lambda feature: (feature.get("properties", {}).get("supAip", ""), feature.get("properties", {}).get("name", "")),
        reverse=True,
    )
    missing_vertical_total = sum(
        1 for feature in all_features if not feature.get("properties", {}).get("verticalLimitsExtracted", False)
    )
    collection_base = {
        "type": "FeatureCollection",
        "name": "CAP CLAIR SUP AIP AUTO BETA - Parser V3.2",
        "source": "SIA France - liste et PDF officiels SUP AIP Métropole",
        "sourceUrl": SOURCE_URL,
        "coverage": "Analyse de toutes les publications listées. Les espaces permanents cités comme références sont séparés des zones SUP AIP et les contours prudents sont distingués des zones réellement manquantes.",
        "parserVersion": PARSER_VERSION,
        "features": all_features,
    }
    validate_feature_collection(collection_base, previous_count)

    complete_unmapped_count = sum(1 for item in unmapped if item.get("status") == "unmapped")
    partial_count = sum(1 for item in unmapped if item.get("status") == "partial")
    conservative_count = sum(1 for item in unmapped if item.get("status") == "conservative")
    fallback_count = sum(1 for item in unmapped if item.get("status") == "fallback")
    cause_counts = {code: 0 for code in INCOMPLETE_CAUSE_LABELS}
    for item in unmapped:
        for code in item.get("causeCodes", []):
            cause_counts[code] = cause_counts.get(code, 0) + 1

    sorted_unmapped = sorted(unmapped, key=lambda item: item.get("supAip", ""), reverse=True)
    sorted_manifest = sorted(manifest, key=lambda item: item.get("supAip", ""), reverse=True)
    dataset_revision = stable_payload_hash({
        "sourceUpdatedAt": source_updated_at,
        "overrideRevision": override_revision,
        "collection": collection_base,
        "unmapped": sorted_unmapped,
        "manifest": sorted_manifest,
    })
    if previous_status.get("datasetRevision") == dataset_revision and all(path.exists() for path in required_outputs):
        return previous_status

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    collection = {**collection_base, "generatedAt": generated_at, "datasetRevision": dataset_revision}
    status = {
        "schemaVersion": 2,
        "mode": "automatic",
        "beta": True,
        "generatedAt": generated_at,
        "sourceUpdatedAt": source_updated_at,
        "sourceUrl": SOURCE_URL,
        "parserVersion": PARSER_VERSION,
        "datasetRevision": dataset_revision,
        "overrideRevision": override_revision,
        "listingPublicationCount": len(entries),
        "processedPublicationCount": downloaded_publications + reused_publications,
        "nonSpatialPublicationCount": non_spatial_publications,
        "zonalPublicationCount": zonal_publications,
        "mappedPublicationCount": mapped_publications,
        "fullyMappedPublicationCount": fully_mapped_publications,
        "conservativelyMappedPublicationCount": conservatively_mapped_publications,
        "fallbackMappedPublicationCount": fallback_mapped_publications,
        "featureCount": len(all_features),
        "expectedNamedGeometryCount": expected_named_total,
        "declaredZoneCount": declared_zone_total,
        "verticalCompleteFeatureCount": len(all_features) - missing_vertical_total,
        "missingVerticalFeatureCount": missing_vertical_total,
        "unmappedPublicationCount": len(unmapped),
        "reviewPublicationCount": len(unmapped),
        "completeUnmappedPublicationCount": complete_unmapped_count,
        "partialPublicationCount": partial_count,
        "conservativePublicationCount": conservative_count,
        "fallbackPublicationCount": fallback_count,
        "reusedPublicationCount": reused_publications,
        "downloadedPublicationCount": downloaded_publications,
        "safetyFallbackPublicationCount": len(safety_fallback_details),
        "safetyFallbackFeatureCount": safety_fallback_features,
        "safetyFallbackDetails": safety_fallback_details,
        "regressionRecoveredPublicationCount": len(regression_recovered_details),
        "regressionRecoveredFeatureCount": sum(item.get("recoveredFeatureCount", 0) for item in regression_recovered_details),
        "regressionRecoveredDetails": regression_recovered_details,
        "unresolvedRegressionCount": 0,
        "ignoredReferenceObjectCount": ignored_reference_object_total,
        "incompleteCausePublicationCounts": cause_counts,
        "incompleteCauseLabels": INCOMPLETE_CAUSE_LABELS,
        "staleAfterHours": 36,
        "message": "Parser V3.2: chaque publication est comparée à la dernière base valide. Toute chute non restaurée bloque le workflow avant écriture; les ZRT portant un code LF-R restent reconnues comme zones temporaires. Vérifier le PDF, SOFIA et les NOTAM avant le vol.",
    }
    unmapped_payload = {
        "schemaVersion": 2,
        "generatedAt": generated_at,
        "datasetRevision": dataset_revision,
        "sourceUrl": SOURCE_URL,
        "parserVersion": PARSER_VERSION,
        "publications": sorted_unmapped,
    }
    manifest_payload = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "datasetRevision": dataset_revision,
        "sourceUrl": SOURCE_URL,
        "parserVersion": PARSER_VERSION,
        "publications": sorted_manifest,
    }

    write_json_atomic(output_dir / "supaip-current.geojson", collection)
    write_json_atomic(output_dir / "supaip-status.json", status)
    write_json_atomic(output_dir / "supaip-unmapped.json", unmapped_payload)
    write_json_atomic(output_dir / "supaip-manifest.json", manifest_payload)
    return status


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=Path("public/data"))
    parser.add_argument("--overrides", type=Path, default=Path("tools/supaip/overrides.geojson"))
    parser.add_argument("--polite-delay", type=float, default=0.12)
    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        status = build_dataset(args.output_dir, args.overrides, args.polite_delay)
    except Exception as error:
        print(f"SUP AIP update failed: {error}", file=sys.stderr)
        return 1

    print(json.dumps(status, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
