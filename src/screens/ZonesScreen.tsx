import { useEffect, useState } from 'react';
import type { BranchZoneProfile } from '../domain/airspace.types';
import type { NavRoute } from '../domain/navigation.types';
import { Page } from '../components/layout/Page';
import { Card } from '../components/ui/Card';
import { VerticalProfileBanner } from '../components/navigation/VerticalProfileBanner';
import { buildZoneProfiles } from '../services/airspace/airspaceEngine';
import { fetchTerrainProfile, type TerrainSample } from '../services/navigation/terrainService';

interface ZonesScreenProps {
  route: NavRoute;
}

export function ZonesScreen({ route }: ZonesScreenProps) {
  const [profiles, setProfiles] = useState<Record<string, BranchZoneProfile>>({});
  const [status, setStatus] = useState('Calcul zones...');
  const [terrainSamples, setTerrainSamples] = useState<TerrainSample[]>([]);

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
    setTerrainSamples([]);

    fetchTerrainProfile(route)
      .then((samples) => {
        if (!cancelled) setTerrainSamples(samples);
      })
      .catch(() => {
        if (!cancelled) setTerrainSamples([]);
      });

    return () => {
      cancelled = true;
    };
  }, [route]);


  const activeZoneCount = Object.values(profiles).reduce((sum, profile) => sum + profile.activeBlocks.length, 0);

  return (
    <Page title="Zones" subtitle="Vue verticale des zones traversées selon la route et l'altitude.">
      <div className="zones-screen">
        <Card className="zone-banner-card">
          <div className="panel-title-row">
            <div>
              <span>Profil vertical</span>
              <strong>{activeZoneCount ? `${activeZoneCount} zones actives à l'altitude prévue` : status}</strong>
            </div>
          </div>
          <VerticalProfileBanner route={route} profiles={profiles} terrainSamples={terrainSamples} />
        </Card>
        <Card className="safety-card">
          <strong>Préparation</strong>
          <p>Les blocs représentent les espaces rencontrés par la route. La ligne cyan représente l'altitude prévue ; le relief IGN apparaît en bas quand disponible.</p>
        </Card>
      </div>
    </Page>
  );
}
