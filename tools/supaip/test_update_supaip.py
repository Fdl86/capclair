import unittest

from tools.supaip.update_supaip import (
    ListingEntry,
    PdfBlock,
    PdfDocumentLayout,
    PdfPageLayout,
    classify_incomplete_causes,
    clean_listing_title,
    coordinate_matches,
    declared_zone_count,
    extract_vertical_pair,
    embedded_column_zones,
    column_cluster_zones,
    grid_zones,
    make_unique_feature_id,
    parse_listing,
    parse_spatial_document,
    preserve_cached_features_on_complete_regression,
    preserve_cached_features_on_partial_regression,
    is_spatial_document,
    ParsedZone,
    resolve_permanent_airspace_references,
    parse_spatial_pdf,
)


class SupAipParserTests(unittest.TestCase):
    def test_listing(self):
        html = '''
        <div class="item"><a href="/documents/download/f/d/123/">154/2026 Création de 2 ZRT test</a>
        <span>Valide du 2026-07-16 au 2027-07-14</span><span>IFR VFR AIRAC</span></div>
        <p>Date de dernière mise à jour de la liste : 09/07/2026</p>
        '''
        entries, updated = parse_listing(html)
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].sup_aip, "154/26")
        self.assertTrue(entries[0].vfr)
        self.assertEqual(updated, "2026-07-09T00:00:00Z")

    def test_listing_title_cleanup(self):
        self.assertEqual(clean_listing_title("<p>Création d\\'une ZRT</p>"), "Création d'une ZRT")

    def test_coordinate_formats(self):
        text = "47°44'58.00\" N 001°21'31.00\" E\n471933N 0022818W"
        matches = coordinate_matches(text)
        self.assertEqual(len(matches), 2)
        self.assertAlmostEqual(matches[0].lat, 47.749444, places=5)
        self.assertLess(matches[1].lon, 0)

    def test_vertical_formats(self):
        self.assertEqual(extract_vertical_pair("FL125/FL135"), ("FL 125", "FL 135"))
        self.assertEqual(
            extract_vertical_pair("1000 ft ASFC - 3100 ft AMSL / 6500 ft AMSL"),
            ("1000 ft ASFC - 3100 ft AMSL", "6500 ft AMSL"),
        )
        self.assertEqual(extract_vertical_pair("SFC - FL085"), ("SFC", "FL 085"))

    def test_declared_zone_count(self):
        self.assertEqual(
            declared_zone_count("Création de 95 zones réglementées temporaires et 4 zones dangereuses temporaires"),
            99,
        )
        self.assertEqual(declared_zone_count("Création de 16 ZRT et 4 ZDT"), 20)

    def test_polygon_pdf(self):
        entry = ListingEntry(
            sup_aip="153/26",
            title="Création d'une ZRT dans la région de BLOIS",
            valid_from="2026-07-20",
            valid_to="2026-12-24",
            pdf_url="https://example.invalid/153.pdf",
            vfr=True,
            fingerprint="abc",
        )
        text = '''
        ZRT BLOIS
        DATES ET HEURES D'ACTIVITÉ
        Du 20 juillet au 24 décembre, activable de SR à SS.
        INFORMATION DES USAGERS
        BLOIS INFO : 118,455 MHz
        LIMITES LATERALES ET VERTICALES
        ZRT BLOIS
        LIMITES LATÉRALES
        47°44'58.00" N 001°21'31.00" E
        47°44'58.00" N 000°59'17.00" E
        47°26'32.00" N 000°55'58.00" E
        47°26'32.00" N 001°12'27.00" E
        47°44'58.00" N 001°21'31.00" E
        LIMITES VERTICALES
        FL 050 / FL 110
        ORGANISME A CONTACTER
        '''
        features, warnings = parse_spatial_pdf(entry, text)
        self.assertEqual(len(features), 1)
        self.assertEqual(features[0]["properties"]["name"], "ZRT BLOIS")
        self.assertEqual(features[0]["properties"]["lowerLimit"], "FL 050")
        self.assertTrue(features[0]["properties"]["verticalLimitsExtracted"])
        self.assertIsNone(features[0]["properties"]["verticalLimitNotice"])
        self.assertFalse(warnings)

    def test_grid_layout_keeps_columns_and_vertical_limits_together(self):
        page = PdfPageLayout(
            page_index=0,
            width=600,
            height=800,
            blocks=(
                PdfBlock(0, 40, 50, 180, 70, "ZRT ALPHA"),
                PdfBlock(0, 320, 50, 460, 70, "ZRT BRAVO"),
                PdfBlock(0, 70, 90, 170, 110, "LIMITES LATÉRALES"),
                PdfBlock(0, 350, 90, 450, 110, "LIMITES LATÉRALES"),
                PdfBlock(0, 60, 115, 250, 260, "47°00'00'' N - 001°00'00'' E\n47°10'00'' N - 001°00'00'' E\n47°00'00'' N - 001°10'00'' E"),
                PdfBlock(0, 340, 115, 530, 260, "48°00'00'' N - 002°00'00'' E\n48°10'00'' N - 002°00'00'' E\n48°00'00'' N - 002°10'00'' E"),
                PdfBlock(0, 60, 270, 250, 290, "SFC / FL 065"),
                PdfBlock(0, 340, 270, 530, 290, "2500 FT AMSL / FL 095"),
            ),
        )
        zones = grid_zones(page)
        self.assertEqual(len(zones), 2)
        self.assertEqual(zones[0].name, "ZRT ALPHA")
        self.assertEqual((zones[0].lower_limit, zones[0].upper_limit), ("SFC", "FL 065"))
        self.assertEqual((zones[1].lower_limit, zones[1].upper_limit), ("2500 ft AMSL", "FL 095"))


    def test_embedded_column_cells_with_detached_verticals(self):
        page = PdfPageLayout(
            page_index=3,
            width=595,
            height=842,
            blocks=(
                PdfBlock(3, 74, 72, 367, 228, "LIMITES LATERALES ET VERTICALES\nZDT LFDB11\nLimites latérales\n45°43'58'' N,002°49'59'' W\n45°17'34'' N,002°53'08'' W\n44°04'43'' N,003°01'47'' W\n45°43'58'' N,002°49'59'' W\nLimites verticales"),
                PdfBlock(3, 102, 228, 136, 239, "SFC/UNL"),
                PdfBlock(3, 195, 83, 287, 228, "ZRT/ZDT LFDB21\nLimites latérales\n45°47'52'' N,001°17'25'' W\n45°33'39'' N,001°10'20'' W\n45°33'40'' N,001°56'00'' W\n45°47'52'' N,001°17'25'' W\nLimites verticales"),
                PdfBlock(3, 223, 228, 257, 239, "SFC/UNL"),
            ),
        )
        zones = embedded_column_zones(page)
        self.assertEqual([zone.name for zone in zones], ["ZDT LFDB11", "ZRT/ZDT LFDB21"])
        self.assertTrue(all(zone.geometry for zone in zones))
        self.assertTrue(all(zone.vertical_extracted for zone in zones))
        self.assertEqual((zones[0].lower_limit, zones[0].upper_limit), ("SFC", "UNL"))

    def test_compact_tra_codes_in_two_column_table(self):
        page = PdfPageLayout(
            page_index=1,
            width=600,
            height=800,
            blocks=(
                PdfBlock(1, 140, 50, 460, 70, "TRA90NL\nTRA90NH"),
                PdfBlock(1, 90, 90, 220, 110, "LIMITES LATÉRALES"),
                PdfBlock(1, 370, 90, 500, 110, "LIMITES LATÉRALES"),
                PdfBlock(1, 90, 115, 250, 250, "47°00'00'' N, 001°00'00'' W\n47°10'00'' N, 001°00'00'' W\n47°00'00'' N, 001°10'00'' W"),
                PdfBlock(1, 350, 115, 520, 250, "47°00'00'' N, 001°00'00'' W\n47°10'00'' N, 001°00'00'' W\n47°00'00'' N, 001°10'00'' W"),
                PdfBlock(1, 100, 260, 230, 280, "FL195 / FL275"),
                PdfBlock(1, 370, 260, 500, 280, "FL305 / FL335"),
            ),
        )
        zones = grid_zones(page)
        self.assertEqual([zone.name for zone in zones], ["TRA90NL", "TRA90NH"])
        self.assertEqual((zones[0].lower_limit, zones[0].upper_limit), ("FL 195", "FL 275"))
        self.assertEqual((zones[1].lower_limit, zones[1].upper_limit), ("FL 305", "FL 335"))

    def test_temporary_lfr_codes_in_three_column_table(self):
        page = PdfPageLayout(
            page_index=2,
            width=600,
            height=800,
            blocks=(
                PdfBlock(2, 100, 70, 500, 90, "LFR343L\nLFR343M\nLFR343H"),
                PdfBlock(2, 50, 100, 190, 240, "LIMITES LATÉRALES\n45°00'00'' N,001°00'00'' E\n45°10'00'' N,001°00'00'' E\n45°00'00'' N,001°10'00'' E"),
                PdfBlock(2, 230, 100, 370, 240, "LIMITES LATÉRALES\n46°00'00'' N,001°00'00'' E\n46°10'00'' N,001°00'00'' E\n46°00'00'' N,001°10'00'' E"),
                PdfBlock(2, 410, 100, 550, 240, "LIMITES LATÉRALES\n47°00'00'' N,001°00'00'' E\n47°10'00'' N,001°00'00'' E\n47°00'00'' N,001°10'00'' E"),
                PdfBlock(2, 80, 250, 170, 270, "FL165 / FL195"),
                PdfBlock(2, 260, 250, 350, 270, "FL195 / FL245"),
                PdfBlock(2, 440, 250, 520, 270, "FL395 / UNL"),
            ),
        )
        zones = column_cluster_zones(page)
        self.assertEqual([zone.name for zone in zones], ["LFR343L", "LFR343M", "LFR343H"])
        self.assertTrue(all(zone.geometry for zone in zones))
        self.assertTrue(all(zone.zone_type == "ZRT" for zone in zones))

    def test_fbz_pages_are_not_published_as_operational_tra(self):
        operational_page = PdfPageLayout(
            page_index=0,
            width=600,
            height=800,
            blocks=(
                PdfBlock(0, 140, 50, 460, 70, "TRA90NL\nTRA90NH"),
                PdfBlock(0, 90, 90, 220, 110, "LIMITES LATÉRALES"),
                PdfBlock(0, 370, 90, 500, 110, "LIMITES LATÉRALES"),
                PdfBlock(0, 90, 115, 250, 250, "47°00'00'' N, 001°00'00'' W\n47°10'00'' N, 001°00'00'' W\n47°00'00'' N, 001°10'00'' W"),
                PdfBlock(0, 350, 115, 520, 250, "47°00'00'' N, 001°00'00'' W\n47°10'00'' N, 001°00'00'' W\n47°00'00'' N, 001°10'00'' W"),
                PdfBlock(0, 100, 260, 230, 280, "FL195 / FL275"),
                PdfBlock(0, 370, 260, 500, 280, "FL305 / FL335"),
            ),
        )
        fbz_heading_page = PdfPageLayout(
            page_index=1,
            width=600,
            height=800,
            blocks=(PdfBlock(1, 40, 50, 560, 80, "ZONES TAMPON ASSOCIÉES (FBZ - FLIGHT BUFFER ZONE)"),),
        )
        fbz_page = PdfPageLayout(
            page_index=2,
            width=600,
            height=800,
            blocks=(
                PdfBlock(2, 40, 50, 200, 300, "TRA90NLZ\n47°00'00'' N, 001°00'00'' W\n47°10'00'' N, 001°00'00'' W\n47°00'00'' N, 001°10'00'' W\nFL195 / FL275"),
            ),
        )
        document = PdfDocumentLayout(
            text="TRA90NL\nTRA90NH\nZONES TAMPON ASSOCIÉES (FBZ - FLIGHT BUFFER ZONE)\nTRA90NLZ",
            pages=(operational_page, fbz_heading_page, fbz_page),
        )
        entry = ListingEntry("023/26", "Création de deux TRA et FBZ associées", "2026-03-19", "2027-03-17", "https://example.invalid", True, "023")
        result = parse_spatial_document(entry, document)
        self.assertEqual({feature["properties"]["name"] for feature in result.features}, {"TRA90NL", "TRA90NH"})


    def test_previous_valid_geometry_is_preserved_on_complete_parser_regression(self):
        entry = ListingEntry(
            "023/26",
            "Création de deux TRA",
            "2026-03-19",
            "2027-03-17",
            "https://example.invalid/023.pdf",
            True,
            "new-fingerprint",
        )
        cached = [{
            "type": "Feature",
            "id": "023-26-tra90nl",
            "properties": {
                "id": "023-26-tra90nl",
                "name": "TRA90NL",
                "supAip": "023/26",
                "sourceFingerprint": "old",
                "parserVersion": "old-parser",
                "geometryWarnings": [],
                "verticalLimitsExtracted": True,
                "lowerLimit": "FL 195",
                "upperLimit": "FL 275",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[-1.0, 47.0], [-0.8, 47.0], [-0.9, 46.8], [-1.0, 47.0]]],
            },
        }]
        manifest = {
            "title": entry.title,
            "sourcePdf": entry.pdf_url,
            "expectedNamedGeometryCount": 1,
        }
        recovered, used = preserve_cached_features_on_complete_regression(entry, [], cached, manifest)
        self.assertTrue(used)
        self.assertEqual(len(recovered), 1)
        self.assertEqual(recovered[0]["properties"]["sourceFingerprint"], "new-fingerprint")
        self.assertEqual(recovered[0]["properties"]["geometrySource"], "previous-parser-safety-fallback")
        self.assertEqual(cached[0]["properties"]["sourceFingerprint"], "old")

    def test_previous_individual_geometry_is_preserved_on_partial_parser_regression(self):
        entry = ListingEntry("207/25", "Création de zones LFDB", "2025-01-01", "2027-01-01", "https://example.invalid/207.pdf", True, "new")
        geometry = {"type": "Polygon", "coordinates": [[[-2.0, 47.0], [-1.9, 47.0], [-1.9, 47.1], [-2.0, 47.0]]]}
        cached = [
            {"type": "Feature", "id": "a", "properties": {"name": "ZRT LFDB21", "geometryWarnings": []}, "geometry": geometry},
            {"type": "Feature", "id": "b", "properties": {"name": "ZRT LFDB22", "geometryWarnings": []}, "geometry": geometry},
        ]
        parsed = [{"type": "Feature", "id": "a", "properties": {"name": "ZRT LFDB21"}, "geometry": geometry}]
        manifest = {"title": entry.title, "sourcePdf": entry.pdf_url}
        recovered, count = preserve_cached_features_on_partial_regression(entry, parsed, cached, manifest)
        self.assertEqual(count, 1)
        self.assertEqual(len(recovered), 2)
        self.assertEqual(recovered[1]["properties"]["geometrySource"], "previous-parser-partial-safety-fallback")

    def test_helicopter_route_document_is_not_classified_as_spatial_zone(self):
        entry = ListingEntry(
            "075/26",
            "Modification temporaire de l'itinéraire hélicoptères en CTR Paris entre LFPI et IH3",
            "2026-01-01",
            "2026-12-31",
            "https://example.invalid/075.pdf",
            True,
            "x",
        )
        document = PdfDocumentLayout("CTR PARIS LIMITES LATERALES", tuple())
        self.assertFalse(is_spatial_document(entry, document))

    def test_reference_to_permanent_airspace_uses_cap_clair_catalog(self):
        zone = ParsedZone(name="ZRT TEST", zone_type="ZRT", geometry=None)
        resolve_permanent_airspace_references(
            [zone],
            "Les limites latérales sont identiques à celles de la zone LF-R 260.",
        )
        self.assertIsNotNone(zone.geometry)
        self.assertEqual(zone.geometry["type"], "Polygon")
        self.assertTrue(any("LF-R260" in warning for warning in zone.warnings))

    def test_duplicate_truncated_zone_names_receive_unique_ids(self):
        used_ids: set[str] = set()
        common_prefix = "ZRT DSV ROMORANTIN " * 8
        geometry_a = {"type": "Polygon", "coordinates": [[[1.0, 47.0], [1.1, 47.0], [1.1, 47.1], [1.0, 47.0]]]}
        geometry_b = {"type": "Polygon", "coordinates": [[[1.2, 47.2], [1.3, 47.2], [1.3, 47.3], [1.2, 47.2]]]}

        first = make_unique_feature_id("094/25", f"{common_prefix}DELTA", geometry_a, "SFC", "FL 050", used_ids)
        second = make_unique_feature_id("094/25", f"{common_prefix}ECHO", geometry_b, "SFC", "FL 060", used_ids)
        third = make_unique_feature_id("094/25", f"{common_prefix}ECHO", geometry_b, "SFC", "FL 060", used_ids)

        self.assertEqual(len({first, second, third}), 3)
        self.assertLessEqual(max(map(len, (first, second, third))), 96)
        self.assertRegex(second, r"-[0-9a-f]{12}$")
        self.assertRegex(third, r"-[0-9a-f]{12}-2$")


    def test_incomplete_cause_classification(self):
        causes = classify_incomplete_causes(
            parsed_features=[{"type": "Feature"}],
            warnings=[
                "ZRT TEST: Exclusion interne non découpée: contour extérieur affiché par prudence.",
                "ZRT BRAVO: limites latérales non extraites.",
            ],
            expected_named_count=2,
            missing_vertical_count=1,
            used_safety_fallback=False,
        )
        self.assertEqual(
            set(causes),
            {
                "lateral-boundary-not-extracted",
                "internal-exclusion-not-cut",
                "named-geometry-missing",
                "vertical-limit-not-extracted",
            },
        )
        self.assertEqual(
            classify_incomplete_causes([], [], 0, 0, False),
            ["zone-block-not-detected"],
        )

    def test_circle_pdf(self):
        entry = ListingEntry("154/26", "Création ZRT", "2026-07-16", "2027-07-14", "https://example.invalid", True, "def")
        text = '''
        ZRT MAGNAC ALPHA
        LIMITES LATERALES ET VERTICALES
        ZRT MAGNAC ALPHA
        LIMITES LATÉRALES
        cercle de 0.54 NM de rayon centré sur 45°29'25''N, 000°15'09''E
        LIMITES VERTICALES
        SFC / 2200 FT AMSL
        '''
        features, _ = parse_spatial_pdf(entry, text)
        self.assertEqual(len(features), 1)
        self.assertGreater(len(features[0]["geometry"]["coordinates"][0]), 90)


if __name__ == "__main__":
    unittest.main()
