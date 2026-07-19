#!/usr/bin/env python3
"""Validate CAP CLAIR immutable SUP AIP releases and mutable pointers."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

from shapely.geometry import shape
from shapely.validation import explain_validity

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from tools.supaip.update_supaip import compute_dataset_revision

VERTICAL_MISSING_NOTICE = "Limites verticales non extraites - consulter le PDF SIA"
REQUIRED_REVISION_FILES = ("status.json", "manifest.json", "data.geojson", "unmapped.json")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def file_descriptor(path: Path) -> dict[str, Any]:
    payload = path.read_bytes()
    return {"sha256": sha256_bytes(payload), "size": len(payload)}


def geometry_sha256(geometry: dict[str, Any]) -> str:
    raw = json.dumps(geometry, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256_bytes(raw.encode("utf-8"))


def is_official_pdf_url(value: Any) -> bool:
    if not isinstance(value, str) or not value:
        return False
    parsed = urlparse(value)
    return (
        parsed.scheme == "https"
        and parsed.netloc.lower().endswith("aviation-civile.gouv.fr")
        and ("/documents/download/" in parsed.path or parsed.path.lower().endswith(".pdf"))
    )


def iter_positions(value: Any) -> Iterable[tuple[float, float]]:
    if isinstance(value, list):
        if len(value) >= 2 and all(isinstance(item, (int, float)) for item in value[:2]):
            yield float(value[0]), float(value[1])
            return
        for item in value:
            yield from iter_positions(item)


def validate_geojson(
    geojson: dict[str, Any],
    legacy_invalid_geometry_hashes: dict[str, str] | None = None,
) -> dict[str, int]:
    if geojson.get("type") != "FeatureCollection":
        raise RuntimeError("Le fichier data.geojson n'est pas une FeatureCollection.")
    features = geojson.get("features")
    if not isinstance(features, list) or not features:
        raise RuntimeError("La révision SUP AIP ne contient aucune géométrie.")

    legacy_invalid_geometry_hashes = legacy_invalid_geometry_hashes or {}
    ids: set[str] = set()
    with_vertical = 0
    without_vertical = 0
    publications_with_geometry: set[str] = set()

    for index, feature in enumerate(features):
        if not isinstance(feature, dict):
            raise RuntimeError(f"Feature SUP AIP invalide à l'index {index}.")
        properties = feature.get("properties") or {}
        feature_id = feature.get("id") or properties.get("id")
        if not isinstance(feature_id, str) or not feature_id:
            raise RuntimeError(f"Identifiant SUP AIP absent à l'index {index}.")
        if feature_id in ids:
            raise RuntimeError(f"Identifiant SUP AIP dupliqué: {feature_id}")
        ids.add(feature_id)

        sup_aip = properties.get("supAip")
        if not isinstance(sup_aip, str) or not sup_aip:
            raise RuntimeError(f"Publication SUP AIP absente pour {feature_id}.")
        publications_with_geometry.add(sup_aip)

        if not is_official_pdf_url(properties.get("sourcePdf")):
            raise RuntimeError(f"PDF SIA officiel absent ou invalide pour {feature_id}.")

        extracted = properties.get("verticalLimitsExtracted") is True
        lower = str(properties.get("lowerLimit") or "").strip()
        upper = str(properties.get("upperLimit") or "").strip()
        if extracted:
            if not lower or not upper or lower == "À vérifier" or upper == "À vérifier":
                raise RuntimeError(f"Limites verticales incohérentes pour {feature_id}.")
            with_vertical += 1
        else:
            if properties.get("verticalLimitNotice") != VERTICAL_MISSING_NOTICE:
                raise RuntimeError(f"Message de limites verticales incorrect pour {feature_id}.")
            without_vertical += 1

        geometry = feature.get("geometry")
        if not isinstance(geometry, dict) or geometry.get("type") not in {"Polygon", "MultiPolygon"}:
            raise RuntimeError(f"Géométrie non supportée pour {feature_id}.")
        for longitude, latitude in iter_positions(geometry.get("coordinates")):
            if not math.isfinite(longitude) or not math.isfinite(latitude):
                raise RuntimeError(f"Coordonnée non finie pour {feature_id}.")
            if longitude < -180 or longitude > 180 or latitude < -90 or latitude > 90:
                raise RuntimeError(f"Coordonnée hors domaine pour {feature_id}: {longitude}, {latitude}")
        try:
            geom = shape(geometry)
        except Exception as error:
            raise RuntimeError(f"Géométrie illisible pour {feature_id}: {error}") from error
        if geom.is_empty:
            raise RuntimeError(f"Géométrie vide pour {feature_id}.")
        if not geom.is_valid:
            actual_hash = geometry_sha256(geometry)
            if legacy_invalid_geometry_hashes.get(feature_id) != actual_hash:
                raise RuntimeError(f"Géométrie invalide pour {feature_id}: {explain_validity(geom)}")

    return {
        "featureCount": len(features),
        "featuresWithVerticalLimits": with_vertical,
        "featuresWithoutVerticalLimits": without_vertical,
        "publicationsWithGeometry": len(publications_with_geometry),
    }


def validate_revision_directory(revision_dir: Path, expected_revision: str | None = None) -> dict[str, Any]:
    missing = [name for name in REQUIRED_REVISION_FILES if not (revision_dir / name).is_file()]
    if missing:
        raise RuntimeError(f"Révision incomplète {revision_dir.name}: {', '.join(missing)}")

    status = read_json(revision_dir / "status.json")
    manifest = read_json(revision_dir / "manifest.json")
    geojson = read_json(revision_dir / "data.geojson")
    unmapped = read_json(revision_dir / "unmapped.json")

    revision = expected_revision or revision_dir.name
    for label, payload in (("status", status), ("manifest", manifest), ("data", geojson), ("unmapped", unmapped)):
        if payload.get("datasetRevision") != revision:
            raise RuntimeError(f"datasetRevision incohérent dans {label}.json")

    if manifest.get("schemaVersion") != 2:
        raise RuntimeError("Le manifeste de révision doit utiliser schemaVersion 2.")
    dataset_generated_at = manifest.get("datasetGeneratedAt")
    if not isinstance(dataset_generated_at, str) or not dataset_generated_at:
        raise RuntimeError("datasetGeneratedAt absent du manifeste.")
    if status.get("datasetGeneratedAt") != dataset_generated_at:
        raise RuntimeError("datasetGeneratedAt incohérent entre le statut et le manifeste.")
    if geojson.get("datasetGeneratedAt") != dataset_generated_at:
        raise RuntimeError("datasetGeneratedAt incohérent dans le GeoJSON.")

    legacy_exceptions = manifest.get("legacyInvalidGeometryExceptions") or []
    if not isinstance(legacy_exceptions, list):
        raise RuntimeError("legacyInvalidGeometryExceptions invalide dans le manifeste.")
    legacy_hashes: dict[str, str] = {}
    for exception in legacy_exceptions:
        feature_id = exception.get("id")
        geometry_hash = exception.get("geometrySha256")
        if not isinstance(feature_id, str) or not isinstance(geometry_hash, str):
            raise RuntimeError("Exception géométrique historique invalide dans le manifeste.")
        if feature_id in legacy_hashes:
            raise RuntimeError(f"Exception géométrique dupliquée: {feature_id}")
        legacy_hashes[feature_id] = geometry_hash

    geo_counts = validate_geojson(geojson, legacy_hashes)
    publications = manifest.get("publications")
    if not isinstance(publications, list) or not publications:
        raise RuntimeError("Catalogue de publications absent du manifeste.")
    unmapped_publications = unmapped.get("publications")
    if not isinstance(unmapped_publications, list):
        raise RuntimeError("Le fichier unmapped.json ne contient pas de liste publications.")
    computed_business_hash = compute_dataset_revision(geojson, unmapped_publications, publications)
    declared_business_hash = manifest.get("businessContentSha256")
    if not isinstance(declared_business_hash, str) or declared_business_hash != computed_business_hash:
        raise RuntimeError("businessContentSha256 incohérent dans le manifeste.")
    for label, payload in (("status", status), ("data", geojson), ("unmapped", unmapped)):
        if payload.get("businessContentSha256") != computed_business_hash:
            raise RuntimeError(f"businessContentSha256 incohérent dans {label}.json")
    publication_ids: set[str] = set()
    for publication in publications:
        sup_aip = publication.get("supAip")
        if not isinstance(sup_aip, str) or not sup_aip:
            raise RuntimeError("Identifiant SUP AIP absent du manifeste.")
        if sup_aip in publication_ids:
            raise RuntimeError(f"Publication dupliquée dans le manifeste: {sup_aip}")
        publication_ids.add(sup_aip)
        if not is_official_pdf_url(publication.get("sourcePdf")):
            raise RuntimeError(f"PDF officiel absent pour la publication {sup_aip}.")

    expected_counts = {
        **geo_counts,
        "publicationCount": len(publications),
    }
    for key, expected in expected_counts.items():
        if manifest.get(key) != expected:
            raise RuntimeError(f"Compteur {key} incohérent: {manifest.get(key)} au lieu de {expected}.")

    if status.get("featureCount") != geo_counts["featureCount"]:
        raise RuntimeError("featureCount incohérent dans status.json.")
    if status.get("verticalCompleteFeatureCount") != geo_counts["featuresWithVerticalLimits"]:
        raise RuntimeError("verticalCompleteFeatureCount incohérent dans status.json.")
    if status.get("missingVerticalFeatureCount") != geo_counts["featuresWithoutVerticalLimits"]:
        raise RuntimeError("missingVerticalFeatureCount incohérent dans status.json.")
    if status.get("listingPublicationCount") != len(publications):
        raise RuntimeError("listingPublicationCount incohérent dans status.json.")

    for publication in unmapped_publications:
        if not is_official_pdf_url(publication.get("sourcePdf")):
            raise RuntimeError(f"PDF officiel absent dans unmapped.json pour {publication.get('supAip')}.")

    files = manifest.get("files")
    if not isinstance(files, dict):
        raise RuntimeError("Empreintes de fichiers absentes du manifeste.")
    for name in ("data.geojson", "status.json", "unmapped.json"):
        descriptor = files.get(name)
        actual = file_descriptor(revision_dir / name)
        if not isinstance(descriptor, dict):
            raise RuntimeError(f"Empreinte absente pour {name}.")
        if descriptor.get("sha256") != actual["sha256"] or descriptor.get("size") != actual["size"]:
            raise RuntimeError(f"Empreinte ou taille incohérente pour {name}.")

    return manifest


def validate_latest(output_dir: Path) -> dict[str, Any]:
    latest_path = output_dir / "supaip" / "latest.json"
    if not latest_path.is_file():
        raise RuntimeError("latest.json absent.")
    latest = read_json(latest_path)
    if latest.get("schemaVersion") != 2:
        raise RuntimeError("latest.json doit utiliser schemaVersion 2.")
    revision = latest.get("datasetRevision")
    if not isinstance(revision, str) or len(revision) != 64:
        raise RuntimeError("datasetRevision invalide dans latest.json.")
    revision_dir = output_dir / "supaip" / "revisions" / revision
    manifest = validate_revision_directory(revision_dir, revision)
    manifest_path = revision_dir / "manifest.json"
    descriptor = file_descriptor(manifest_path)
    if latest.get("manifestSha256") != descriptor["sha256"] or latest.get("manifestSize") != descriptor["size"]:
        raise RuntimeError("Empreinte du manifeste incohérente dans latest.json.")
    expected_url = f"/data/supaip/revisions/{revision}/manifest.json"
    if latest.get("manifestUrl") != expected_url:
        raise RuntimeError("manifestUrl incohérente dans latest.json.")
    if latest.get("datasetGeneratedAt") != manifest.get("datasetGeneratedAt"):
        raise RuntimeError("datasetGeneratedAt incohérent dans latest.json.")
    if not latest.get("lastSuccessfulCheckAt"):
        raise RuntimeError("lastSuccessfulCheckAt absent de latest.json.")
    return latest


def validate_compatibility_files(output_dir: Path, latest: dict[str, Any] | None = None) -> None:
    latest = latest or validate_latest(output_dir)
    revision = latest["datasetRevision"]
    revision_dir = output_dir / "supaip" / "revisions" / revision
    pairs = {
        "supaip-current.geojson": "data.geojson",
        "supaip-manifest.json": "manifest.json",
        "supaip-unmapped.json": "unmapped.json",
    }
    for compatibility_name, revision_name in pairs.items():
        compatibility_path = output_dir / compatibility_name
        if not compatibility_path.is_file():
            raise RuntimeError(f"URL compatible absente: {compatibility_name}")
        if compatibility_path.read_bytes() != (revision_dir / revision_name).read_bytes():
            raise RuntimeError(f"URL compatible différente de la dernière révision: {compatibility_name}")

    status = read_json(output_dir / "supaip-status.json")
    if status.get("datasetRevision") != revision:
        raise RuntimeError("Le statut compatible ne pointe pas vers la dernière révision.")
    if status.get("datasetGeneratedAt") != latest.get("datasetGeneratedAt"):
        raise RuntimeError("datasetGeneratedAt incohérent dans le statut compatible.")
    if status.get("lastSuccessfulCheckAt") != latest.get("lastSuccessfulCheckAt"):
        raise RuntimeError("lastSuccessfulCheckAt incohérent dans le statut compatible.")
    if status.get("generatedAt") != status.get("lastSuccessfulCheckAt"):
        raise RuntimeError("generatedAt doit rester un alias compatible de lastSuccessfulCheckAt.")


def validate_publication(output_dir: Path) -> dict[str, Any]:
    latest = validate_latest(output_dir)
    validate_compatibility_files(output_dir, latest)
    return latest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=Path("public/data"))
    parser.add_argument("--revision-dir", type=Path)
    args = parser.parse_args()
    try:
        if args.revision_dir:
            validate_revision_directory(args.revision_dir)
        else:
            validate_publication(args.output_dir)
    except Exception as error:
        print(f"SUP AIP release validation failed: {error}")
        return 1
    print("SUP AIP release validation succeeded")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
