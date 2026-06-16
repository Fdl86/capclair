import { Page } from '../components/layout/Page';
import { Card } from '../components/ui/Card';
import { ZoneRibbon } from '../components/navigation/ZoneRibbon';
import { mockZones } from '../data/mockZones';

export function ZonesScreen() {
  return (
    <Page title="Calculs & zones" subtitle="Prototype du ruban horizontal de zones dans l’ordre de route.">
      <div className="zones-screen">
        <Card>
          <h2>Zones traversées</h2>
          <ZoneRibbon zones={mockZones} />
        </Card>
        <Card className="safety-card">
          <strong>À vérifier</strong>
          <p>Ces zones sont simulées. DEV01 prépare l’UX et la structure, sans données aéronautiques réelles exploitables.</p>
        </Card>
      </div>
    </Page>
  );
}
