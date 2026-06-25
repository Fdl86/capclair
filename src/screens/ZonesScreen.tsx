import { useEffect, useState } from 'react';
import type { BranchZoneProfile } from '../domain/airspace.types';
import type { NavRoute } from '../domain/navigation.types';
import { Page } from '../components/layout/Page';
import { Card } from '../components/ui/Card';
import { ZoneCompleteRouteBanner } from '../components/navigation/ZoneCompleteRouteBanner';
import { buildZoneProfiles } from '../services/airspace/airspaceEngine';
import { fetchTerrainProfile, type TerrainSample } from '../services/navigation/terrainService';

interface ZonesScreenProps {
  route: NavRoute;
}

export function ZonesScreen({ route }: ZonesScreenProps) {
  const [profiles, setProfiles] = useState<Record<string, BranchZoneProfile>>({});
  const [status, setStatus] = useState('Calcul zones...');
  const [terrain, setTerrain] = useState<TerrainSample[]>([]);

  useEffect(() => {
    let cancelled = false;
    setStatus('Calcul zones...');
    buildZoneProfiles(route)
      .then((nextProfiles) => {
        if (cancelled) return;
        setProfiles(nextProfiles);
        setStatus('Zones calculées');
      })
      .catch(() => {
        if (cancelled) return;
        setProfiles({});
        setStatus('Zones à confirmer');
      });

    return () => {
      cancelled = true;
    };
  }, [route]);

  useEffect(() => {
    let cancelled = false;
    fetchTerrainProfile(route)
      .then((samples) => {
        if (!cancelled) setTerrain(samples);
      })
      .catch(() => {
        if (!cancelled) setTerrain([]);
      });

    return () => {
      cancelled = true;
    };
  }, [route]);

  const activeZoneCount = Object.values(profiles).reduce((sum, profile) => sum + profile.activeBlocks.length, 0);

  return (
    <Page title="Zones" subtitle="Vue verticale des zones traversées et du relief le long de la route.">
      <div className="zones-screen">
        <Card className="zone-banner-card">
          <div className="panel-title-row">
            <div>
              <span>Bannière zones</span>
              <strong>{activeZoneCount ? `${activeZoneCount} zones actives à l'altitude prévue` : status}</strong>
            </div>
          </div>
          {Object.keys(profiles).length ? (
            <ZoneCompleteRouteBanner route={route} profiles={profiles} terrain={terrain} />
          ) : (
            <div className="zone-banner-loading">{status}</div>
          )}
        </Card>
        <Card className="safety-card">
          <strong>Préparation</strong>
          <p>Les blocs représentent les espaces rencontrés par la route. La ligne cyan représente l'altitude prévue, la silhouette en bas le relief (RGE ALTI IGN).</p>
        </Card>
      </div>
    </Page>
  );
}
