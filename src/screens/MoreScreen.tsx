import type { ScreenId } from '../app/routes';
import { Page } from '../components/layout/Page';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

interface MoreScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

export function MoreScreen({ onNavigate }: MoreScreenProps) {
  return (
    <Page title="Plus" subtitle="Accès rapide aux outils de préparation.">
      <div className="more-grid">
        <Card>
          <h2>Calculs</h2>
          <p>Log de navigation, distances, routes vraies et routes magnétiques.</p>
          <Button variant="secondary" onClick={() => onNavigate('calculations')}>Ouvrir les calculs</Button>
        </Card>
        <Card>
          <h2>Zones</h2>
          <p>Bannière de synthèse des superpositions de zones, à raccorder au moteur interne.</p>
          <Button variant="secondary" onClick={() => onNavigate('zones')}>Ouvrir les zones</Button>
        </Card>
        <Card className="safety-card">
          <strong>Limites</strong>
          <p>Prototype non réglementaire. Pas de NOTAM, pas de météo réelle, pas de GPS en arrière-plan.</p>
        </Card>
      </div>
    </Page>
  );
}
