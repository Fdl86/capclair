import unittest

from tools.supaip.update_supaip import (
    ListingEntry,
    coordinate_matches,
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

    def test_coordinate_formats(self):
        text = "47°44'58.00\" N 001°21'31.00\" E\n471933N 0022818W"
        matches = coordinate_matches(text)
        self.assertEqual(len(matches), 2)
        self.assertAlmostEqual(matches[0].lat, 47.749444, places=5)
        self.assertLess(matches[1].lon, 0)

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
        self.assertFalse(warnings)

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
