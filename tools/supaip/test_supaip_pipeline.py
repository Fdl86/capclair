import json
import tempfile
import unittest
from pathlib import Path

from tools.supaip.publish_supaip import json_bytes, publish_candidate
from tools.supaip.update_supaip import (
    choose_dataset_generated_at,
    choose_dataset_revision,
    compute_dataset_revision,
)
from tools.supaip.validate_supaip_release import (
    file_descriptor,
    validate_publication,
    validate_revision_directory,
)


OFFICIAL_PDF = "https://www.sia.aviation-civile.gouv.fr/documents/download/f/d/test/"


def feature(feature_id: str = "001-26-zone-test", upper: str = "FL 095", invalid: bool = False):
    coordinates = (
        [[0.0, 0.0], [1.0, 1.0], [0.0, 1.0], [1.0, 0.0], [0.0, 0.0]]
        if invalid
        else [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], [0.0, 0.0]]
    )
    return {
        "type": "Feature",
        "id": feature_id,
        "geometry": {"type": "Polygon", "coordinates": [coordinates]},
        "properties": {
            "id": feature_id,
            "name": "ZRT TEST",
            "zoneType": "ZRT",
            "supAip": "001/26",
            "title": "Création d'une ZRT TEST",
            "validFrom": "2026-01-01",
            "validTo": "2026-12-31",
            "activationMode": "published",
            "activationText": "Consulter le PDF officiel.",
            "lowerLimit": "SFC",
            "upperLimit": upper,
            "verticalLimitsExtracted": True,
            "verticalLimitNotice": None,
            "sourcePdf": OFFICIAL_PDF,
            "geometrySource": "automatic",
            "geometryConfidence": "high",
        },
    }


def write_candidate(root: Path, revision: str, check_at: str, *, upper: str = "FL 095", invalid: bool = False):
    root.mkdir(parents=True, exist_ok=True)
    generated = "2026-07-16T04:39:32Z"
    geo = {
        "type": "FeatureCollection",
        "name": "CAP CLAIR test",
        "sourceUrl": "https://www.sia.aviation-civile.gouv.fr/documents/supaip/aip/id/6",
        "generatedAt": generated,
        "datasetGeneratedAt": generated,
        "datasetRevision": revision,
        "features": [feature(upper=upper, invalid=invalid)],
    }
    status = {
        "schemaVersion": 2,
        "mode": "automatic",
        "beta": True,
        "generatedAt": check_at,
        "datasetGeneratedAt": generated,
        "lastSuccessfulCheckAt": check_at,
        "checkMode": "listing-reuse",
        "sourceUpdatedAt": "2026-07-16T00:00:00Z",
        "sourceUrl": "https://www.sia.aviation-civile.gouv.fr/documents/supaip/aip/id/6",
        "parserVersion": "test",
        "datasetRevision": revision,
        "listingPublicationCount": 1,
        "processedPublicationCount": 1,
        "nonSpatialPublicationCount": 0,
        "zonalPublicationCount": 1,
        "mappedPublicationCount": 1,
        "fullyMappedPublicationCount": 1,
        "conservativelyMappedPublicationCount": 0,
        "fallbackMappedPublicationCount": 0,
        "featureCount": 1,
        "verticalCompleteFeatureCount": 1,
        "missingVerticalFeatureCount": 0,
        "unmappedPublicationCount": 0,
        "reviewPublicationCount": 0,
        "completeUnmappedPublicationCount": 0,
        "partialPublicationCount": 0,
        "conservativePublicationCount": 0,
        "fallbackPublicationCount": 0,
        "reusedPublicationCount": 1,
        "downloadedPublicationCount": 0,
        "unresolvedRegressionCount": 0,
        "staleAfterHours": 36,
        "message": "test",
    }
    publication = {
        "supAip": "001/26",
        "title": "Création d'une ZRT TEST",
        "spatial": True,
        "mappedGeometryCount": 1,
        "expectedNamedGeometryCount": 1,
        "missingVerticalCount": 0,
        "status": "complete",
        "sourcePdf": OFFICIAL_PDF,
    }
    manifest = {
        "schemaVersion": 2,
        "generatedAt": generated,
        "datasetGeneratedAt": generated,
        "datasetRevision": revision,
        "sourceUrl": status["sourceUrl"],
        "parserVersion": "test",
        "publications": [publication],
    }
    unmapped = {
        "schemaVersion": 2,
        "generatedAt": generated,
        "datasetGeneratedAt": generated,
        "datasetRevision": revision,
        "sourceUrl": status["sourceUrl"],
        "parserVersion": "test",
        "publications": [],
    }
    for name, payload in (
        ("supaip-current.geojson", geo),
        ("supaip-status.json", status),
        ("supaip-manifest.json", manifest),
        ("supaip-unmapped.json", unmapped),
    ):
        (root / name).write_bytes(json_bytes(payload))


class SupAipPipelineTests(unittest.TestCase):
    def test_no_change_keeps_revision_and_geojson_but_updates_check(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "public" / "data"
            candidate = root / "candidate"
            revision = "a" * 64
            write_candidate(candidate, revision, "2026-07-19T12:00:00Z")
            first = publish_candidate(output, candidate)
            geo_before = (output / "supaip-current.geojson").read_bytes()
            generated_before = first["datasetGeneratedAt"]

            write_candidate(candidate, revision, "2026-07-19T18:00:00Z")
            second = publish_candidate(output, candidate)

            self.assertEqual(second["datasetRevision"], revision)
            self.assertEqual(second["datasetGeneratedAt"], generated_before)
            self.assertEqual(second["lastSuccessfulCheckAt"], "2026-07-19T18:00:00Z")
            self.assertFalse(second["revisionCreated"])
            self.assertEqual((output / "supaip-current.geojson").read_bytes(), geo_before)
            status = json.loads((output / "supaip-status.json").read_text())
            self.assertEqual(status["generatedAt"], status["lastSuccessfulCheckAt"])
            validate_publication(output)

    def test_real_change_creates_new_immutable_revision(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "public" / "data"
            candidate = root / "candidate"
            first_revision = "a" * 64
            second_revision = "b" * 64
            write_candidate(candidate, first_revision, "2026-07-19T12:00:00Z")
            publish_candidate(output, candidate)
            first_geo = output / "supaip" / "revisions" / first_revision / "data.geojson"
            first_bytes = first_geo.read_bytes()

            write_candidate(candidate, second_revision, "2026-07-19T18:00:00Z", upper="FL 105")
            result = publish_candidate(output, candidate)

            self.assertTrue(result["revisionCreated"])
            self.assertEqual(result["datasetRevision"], second_revision)
            self.assertEqual(first_geo.read_bytes(), first_bytes)
            self.assertTrue((output / "supaip" / "revisions" / second_revision / "manifest.json").is_file())
            validate_publication(output)

    def test_manifest_hashes_match_published_bytes(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "public" / "data"
            candidate = root / "candidate"
            revision = "c" * 64
            write_candidate(candidate, revision, "2026-07-19T12:00:00Z")
            publish_candidate(output, candidate)
            revision_dir = output / "supaip" / "revisions" / revision
            manifest = validate_revision_directory(revision_dir, revision)
            for name in ("data.geojson", "status.json", "unmapped.json"):
                self.assertEqual(manifest["files"][name], file_descriptor(revision_dir / name))

    def test_new_invalid_geometry_is_rejected_and_latest_is_unchanged(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "public" / "data"
            candidate = root / "candidate"
            valid_revision = "d" * 64
            invalid_revision = "e" * 64
            write_candidate(candidate, valid_revision, "2026-07-19T12:00:00Z")
            publish_candidate(output, candidate)
            latest_before = (output / "supaip" / "latest.json").read_bytes()

            write_candidate(candidate, invalid_revision, "2026-07-19T18:00:00Z", invalid=True)
            with self.assertRaisesRegex(RuntimeError, "Nouvelle géométrie invalide rejetée"):
                publish_candidate(output, candidate)

            self.assertEqual((output / "supaip" / "latest.json").read_bytes(), latest_before)
            self.assertFalse((output / "supaip" / "revisions" / invalid_revision).exists())

    def test_latest_cannot_point_to_incomplete_revision(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "public" / "data"
            candidate = root / "candidate"
            revision = "f" * 64
            write_candidate(candidate, revision, "2026-07-19T12:00:00Z")
            publish_candidate(output, candidate)
            (output / "supaip" / "revisions" / revision / "data.geojson").unlink()
            with self.assertRaisesRegex(RuntimeError, "Révision incomplète"):
                validate_publication(output)

    def test_compatibility_urls_are_exact_copies_of_latest_revision(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "public" / "data"
            candidate = root / "candidate"
            revision = "1" * 64
            write_candidate(candidate, revision, "2026-07-19T12:00:00Z")
            publish_candidate(output, candidate)
            revision_dir = output / "supaip" / "revisions" / revision
            self.assertEqual((output / "supaip-current.geojson").read_bytes(), (revision_dir / "data.geojson").read_bytes())
            self.assertEqual((output / "supaip-manifest.json").read_bytes(), (revision_dir / "manifest.json").read_bytes())
            self.assertEqual((output / "supaip-unmapped.json").read_bytes(), (revision_dir / "unmapped.json").read_bytes())

    def test_revision_and_generation_date_stay_stable_without_business_change(self):
        previous_revision = "9" * 64
        business_hash = "8" * 64
        selected = choose_dataset_revision(previous_revision, business_hash, business_hash)
        generated = choose_dataset_generated_at(
            previous_revision, selected, "2026-07-16T04:39:32Z", "2026-07-19T18:00:00Z"
        )
        self.assertEqual(selected, previous_revision)
        self.assertEqual(generated, "2026-07-16T04:39:32Z")

    def test_real_business_change_uses_new_revision_and_generation_date(self):
        previous_revision = "9" * 64
        selected = choose_dataset_revision(previous_revision, "8" * 64, "7" * 64)
        generated = choose_dataset_generated_at(
            previous_revision, selected, "2026-07-16T04:39:32Z", "2026-07-19T18:00:00Z"
        )
        self.assertEqual(selected, "7" * 64)
        self.assertEqual(generated, "2026-07-19T18:00:00Z")

    def test_business_revision_ignores_check_dates_and_parser_metadata(self):
        base_feature = feature()
        collection_a = {
            "type": "FeatureCollection",
            "generatedAt": "2026-07-16T04:39:32Z",
            "parserVersion": "parser-a",
            "features": [base_feature],
        }
        collection_b = json.loads(json.dumps(collection_a))
        collection_b["generatedAt"] = "2026-07-19T18:00:00Z"
        collection_b["parserVersion"] = "parser-b"
        collection_b["features"][0]["properties"]["sourceFingerprint"] = "different"
        manifest_a = [{"supAip": "001/26", "sourcePdf": OFFICIAL_PDF, "parserVersion": "parser-a"}]
        manifest_b = [{"supAip": "001/26", "sourcePdf": OFFICIAL_PDF, "parserVersion": "parser-b"}]
        self.assertEqual(
            compute_dataset_revision(collection_a, [], manifest_a),
            compute_dataset_revision(collection_b, [], manifest_b),
        )

    def test_business_revision_changes_when_vertical_limit_changes(self):
        collection_a = {"type": "FeatureCollection", "features": [feature(upper="FL 095")]}
        collection_b = {"type": "FeatureCollection", "features": [feature(upper="FL 105")]}
        self.assertNotEqual(
            compute_dataset_revision(collection_a, [], []),
            compute_dataset_revision(collection_b, [], []),
        )

    def test_duplicate_feature_id_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "public" / "data"
            candidate = root / "candidate"
            revision = "2" * 64
            write_candidate(candidate, revision, "2026-07-19T12:00:00Z")
            geo_path = candidate / "supaip-current.geojson"
            geo = json.loads(geo_path.read_text())
            geo["features"].append(json.loads(json.dumps(geo["features"][0])))
            geo_path.write_bytes(json_bytes(geo))
            with self.assertRaisesRegex(RuntimeError, "dupliqué"):
                publish_candidate(output, candidate)

    def test_missing_official_pdf_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "public" / "data"
            candidate = root / "candidate"
            revision = "3" * 64
            write_candidate(candidate, revision, "2026-07-19T12:00:00Z")
            geo_path = candidate / "supaip-current.geojson"
            geo = json.loads(geo_path.read_text())
            geo["features"][0]["properties"]["sourcePdf"] = "https://example.invalid/test.pdf"
            geo_path.write_bytes(json_bytes(geo))
            with self.assertRaisesRegex(RuntimeError, "PDF SIA officiel"):
                publish_candidate(output, candidate)

    def test_existing_revision_with_different_business_content_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "public" / "data"
            candidate = root / "candidate"
            revision = "a" * 64
            write_candidate(candidate, revision, "2026-07-19T12:00:00Z", upper="FL 095")
            publish_candidate(output, candidate)
            original = (
                output / "supaip" / "revisions" / revision / "data.geojson"
            ).read_bytes()
            write_candidate(candidate, revision, "2026-07-19T18:00:00Z", upper="FL 105")
            with self.assertRaisesRegex(RuntimeError, "contenu métier différent"):
                publish_candidate(output, candidate)
            self.assertEqual(
                (output / "supaip" / "revisions" / revision / "data.geojson").read_bytes(),
                original,
            )

    def test_unchanged_legacy_invalid_geometry_can_survive_migration(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "public" / "data"
            candidate = root / "candidate"
            first_revision = "4" * 64
            second_revision = "5" * 64
            write_candidate(candidate, first_revision, "2026-07-19T12:00:00Z", invalid=True)
            publish_candidate(output, candidate, allow_legacy_seed=True)
            write_candidate(candidate, second_revision, "2026-07-19T18:00:00Z", invalid=True)
            result = publish_candidate(output, candidate)
            self.assertEqual(result["datasetRevision"], second_revision)
            manifest = json.loads(
                (output / "supaip" / "revisions" / second_revision / "manifest.json").read_text()
            )
            self.assertEqual(len(manifest["legacyInvalidGeometryExceptions"]), 1)

    def test_changed_legacy_invalid_geometry_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "public" / "data"
            candidate = root / "candidate"
            first_revision = "6" * 64
            second_revision = "7" * 64
            write_candidate(candidate, first_revision, "2026-07-19T12:00:00Z", invalid=True)
            publish_candidate(output, candidate, allow_legacy_seed=True)
            write_candidate(candidate, second_revision, "2026-07-19T18:00:00Z", invalid=True)
            geo_path = candidate / "supaip-current.geojson"
            geo = json.loads(geo_path.read_text())
            geo["features"][0]["geometry"]["coordinates"][0][1] = [1.2, 1.0]
            geo_path.write_bytes(json_bytes(geo))
            with self.assertRaisesRegex(RuntimeError, "Nouvelle géométrie invalide rejetée"):
                publish_candidate(output, candidate)

    def test_incorrect_missing_vertical_notice_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "public" / "data"
            candidate = root / "candidate"
            revision = "8" * 64
            write_candidate(candidate, revision, "2026-07-19T12:00:00Z")
            geo_path = candidate / "supaip-current.geojson"
            geo = json.loads(geo_path.read_text())
            props = geo["features"][0]["properties"]
            props["verticalLimitsExtracted"] = False
            props["lowerLimit"] = ""
            props["upperLimit"] = ""
            props["verticalLimitNotice"] = "À vérifier - À vérifier"
            geo_path.write_bytes(json_bytes(geo))
            with self.assertRaisesRegex(RuntimeError, "Message de limites verticales incorrect"):
                publish_candidate(output, candidate)

    def test_status_counter_mismatch_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "public" / "data"
            candidate = root / "candidate"
            revision = "0" * 64
            write_candidate(candidate, revision, "2026-07-19T12:00:00Z")
            status_path = candidate / "supaip-status.json"
            status = json.loads(status_path.read_text())
            status["featureCount"] = 2
            status_path.write_bytes(json_bytes(status))
            with self.assertRaisesRegex(RuntimeError, "featureCount incohérent"):
                publish_candidate(output, candidate)


if __name__ == "__main__":
    unittest.main()
