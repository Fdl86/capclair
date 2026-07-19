#!/usr/bin/env python3
"""Transactional publisher for CAP CLAIR SUP AIP datasets."""

from __future__ import annotations

import argparse
import json
import shutil
import tempfile
import uuid
import sys
from pathlib import Path
from typing import Any

from shapely.geometry import shape
from shapely.validation import explain_validity

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from tools.supaip.update_supaip import build_dataset, compute_dataset_revision, utc_now_iso
from tools.supaip.validate_supaip_release import (
    file_descriptor,
    geometry_sha256,
    read_json,
    validate_publication,
    validate_revision_directory,
)

LEGACY_FILES = (
    "supaip-current.geojson",
    "supaip-status.json",
    "supaip-manifest.json",
    "supaip-unmapped.json",
)


def json_bytes(payload: Any) -> bytes:
    return (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def write_bytes_atomic(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_bytes(payload)
    temporary.replace(path)


def copy_existing_cache(output_dir: Path, candidate_dir: Path) -> None:
    candidate_dir.mkdir(parents=True, exist_ok=True)
    for name in LEGACY_FILES:
        source = output_dir / name
        if source.is_file():
            shutil.copy2(source, candidate_dir / name)


def inherited_legacy_geometry_hashes(output_dir: Path) -> dict[str, str]:
    latest_path = output_dir / "supaip" / "latest.json"
    if not latest_path.is_file():
        return {}
    latest = read_json(latest_path)
    revision = latest.get("datasetRevision")
    if not isinstance(revision, str):
        return {}
    manifest_path = output_dir / "supaip" / "revisions" / revision / "manifest.json"
    if not manifest_path.is_file():
        return {}
    manifest = read_json(manifest_path)
    result: dict[str, str] = {}
    for item in manifest.get("legacyInvalidGeometryExceptions") or []:
        feature_id = item.get("id")
        geometry_hash = item.get("geometrySha256")
        if isinstance(feature_id, str) and isinstance(geometry_hash, str):
            result[feature_id] = geometry_hash
    return result


def collect_legacy_geometry_exceptions(
    geojson: dict[str, Any],
    inherited_hashes: dict[str, str],
    allow_seed: bool,
) -> list[dict[str, str]]:
    exceptions: list[dict[str, str]] = []
    for feature in geojson.get("features") or []:
        geometry = feature.get("geometry") or {}
        feature_id = feature.get("id") or (feature.get("properties") or {}).get("id")
        if not isinstance(feature_id, str):
            continue
        geom = shape(geometry)
        if geom.is_valid:
            continue
        geometry_hash = geometry_sha256(geometry)
        if inherited_hashes.get(feature_id) != geometry_hash and not allow_seed:
            raise RuntimeError(f"Nouvelle géométrie invalide rejetée pour {feature_id}: {explain_validity(geom)}")
        exceptions.append({
            "id": feature_id,
            "geometrySha256": geometry_hash,
            "reason": f"Exception historique figée: {explain_validity(geom)}",
        })
    return sorted(exceptions, key=lambda item: item["id"])


def immutable_status(candidate_status: dict[str, Any], dataset_generated_at: str) -> dict[str, Any]:
    result = dict(candidate_status)
    result["generatedAt"] = dataset_generated_at
    result["datasetGeneratedAt"] = dataset_generated_at
    result.pop("lastSuccessfulCheckAt", None)
    result.pop("checkMode", None)
    return result


def build_revision_staging(
    candidate_dir: Path,
    staging_dir: Path,
    inherited_geometry_hashes: dict[str, str] | None = None,
    allow_legacy_seed: bool = False,
) -> tuple[str, str]:
    candidate_geo = read_json(candidate_dir / "supaip-current.geojson")
    candidate_status = read_json(candidate_dir / "supaip-status.json")
    candidate_manifest = read_json(candidate_dir / "supaip-manifest.json")
    candidate_unmapped = read_json(candidate_dir / "supaip-unmapped.json")
    legacy_geometry_exceptions = collect_legacy_geometry_exceptions(
        candidate_geo, inherited_geometry_hashes or {}, allow_legacy_seed
    )

    revision = str(candidate_status.get("datasetRevision") or "")
    if len(revision) != 64:
        raise RuntimeError("datasetRevision candidate invalide.")
    dataset_generated_at = str(
        candidate_status.get("datasetGeneratedAt")
        or candidate_geo.get("datasetGeneratedAt")
        or candidate_geo.get("generatedAt")
        or ""
    )
    if not dataset_generated_at:
        raise RuntimeError("datasetGeneratedAt absent de la base candidate.")

    candidate_geo["generatedAt"] = dataset_generated_at
    candidate_geo["datasetGeneratedAt"] = dataset_generated_at
    candidate_geo["datasetRevision"] = revision

    candidate_unmapped["generatedAt"] = dataset_generated_at
    candidate_unmapped["datasetGeneratedAt"] = dataset_generated_at
    candidate_unmapped["datasetRevision"] = revision

    publications = candidate_manifest.get("publications") or []
    unmapped_publications = candidate_unmapped.get("publications") or []
    business_content_sha256 = compute_dataset_revision(
        candidate_geo, list(unmapped_publications), list(publications)
    )
    for label, payload in (
        ("status", candidate_status),
        ("data", candidate_geo),
        ("manifest", candidate_manifest),
        ("unmapped", candidate_unmapped),
    ):
        declared = payload.get("businessContentSha256")
        if declared and declared != business_content_sha256:
            raise RuntimeError(f"businessContentSha256 incohérent dans {label}.")

    candidate_geo["businessContentSha256"] = business_content_sha256
    candidate_unmapped["businessContentSha256"] = business_content_sha256
    status_payload = immutable_status(candidate_status, dataset_generated_at)
    status_payload["datasetRevision"] = revision
    status_payload["businessContentSha256"] = business_content_sha256

    staging_dir.mkdir(parents=True, exist_ok=True)
    (staging_dir / "data.geojson").write_bytes(json_bytes(candidate_geo))
    (staging_dir / "status.json").write_bytes(json_bytes(status_payload))
    (staging_dir / "unmapped.json").write_bytes(json_bytes(candidate_unmapped))

    features = candidate_geo.get("features") or []
    publications_with_geometry = sum(1 for item in publications if int(item.get("mappedGeometryCount") or 0) > 0)
    features_with_verticals = sum(
        1 for feature in features if (feature.get("properties") or {}).get("verticalLimitsExtracted") is True
    )
    files = {
        name: file_descriptor(staging_dir / name)
        for name in ("data.geojson", "status.json", "unmapped.json")
    }
    manifest_payload = {
        **candidate_manifest,
        "schemaVersion": 2,
        "generatedAt": dataset_generated_at,
        "datasetGeneratedAt": dataset_generated_at,
        "datasetRevision": revision,
        "businessContentSha256": business_content_sha256,
        "featureCount": len(features),
        "publicationCount": len(publications),
        "publicationsWithGeometry": publications_with_geometry,
        "featuresWithVerticalLimits": features_with_verticals,
        "featuresWithoutVerticalLimits": len(features) - features_with_verticals,
        "geoJsonSha256": files["data.geojson"]["sha256"],
        "geoJsonSize": files["data.geojson"]["size"],
        "files": files,
        "legacyInvalidGeometryExceptions": legacy_geometry_exceptions,
        "publications": publications,
    }
    (staging_dir / "manifest.json").write_bytes(json_bytes(manifest_payload))
    validate_revision_directory(staging_dir, revision)
    return revision, dataset_generated_at


def install_revision(output_dir: Path, staging_dir: Path, revision: str) -> tuple[Path, bool]:
    revisions_dir = output_dir / "supaip" / "revisions"
    revisions_dir.mkdir(parents=True, exist_ok=True)
    destination = revisions_dir / revision
    if destination.exists():
        existing_manifest = validate_revision_directory(destination, revision)
        candidate_manifest = validate_revision_directory(staging_dir, revision)
        existing_business = existing_manifest.get("businessContentSha256")
        candidate_business = candidate_manifest.get("businessContentSha256")
        if existing_business and candidate_business and existing_business != candidate_business:
            raise RuntimeError(
                f"La révision immuable {revision} existe déjà avec un contenu métier différent."
            )
        return destination, False

    temporary = revisions_dir / f".{revision}.{uuid.uuid4().hex}.tmp"
    if temporary.exists():
        shutil.rmtree(temporary)
    shutil.copytree(staging_dir, temporary)
    validate_revision_directory(temporary, revision)
    temporary.replace(destination)
    return destination, True


def publish_candidate(
    output_dir: Path,
    candidate_dir: Path,
    *,
    last_successful_check_at: str | None = None,
    check_mode: str | None = None,
    allow_legacy_seed: bool = False,
) -> dict[str, Any]:
    candidate_status = read_json(candidate_dir / "supaip-status.json")
    check_at = last_successful_check_at or str(candidate_status.get("lastSuccessfulCheckAt") or utc_now_iso())
    mode = check_mode or str(candidate_status.get("checkMode") or "full-rebuild")

    with tempfile.TemporaryDirectory(prefix="capclair-supaip-release-") as temporary_root:
        staging_dir = Path(temporary_root) / "revision"
        revision, candidate_generated_at = build_revision_staging(
            candidate_dir,
            staging_dir,
            inherited_legacy_geometry_hashes(output_dir),
            allow_legacy_seed,
        )
        revision_dir, created = install_revision(output_dir, staging_dir, revision)

    revision_manifest = read_json(revision_dir / "manifest.json")
    dataset_generated_at = str(revision_manifest["datasetGeneratedAt"])
    manifest_descriptor = file_descriptor(revision_dir / "manifest.json")

    compatibility_status = dict(candidate_status)
    compatibility_status.update({
        "schemaVersion": 2,
        "generatedAt": check_at,
        "datasetGeneratedAt": dataset_generated_at,
        "lastSuccessfulCheckAt": check_at,
        "checkMode": mode,
        "datasetRevision": revision,
        "staleAfterHours": int(candidate_status.get("staleAfterHours") or 36),
        "manifestUrl": f"/data/supaip/revisions/{revision}/manifest.json",
        "businessContentSha256": revision_manifest.get("businessContentSha256"),
    })

    latest = {
        "schemaVersion": 2,
        "datasetRevision": revision,
        "datasetGeneratedAt": dataset_generated_at,
        "lastSuccessfulCheckAt": check_at,
        "staleAfterHours": int(candidate_status.get("staleAfterHours") or 36),
        "checkMode": mode,
        "manifestUrl": f"/data/supaip/revisions/{revision}/manifest.json",
        "manifestSha256": manifest_descriptor["sha256"],
        "manifestSize": manifest_descriptor["size"],
        "businessContentSha256": revision_manifest.get("businessContentSha256"),
    }

    # Compatibility files are copied from the validated immutable revision.
    write_bytes_atomic(output_dir / "supaip-current.geojson", (revision_dir / "data.geojson").read_bytes())
    write_bytes_atomic(output_dir / "supaip-manifest.json", (revision_dir / "manifest.json").read_bytes())
    write_bytes_atomic(output_dir / "supaip-unmapped.json", (revision_dir / "unmapped.json").read_bytes())
    write_bytes_atomic(output_dir / "supaip-status.json", json_bytes(compatibility_status))

    # latest.json is intentionally written last.
    write_bytes_atomic(output_dir / "supaip" / "latest.json", json_bytes(latest))
    validate_publication(output_dir)

    return {
        **latest,
        "revisionCreated": created,
        "candidateDatasetGeneratedAt": candidate_generated_at,
    }


def seed_existing(output_dir: Path) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="capclair-supaip-seed-") as temporary_root:
        candidate_dir = Path(temporary_root) / "candidate"
        copy_existing_cache(output_dir, candidate_dir)
        status = read_json(candidate_dir / "supaip-status.json")
        geo = read_json(candidate_dir / "supaip-current.geojson")
        manifest = read_json(candidate_dir / "supaip-manifest.json")
        unmapped = read_json(candidate_dir / "supaip-unmapped.json")
        business_content_sha256 = compute_dataset_revision(
            geo,
            list(unmapped.get("publications") or []),
            list(manifest.get("publications") or []),
        )
        dataset_generated_at = str(status.get("datasetGeneratedAt") or status.get("generatedAt") or utc_now_iso())
        status["datasetGeneratedAt"] = dataset_generated_at
        status["lastSuccessfulCheckAt"] = str(status.get("lastSuccessfulCheckAt") or status.get("generatedAt") or dataset_generated_at)
        status["generatedAt"] = status["lastSuccessfulCheckAt"]
        status["checkMode"] = "seed-existing"
        status["businessContentSha256"] = business_content_sha256
        (candidate_dir / "supaip-status.json").write_bytes(json_bytes(status))

        geo["datasetGeneratedAt"] = dataset_generated_at
        geo["generatedAt"] = dataset_generated_at
        geo["businessContentSha256"] = business_content_sha256
        (candidate_dir / "supaip-current.geojson").write_bytes(json_bytes(geo))

        for name, payload in (("supaip-manifest.json", manifest), ("supaip-unmapped.json", unmapped)):
            payload["schemaVersion"] = 2
            payload["datasetGeneratedAt"] = dataset_generated_at
            payload["generatedAt"] = dataset_generated_at
            payload["businessContentSha256"] = business_content_sha256
            (candidate_dir / name).write_bytes(json_bytes(payload))

        return publish_candidate(
            output_dir,
            candidate_dir,
            last_successful_check_at=status["lastSuccessfulCheckAt"],
            check_mode="seed-existing",
            allow_legacy_seed=True,
        )


def run_pipeline(output_dir: Path, overrides: Path, polite_delay: float) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="capclair-supaip-candidate-") as temporary_root:
        candidate_dir = Path(temporary_root) / "candidate"
        copy_existing_cache(output_dir, candidate_dir)
        build_dataset(candidate_dir, overrides, polite_delay)
        return publish_candidate(output_dir, candidate_dir)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=Path("public/data"))
    parser.add_argument("--overrides", type=Path, default=Path("tools/supaip/overrides.geojson"))
    parser.add_argument("--polite-delay", type=float, default=0.12)
    parser.add_argument("--seed-existing", action="store_true")
    args = parser.parse_args()

    try:
        result = seed_existing(args.output_dir) if args.seed_existing else run_pipeline(
            args.output_dir, args.overrides, args.polite_delay
        )
    except Exception as error:
        print(f"SUP AIP transactional publication failed: {error}")
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
