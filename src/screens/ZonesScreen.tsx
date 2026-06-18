import { Page } from '../components/layout/Page';
import { Card } from '../components/ui/Card';
import { ZoneRibbon } from '../components/navigation/ZoneRibbon';
import { mockZones } from '../data/mockZones';

export function ZonesScreen() {
  return (
    <Page title="Zones" subtitle="Bannière de synthèse à raccorder au moteur de calcul des superpositions.">
      <div className="zones-screen">
        <Card>
          <h2>Bannière zones</h2>
          <ZoneRibbon zones={mockZones} />
        </Card>
        <Card className="safety-card">
          <strong>Préparation</strong>
          <p>Cette vue prépare l’UX de synthèse. Les superpositions réelles seront calculées en interne dans une prochaine passe.</p>
        </Card>
      </div>
    </Page>
  );
}
