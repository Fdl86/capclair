import unittest

from tools.supaip.update_supaip import (
    ListingEntry,
    PdfBlock,
    PdfPageLayout,
    clean_listing_title,
    coordinate_matches,
    declared_zone_count,
    extract_vertical_pair,
    grid_zones,
    make_unique_feature_id,
    parse_listing,
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
