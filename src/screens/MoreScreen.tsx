import type { ScreenId } from '../app/routes';
import { Page } from '../components/layout/Page';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

interface MoreScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

export function MoreScreen({ onNavigate }: MoreScreenProps) {
  return (
    <Page title="Plus" subtitle="Accès rapide aux vues de préparation DEV01.">
      <div className="more-grid">
        <Card>
          <h2>Calculs</h2>
          <p>Log de navigation, branches, caps et estimations mockées.</p>
          <Button variant="secondary" onClick={() => onNavigate('calculations')}>Ouvrir les calculs</Button>
        </Card>
        <Card>
          <h2>Zones</h2>
          <p>Ruban de zones prototype avec statuts Traversée, Proche et Libre.</p>
          <Button variant="secondary" onClick={() => onNavigate('zones')}>Ouvrir les zones</Button>
        </Card>
        <Card className="safety-card">
          <strong>Limites DEV01</strong>
          <p>Pas de navigation réelle, pas de météo réelle, pas de NOTAM, pas de compte utilisateur, pas de GPS en arrière-plan.</p>
        </Card>
      </div>
    </Page>
  );
}
