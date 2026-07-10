import type { NavRoute } from '../../domain/navigation.types';

export function routeHasDeparture(route: NavRoute): boolean {
  return route.points.some((point) => point.type === 'depart');
}

export function routeHasDestination(route: NavRoute): boolean {
  return route.points.some((point) => point.type === 'destination');
}

export function isRouteReady(route: NavRoute): boolean {
  return routeHasDeparture(route) && routeHasDestination(route) && route.branches.length > 0;
}

export function routeMissingMessage(route: NavRoute): string {
  const hasDeparture = routeHasDeparture(route);
  const hasDestination = routeHasDestination(route);
  if (!hasDeparture && !hasDestination) return 'Définissez un départ et une arrivée.';
  if (!hasDeparture) return 'Définissez un départ.';
  if (!hasDestination) return 'Définissez une arrivée.';
  return 'La route doit contenir au moins une branche exploitable.';
}
