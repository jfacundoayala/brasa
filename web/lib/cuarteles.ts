// Cuarteles de Bomberos Voluntarios de la Federación de Salta, según el Consejo Nacional
// (https://www.bomberosra.org.ar/federaciones_ta/federacion-de-salta, leído el 12/11/2026: 25 asociaciones).
// La ubicación es la del centro de la localidad (aproximada), no la del cuartel. Sirve de referencia:
// quién interviene en un incendio lo coordina Defensa Civil de Salta.

export type cuartel = { nombre: string; localidad: string; lat: number; lon: number };

export const CUARTELES: cuartel[] = [
  { nombre: "Bomberos Voluntarios de Aguaray", localidad: "Aguaray", lat: -22.237, lon: -63.73 },
  { nombre: "Bomberos Voluntarios de Aguas Blancas", localidad: "Aguas Blancas", lat: -22.727, lon: -64.367 },
  { nombre: "Bomberos Voluntarios de Apolinario Saravia", localidad: "Apolinario Saravia", lat: -24.437, lon: -63.996 },
  { nombre: "Bomberos Voluntarios de Cachi", localidad: "Cachi", lat: -25.12, lon: -66.163 },
  { nombre: "Bomberos Voluntarios de Cerrillos", localidad: "Cerrillos", lat: -24.9, lon: -65.488 },
  { nombre: "Bomberos Voluntarios de Colonia Santa Rosa", localidad: "Colonia Santa Rosa", lat: -23.39, lon: -64.43 },
  { nombre: "Bomberos Voluntarios de El Carril", localidad: "El Carril", lat: -25.075, lon: -65.494 },
  { nombre: "Bomberos Voluntarios de Embarcación", localidad: "Embarcación", lat: -23.21, lon: -64.093 },
  { nombre: "Bomberos Voluntarios de General Mosconi", localidad: "General Mosconi", lat: -22.596, lon: -63.81 },
  { nombre: "Bomberos Voluntarios de General Güemes", localidad: "General Güemes", lat: -24.668, lon: -65.048 },
  { nombre: "Bomberos Voluntarios de Hipólito Yrigoyen", localidad: "Hipólito Yrigoyen", lat: -23.24, lon: -64.274 },
  { nombre: "Bomberos Voluntarios 8 de Agosto", localidad: "Joaquín V. González", lat: -25.08, lon: -64.183 },
  { nombre: "Bomberos Voluntarios Papa Francisco", localidad: "La Caldera", lat: -24.603, lon: -65.385 },
  { nombre: "Bomberos Voluntarios Juana Azurduy", localidad: "Las Lajitas", lat: -24.729, lon: -64.25 },
  { nombre: "Bomberos Voluntarios de Orán", localidad: "San Ramón de la Nueva Orán", lat: -23.137, lon: -64.324 },
  { nombre: "Bomberos Voluntarios de Salvador Mazza", localidad: "Profesor Salvador Mazza", lat: -22.05, lon: -63.69 },
  { nombre: "Bomberos Voluntarios de Rosario de la Frontera", localidad: "Rosario de la Frontera", lat: -25.797, lon: -64.97 },
  { nombre: "Bomberos Voluntarios Hernando de Lerma", localidad: "Rosario de Lerma", lat: -24.979, lon: -65.578 },
  { nombre: "Bomberos Voluntarios de Salta (3 asociaciones en la capital)", localidad: "Salta Capital", lat: -24.789, lon: -65.41 },
  { nombre: "Bomberos Voluntarios de San Antonio de los Cobres", localidad: "San Antonio de los Cobres", lat: -24.218, lon: -66.317 },
  { nombre: "Bomberos Voluntarios de San José de Metán", localidad: "San José de Metán", lat: -25.496, lon: -64.973 },
  { nombre: "Bomberos Voluntarios de Tartagal", localidad: "Tartagal", lat: -22.516, lon: -63.801 },
  { nombre: "Bomberos Voluntarios 2 de Junio", localidad: "Vaqueros", lat: -24.695, lon: -65.4 },
];

/** Distancia en línea recta, en km. */
export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (g: number) => (g * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** El cuartel cuya localidad está más cerca del incendio (referencia, no una asignación oficial). */
export function cuartelCercano(lat: number, lon: number): { cuartel: cuartel; km: number } {
  let mejor = { cuartel: CUARTELES[0], km: Infinity };
  for (const c of CUARTELES) {
    const km = distanciaKm(lat, lon, c.lat, c.lon);
    if (km < mejor.km) mejor = { cuartel: c, km };
  }
  return mejor;
}
