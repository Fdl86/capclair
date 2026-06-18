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
          <h2>Log de nav</h2>
          <p>Tableau complet avec altitude, vent, route vraie, variation, route magnétique, cap et vitesse sol.</p>
          <Button variant="secondary" onClick={() => onNavigate('calculations')}>Ouvrir le log</Button>
        </Card>
        <Card>
          <h2>Zones</h2>
          <p>Bannière de synthèse des superpositions de zones, à raccorder au moteur interne.</p>
          <Button variant="secondary" onClick={() => onNavigate('zones')}>Ouvrir les zones</Button>
        </Card>
        <Card>
          <h2>Traces</h2>
          <p>Historique des suivis GPS enregistrés.</p>
          <Button variant="secondary" onClick={() => onNavigate('traces')}>Ouvrir les traces</Button>
        </Card>
        <Card className="safety-card">
          <strong>Limites</strong>
          <p>Prototype non réglementaire. Pas de NOTAM, pas de météo complète, pas de GPS en arrière-plan.</p>
        </Card>
      </div>
    </Page>
  );
}
