#!/usr/bin/env python3
"""Build CAP CLAIR's SUP AIP overlay from the official French SIA listing.

The parser is deliberately conservative: it publishes only geometries that can be
reconstructed with sufficient confidence from coordinates contained in the PDF.
Publications that look spatial but cannot be parsed are written to
``supaip-unmapped.json`` instead of being silently ignored.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
import time
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urljoin

import fitz  # PyMuPDF
import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

SOURCE_URL = "https://www.sia.aviation-civile.gouv.fr/documents/supaip/aip/id/6"
PARSER_VERSION = "capclair-supaip-parser-1.0.0"
USER_AGENT = "CAP-CLAIR-SUPAIP-BETA/1.0 (+automatic SIA public-document reader)"
ZONE_TITLE_RE = re.compile(
    r"\b(?:ZRT|ZDT|ZIT|TRA|TSA|zone(?:s)?\s+(?:r[eé]glement[eé]e|dangereuse|interdite|r[eé]serv[eé]e)(?:s)?\s+temporaire(?:s)?|CTR\s+temporaire|TMA\s+temporaire)\b",
    re.IGNORECASE,
)
ZONE_TOKEN_RE = re.compile(r"\b(ZRT|ZDT|ZIT|TRA|TSA|CTR|TMA|RMZ|TMZ|FBZ)\b", re.IGNORECASE)
COMPLEX_BOUNDARY_RE = re.compile(
    r"\b(?:arc\s+de\s+cercle|portion\s+de\s+cercle|fronti[eè]re|ligne\s+de\s+c[oô]te|rivage|limite\s+maritime|thalweg)\b",
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
VERTICAL_RE = re.compile(
    r"(?im)^\s*(?P<lower>(?:SFC|GND|FL\s*\d{2,3}|\d{2,5}\s*(?:FT|M)\s*(?:AMSL|ASFC|AGL|QNH)?))"
    r"\s*[/\-]\s*"
    r"(?P<upper>(?:UNL|FL\s*\d{2,3}|\d{2,5}\s*(?:FT|M)\s*(?:AMSL|ASFC|AGL|QNH)?))\s*$"
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


@dataclass
class CoordinateMatch:
    lon: float
    lat: float
    start: int
    end: int


@dataclass
class ParsedGeometry:
    name: str
    zone_type: str
    geometry: dict[str, Any]
    lower_limit: str
    upper_limit: str
    confidence: str


def clean_space(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("\u200b", " ").replace("\xad", "")
    return re.sub(r"\s+", " ", value).strip()


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


def fetch_bytes(session: requests.Session, url: str, timeout: int = 45) -> bytes:
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
        anchor_text = clean_space(anchor.get_text(" ", strip=True))
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
            container_text = clean_space(container.get_text(" ", strip=True))
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
        if not title:
            title = anchor_text
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

    page_text = clean_space(soup.get_text(" ", strip=True))
    source_updated_at = None
    update_match = UPDATE_DATE_RE.search(page_text)
    if update_match:
        day, month, year = update_match.group(1).split("/")
        source_updated_at = f"{year}-{month}-{day}T00:00:00Z"

    return sorted(entries_by_number.values(), key=lambda item: item.sup_aip, reverse=True), source_updated_at


def extract_pdf_text(pdf_bytes: bytes) -> str:
    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages: list[str] = []
    try:
        for page_index, page in enumerate(document):
            page_text = page.get_text("text", sort=True)
            pages.append(f"\n--- PAGE {page_index + 1} ---\n{page_text}")
    finally:
        document.close()
    return normalize_text("\n".join(pages))


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


def circle_polygon(center_lon: float, center_lat: float, radius_nm: float, steps: int = 96) -> dict[str, Any]:
    earth_radius_nm = 3440.065
    angular = radius_nm / earth_radius_nm
    lat1 = math.radians(center_lat)
    lon1 = math.radians(center_lon)
    coordinates: list[list[float]] = []
    for index in range(steps + 1):
        bearing = 2.0 * math.pi * index / steps
        lat2 = math.asin(math.sin(lat1) * math.cos(angular) + math.cos(lat1) * math.sin(angular) * math.cos(bearing))
        lon2 = lon1 + math.atan2(
            math.sin(bearing) * math.sin(angular) * math.cos(lat1),
            math.cos(angular) - math.sin(lat1) * math.sin(lat2),
        )
        coordinates.append([round(math.degrees(lon2), 7), round(math.degrees(lat2), 7)])
    return {"type": "Polygon", "coordinates": [coordinates]}


def limits_section(text: str) -> str:
    match = re.search(r"LIMITES\s+LAT[EÉ]RALES(?:\s+ET\s+VERTICALES)?", text, re.IGNORECASE)
    if not match:
        return text
    section = text[match.end() :]
    end = re.search(r"\n\s*(?:ORGANISME(?:S)?\s+[ÀA]\s+CONTACTER|CONTACTS?|REMARQUES?)\b", section, re.IGNORECASE)
    return section[: end.start()] if end else section


def is_zone_heading(line: str) -> bool:
    stripped = clean_space(line).strip(" :")
    if not stripped or len(stripped) > 120:
        return False
    if stripped.upper().startswith(("LIMITES ", "DATES ", "INFORMATION ", "CONDITIONS ", "STATUT ", "SERVICES ")):
        return False
    if len(stripped.split()) > 15:
        return False
    if re.search(r"\b(?:ZONE|ZONES)\s+(?:R[EÉ]GLEMENT[EÉ]ES?|DANGEREUSES?|INTERDITES?)\s+TEMPORAIRES?\b", stripped, re.IGNORECASE):
        return False
    return bool(re.match(r"^(?:ZRT|ZDT|ZIT|TRA|TSA|CTR(?:\s+TEMPORAIRE)?|TMA(?:\s+TEMPORAIRE)?|RMZ|TMZ|FBZ)\b", stripped, re.IGNORECASE))


def extract_zone_names(text: str, title: str) -> list[str]:
    section = limits_section(text)
    names: list[str] = []
    for line in section.splitlines():
        line = clean_space(line)
        if is_zone_heading(line):
            line = re.sub(r"\s+", " ", line).strip(" :")
            if line not in names:
                names.append(line)

    if not names:
        before_activity = re.split(r"\bACTIVIT[EÉ]\b", text, maxsplit=1, flags=re.IGNORECASE)[0]
        for line in before_activity.splitlines():
            line = clean_space(line)
            if is_zone_heading(line) and line not in names:
                names.append(line)

    if not names:
        token = ZONE_TOKEN_RE.search(title)
        if token:
            names.append(f"{token.group(1).upper()} {title}"[:110])
    return names


def zone_type_from_name(name: str, title: str) -> str:
    match = ZONE_TOKEN_RE.search(name) or ZONE_TOKEN_RE.search(title)
    return match.group(1).upper() if match else "Zone temporaire"


def extract_vertical_limits(section: str) -> list[tuple[str, str]]:
    values: list[tuple[str, str]] = []
    for match in VERTICAL_RE.finditer(section):
        lower = clean_space(match.group("lower")).upper().replace("FT", "ft")
        upper = clean_space(match.group("upper")).upper().replace("FT", "ft")
        pair = (lower, upper)
        if pair not in values:
            values.append(pair)
    return values


def extract_circle_geometries(section: str) -> tuple[list[dict[str, Any]], set[int]]:
    coordinates = coordinate_matches(section)
    geometries: list[dict[str, Any]] = []
    consumed_indices: set[int] = set()
    for radius_match in re.finditer(
        r"(?:cercle|circonf[eé]rence)\s+de\s+(?P<radius>\d+(?:[.,]\d+)?)\s*(?P<unit>NM|N M|KM|M)\s+de\s+rayon",
        section,
        re.IGNORECASE,
    ):
        window_end = min(len(section), radius_match.end() + 320)
        center_index = next((index for index, coord in enumerate(coordinates) if coord.start >= radius_match.start() and coord.end <= window_end), None)
        if center_index is None:
            continue
        center = coordinates[center_index]
        radius = float(radius_match.group("radius").replace(",", "."))
        unit = radius_match.group("unit").replace(" ", "").upper()
        if unit == "KM":
            radius /= 1.852
        elif unit == "M":
            radius /= 1852.0
        if not (0.02 <= radius <= 250):
            continue
        geometries.append(circle_polygon(center.lon, center.lat, radius))
        consumed_indices.add(center_index)
    return geometries, consumed_indices


def split_polygon_coordinates(section: str, consumed_indices: set[int]) -> list[list[tuple[float, float]]]:
    coordinates = coordinate_matches(section)
    remaining = [(index, coord) for index, coord in enumerate(coordinates) if index not in consumed_indices]
    if not remaining:
        return []

    polygons: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    last_end: int | None = None

    for _, coord in remaining:
        point = (coord.lon, coord.lat)
        gap = coord.start - last_end if last_end is not None else 0
        if current and gap > 420 and len(current) >= 3:
            polygons.append(current)
            current = []
        current.append(point)
        last_end = coord.end
        if len(current) >= 4 and point_equal(current[0], current[-1]):
            polygons.append(current)
            current = []
            last_end = None

    if len(current) >= 3:
        polygons.append(current)
    return polygons


def extract_activation_text(text: str) -> str:
    match = re.search(r"DATES\s+ET\s+HEURES?\s+D['’]?ACTIVIT[EÉ]", text, re.IGNORECASE)
    if not match:
        return "Activation et horaires à vérifier dans le PDF officiel et les NOTAM."
    tail = text[match.end() :]
    end = re.search(r"\n\s*(?:INFORMATION\s+DES\s+USAGERS|GESTIONNAIRE(?:S)?|STATUT)\b", tail, re.IGNORECASE)
    section = tail[: end.start()] if end else tail[:1200]
    cleaned = clean_space(section)
    if len(cleaned) > 700:
        cleaned = cleaned[:697].rstrip() + "..."
    return cleaned or "Activation et horaires à vérifier dans le PDF officiel et les NOTAM."


def infer_activation_mode(activation_text: str, full_text: str) -> str:
    sample = f"{activation_text} {full_text[:2500]}"
    if re.search(r"\b(?:NOTAM|activable|activation\s+sur\s+demande|pr[eé]avis)\b", sample, re.IGNORECASE):
        return "notam"
    return "schedule" if re.search(r"\b(?:H24|UTC|SR|SS|\d{4}\s*[àa-]\s*\d{4})\b", activation_text, re.IGNORECASE) else "published"


def extract_frequencies(text: str) -> str | None:
    lines: list[str] = []
    for line in text.splitlines():
        cleaned = clean_space(line)
        if re.search(r"\b\d{3}[.,]\d{3}\s*MHz\b", cleaned, re.IGNORECASE):
            cleaned = re.sub(r"\s+", " ", cleaned)
            if cleaned not in lines:
                lines.append(cleaned)
        if len(lines) >= 4:
            break
    return " | ".join(lines) if lines else None


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return normalized[:80] or "zone"


def parse_spatial_pdf(entry: ListingEntry, pdf_text: str) -> tuple[list[dict[str, Any]], list[str]]:
    warnings: list[str] = []
    section = limits_section(pdf_text)
    names = extract_zone_names(pdf_text, entry.title)
    verticals = extract_vertical_limits(section)
    circle_geometries, consumed = extract_circle_geometries(section)
    polygon_points = split_polygon_coordinates(section, consumed)
    complex_boundary = bool(COMPLEX_BOUNDARY_RE.search(section))

    geometries: list[tuple[dict[str, Any], str]] = [(geometry, "high") for geometry in circle_geometries]
    if complex_boundary and polygon_points:
        warnings.append("Limite complexe (arc, frontière ou côte) non reconstruite automatiquement.")
    else:
        for points in polygon_points:
            ring = close_ring(points)
            if len(ring) >= 4:
                was_closed = point_equal(points[0], points[-1])
                geometries.append(({"type": "Polygon", "coordinates": [ring]}, "high" if was_closed else "medium"))

    if not geometries:
        warnings.append("Aucune géométrie fiable extraite du PDF.")
        return [], warnings

    if len(names) < len(geometries):
        base = names[0] if names else zone_type_from_name(entry.title, entry.title)
        for index in range(len(names), len(geometries)):
            names.append(f"{base} {index + 1}" if len(geometries) > 1 else base)
    elif len(names) > len(geometries):
        warnings.append(f"{len(names) - len(geometries)} zone(s) nommée(s) sans géométrie fiable.")

    activation_text = extract_activation_text(pdf_text)
    activation_mode = infer_activation_mode(activation_text, pdf_text)
    frequency = extract_frequencies(pdf_text)
    features: list[dict[str, Any]] = []

    for index, (geometry, confidence) in enumerate(geometries):
        name = names[index] if index < len(names) else f"Zone temporaire {index + 1}"
        zone_type = zone_type_from_name(name, entry.title)
        if len(verticals) == 1:
            lower, upper = verticals[0]
        elif index < len(verticals):
            lower, upper = verticals[index]
        else:
            lower, upper = "À vérifier", "À vérifier"
        feature_id = f"{entry.sup_aip.replace('/', '-')}-{slugify(name)}"
        properties: dict[str, Any] = {
            "id": feature_id,
            "name": name,
            "zoneType": zone_type,
            "beta": True,
            "supAip": entry.sup_aip,
            "title": entry.title,
            "validFrom": f"{entry.valid_from}T00:00:00Z",
            "validTo": f"{entry.valid_to}T23:59:59Z",
            "activationMode": activation_mode,
            "activationText": activation_text,
            "lowerLimit": lower,
            "upperLimit": upper,
            "sourcePdf": entry.pdf_url,
            "sourcePage": SOURCE_URL,
            "dataScope": "auto-sia",
            "geometrySource": "automatic",
            "geometryConfidence": confidence,
            "sourceFingerprint": entry.fingerprint,
            "parserVersion": PARSER_VERSION,
        }
        if frequency:
            properties["frequency"] = frequency
        features.append({"type": "Feature", "id": feature_id, "properties": properties, "geometry": geometry})

    return features, warnings


def load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def existing_cache(output_dir: Path) -> tuple[dict[str, list[dict[str, Any]]], dict[str, dict[str, Any]]]:
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
    return feature_groups, unmapped_by_sup


def can_reuse_features(features: list[dict[str, Any]], entry: ListingEntry) -> bool:
    return bool(features) and all(
        feature.get("properties", {}).get("sourceFingerprint") == entry.fingerprint
        and feature.get("properties", {}).get("parserVersion") == PARSER_VERSION
        for feature in features
    )


def can_reuse_unmapped(item: dict[str, Any] | None, entry: ListingEntry) -> bool:
    return bool(item) and item.get("sourceFingerprint") == entry.fingerprint and item.get("parserVersion") == PARSER_VERSION


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


def write_json_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def build_dataset(output_dir: Path, override_path: Path, polite_delay: float = 0.15) -> dict[str, Any]:
    session = make_session()
    listing_html = fetch_bytes(session, SOURCE_URL).decode("utf-8", errors="replace")
    entries, source_updated_at = parse_listing(listing_html)
    if len(entries) < 10:
        raise RuntimeError(f"Liste SIA anormalement courte: {len(entries)} publication(s).")

    candidate_entries = [entry for entry in entries if ZONE_TITLE_RE.search(entry.title)]
    previous_features, previous_unmapped = existing_cache(output_dir)
    overrides = load_manual_overrides(override_path)
    previous_count = sum(len(items) for items in previous_features.values())

    all_features: list[dict[str, Any]] = []
    unmapped: list[dict[str, Any]] = []
    mapped_publications = 0
    reused_publications = 0
    downloaded_publications = 0

    for entry in candidate_entries:
        cached_features = previous_features.get(entry.sup_aip, [])
        cached_unmapped = previous_unmapped.get(entry.sup_aip)
        warnings: list[str] = []
        parsed_features: list[dict[str, Any]] = []

        if can_reuse_features(cached_features, entry):
            parsed_features = cached_features
            reused_publications += 1
        elif can_reuse_unmapped(cached_unmapped, entry):
            unmapped.append(cached_unmapped)
            reused_publications += 1
            continue
        else:
            try:
                pdf_bytes = fetch_bytes(session, entry.pdf_url, timeout=60)
                downloaded_publications += 1
                pdf_text = extract_pdf_text(pdf_bytes)
                parsed_features, warnings = parse_spatial_pdf(entry, pdf_text)
            except Exception as error:  # keep the scheduled job alive and report the publication
                warnings = [f"Téléchargement ou lecture PDF impossible: {type(error).__name__}: {error}"]
            time.sleep(polite_delay)

        generated_ids = {feature.get("id") for feature in parsed_features}
        for override in overrides.get(entry.sup_aip, []):
            if override.get("id") not in generated_ids:
                override_copy = json.loads(json.dumps(override))
                props = override_copy.setdefault("properties", {})
                props["sourceFingerprint"] = entry.fingerprint
                props["parserVersion"] = PARSER_VERSION
                props["validFrom"] = f"{entry.valid_from}T00:00:00Z"
                props["validTo"] = f"{entry.valid_to}T23:59:59Z"
                parsed_features.append(override_copy)

        if parsed_features:
            mapped_publications += 1
            all_features.extend(parsed_features)
            if warnings:
                unmapped.append({
                    "supAip": entry.sup_aip,
                    "title": entry.title,
                    "validFrom": entry.valid_from,
                    "validTo": entry.valid_to,
                    "sourcePdf": entry.pdf_url,
                    "reason": " ".join(warnings),
                    "partial": True,
                    "sourceFingerprint": entry.fingerprint,
                    "parserVersion": PARSER_VERSION,
                })
        else:
            unmapped.append({
                "supAip": entry.sup_aip,
                "title": entry.title,
                "validFrom": entry.valid_from,
                "validTo": entry.valid_to,
                "sourcePdf": entry.pdf_url,
                "reason": " ".join(warnings) or "Aucune géométrie fiable extraite.",
                "partial": False,
                "sourceFingerprint": entry.fingerprint,
                "parserVersion": PARSER_VERSION,
            })

    all_features.sort(key=lambda feature: (feature.get("properties", {}).get("supAip", ""), feature.get("properties", {}).get("name", "")), reverse=True)
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    collection = {
        "type": "FeatureCollection",
        "name": "CAP CLAIR SUP AIP AUTO BETA",
        "generatedAt": generated_at,
        "source": "SIA France - liste et PDF officiels SUP AIP Métropole",
        "sourceUrl": SOURCE_URL,
        "coverage": "Extraction automatique conservatrice. Les publications non cartographiées sont signalées séparément.",
        "parserVersion": PARSER_VERSION,
        "features": all_features,
    }
    validate_feature_collection(collection, previous_count)

    status = {
        "schemaVersion": 1,
        "mode": "automatic",
        "beta": True,
        "generatedAt": generated_at,
        "sourceUpdatedAt": source_updated_at,
        "sourceUrl": SOURCE_URL,
        "parserVersion": PARSER_VERSION,
        "listingPublicationCount": len(entries),
        "zonalPublicationCount": len(candidate_entries),
        "mappedPublicationCount": mapped_publications,
        "featureCount": len(all_features),
        "unmappedPublicationCount": len(unmapped),
        "completeUnmappedPublicationCount": sum(1 for item in unmapped if not item.get("partial")),
        "partialPublicationCount": sum(1 for item in unmapped if item.get("partial")),
        "reusedPublicationCount": reused_publications,
        "downloadedPublicationCount": downloaded_publications,
        "staleAfterHours": 36,
        "message": "Données générées automatiquement depuis les publications officielles du SIA. Vérifier le PDF, SOFIA et les NOTAM avant le vol.",
    }
    unmapped_payload = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "sourceUrl": SOURCE_URL,
        "parserVersion": PARSER_VERSION,
        "publications": sorted(unmapped, key=lambda item: item.get("supAip", ""), reverse=True),
    }

    write_json_atomic(output_dir / "supaip-current.geojson", collection)
    write_json_atomic(output_dir / "supaip-status.json", status)
    write_json_atomic(output_dir / "supaip-unmapped.json", unmapped_payload)
    return status


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=Path("public/data"))
    parser.add_argument("--overrides", type=Path, default=Path("tools/supaip/overrides.geojson"))
    parser.add_argument("--polite-delay", type=float, default=0.15)
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
