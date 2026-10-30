/**
 * Catálogo semilla de cursos de posgrado del Departamento de Ingeniería de
 * Sistemas y Computación (DISC) para el programa Coterminal y las Líneas de
 * Profundización del pregrado. Datos de referencia (read-only).
 */

export type Maestria = 'MISIS' | 'MINE' | 'MATI' | 'MESI' | 'MAIA' | 'MISO';

/** Clasificación del curso dentro de una maestría. */
export type ClasificacionMaestria =
  | 'Fundamentación'
  | 'Profundización'
  | 'Complemento';

export interface DiscCourse {
  codigo: string;
  nombre: string;
  creditos: number;
  /** Área temática (track de énfasis de pregrado). */
  area:
    | 'Inteligencia Artificial y Datos'
    | 'Arquitectura, Cloud y Distribución'
    | 'Ciberseguridad, Redes e Infraestructura'
    | 'Computación Visual, Interactiva y Videojuegos';
  /** Clasificación por maestría: a qué sirve cada curso. */
  clasificaciones: { maestria: Maestria; tipo: ClasificacionMaestria }[];
}

/** Maestrías del DISC (para el selector de coterminal). */
export const MAESTRIAS: { codigo: Maestria; nombre: string }[] = [
  { codigo: 'MISIS', nombre: 'Maestría en Ingeniería de Sistemas y Computación' },
  { codigo: 'MINE', nombre: 'Maestría en Ingeniería de Información' },
  { codigo: 'MATI', nombre: 'Maestría en Arquitectura de Tecnologías de Información' },
  { codigo: 'MESI', nombre: 'Maestría en Seguridad de la Información' },
  { codigo: 'MAIA', nombre: 'Maestría en Inteligencia Artificial' },
];

/** Créditos de posgrado objetivo típicos para coterminal. */
export const CREDITOS_POSGRADO_OBJETIVO = 40;

export const DISC_COURSES: DiscCourse[] = [
  // ---------- Inteligencia Artificial y Datos ----------
  {
    codigo: 'ISIS-4219',
    nombre: 'Machine Learning Techniques',
    creditos: 4,
    area: 'Inteligencia Artificial y Datos',
    clasificaciones: [
      { maestria: 'MISIS', tipo: 'Profundización' },
      { maestria: 'MISO', tipo: 'Profundización' },
    ],
  },
  {
    codigo: 'ISIS-4221',
    nombre: 'Procesamiento de Lenguaje Natural',
    creditos: 4,
    area: 'Inteligencia Artificial y Datos',
    clasificaciones: [{ maestria: 'MISIS', tipo: 'Profundización' }],
  },
  {
    codigo: 'ISIS-4222',
    nombre: 'Reinforcement Learning',
    creditos: 4,
    area: 'Inteligencia Artificial y Datos',
    clasificaciones: [
      { maestria: 'MISIS', tipo: 'Profundización' },
      { maestria: 'MISO', tipo: 'Profundización' },
    ],
  },
  {
    codigo: 'ISIS-4225',
    nombre: 'Mastering Machine Learning, Generative Models',
    creditos: 4,
    area: 'Inteligencia Artificial y Datos',
    clasificaciones: [{ maestria: 'MISIS', tipo: 'Profundización' }],
  },
  {
    codigo: 'ISIS-4822',
    nombre: 'Visual Analytics',
    creditos: 4,
    area: 'Inteligencia Artificial y Datos',
    clasificaciones: [{ maestria: 'MISIS', tipo: 'Profundización' }],
  },
  {
    codigo: 'MAIA-4321',
    nombre: 'Visión Artificial I',
    creditos: 4,
    area: 'Inteligencia Artificial y Datos',
    clasificaciones: [{ maestria: 'MAIA', tipo: 'Profundización' }],
  },
  {
    codigo: 'MAIA-4322',
    nombre: 'Visión Artificial II',
    creditos: 4,
    area: 'Inteligencia Artificial y Datos',
    clasificaciones: [{ maestria: 'MAIA', tipo: 'Profundización' }],
  },
  {
    codigo: 'MAIA-4101',
    nombre: 'Ética de la Inteligencia Artificial',
    creditos: 2,
    area: 'Inteligencia Artificial y Datos',
    clasificaciones: [{ maestria: 'MAIA', tipo: 'Fundamentación' }],
  },

  // ---------- Arquitectura, Cloud y Distribución ----------
  {
    codigo: 'ISIS-4426',
    nombre: 'Desarrollo de Soluciones Cloud',
    creditos: 4,
    area: 'Arquitectura, Cloud y Distribución',
    clasificaciones: [
      { maestria: 'MISIS', tipo: 'Profundización' },
      { maestria: 'MISO', tipo: 'Fundamentación' },
    ],
  },
  {
    codigo: 'ARTI-4207',
    nombre: 'Architecting for the Cloud',
    creditos: 4,
    area: 'Arquitectura, Cloud y Distribución',
    clasificaciones: [
      { maestria: 'MATI', tipo: 'Profundización' },
      { maestria: 'MISIS', tipo: 'Complemento' },
    ],
  },
  {
    codigo: 'ARTI-4109',
    nombre: 'Arquitectura de Software',
    creditos: 4,
    area: 'Arquitectura, Cloud y Distribución',
    clasificaciones: [
      { maestria: 'MATI', tipo: 'Fundamentación' },
      { maestria: 'MISO', tipo: 'Fundamentación' },
    ],
  },
  {
    codigo: 'ARTI-4208',
    nombre: 'Arquitecturas de Nueva Generación',
    creditos: 4,
    area: 'Arquitectura, Cloud y Distribución',
    clasificaciones: [
      { maestria: 'MATI', tipo: 'Profundización' },
      { maestria: 'MISIS', tipo: 'Complemento' },
    ],
  },
  {
    codigo: 'ARTI-4219',
    nombre: 'Arquitectura de Plataformas',
    creditos: 4,
    area: 'Arquitectura, Cloud y Distribución',
    clasificaciones: [
      { maestria: 'MATI', tipo: 'Profundización' },
      { maestria: 'MISIS', tipo: 'Complemento' },
    ],
  },
  {
    codigo: 'ISIS-4218',
    nombre: 'Concurrencia y Distribución',
    creditos: 4,
    area: 'Arquitectura, Cloud y Distribución',
    clasificaciones: [{ maestria: 'MISIS', tipo: 'Profundización' }],
  },
  {
    codigo: 'ISIS-4226',
    nombre: 'AI For Software Engineering',
    creditos: 4,
    area: 'Arquitectura, Cloud y Distribución',
    clasificaciones: [{ maestria: 'MISIS', tipo: 'Profundización' }],
  },

  // ---------- Ciberseguridad, Redes e Infraestructura ----------
  {
    codigo: 'ISIS-4224',
    nombre: 'Tópicos Modernos en Criptografía',
    creditos: 4,
    area: 'Ciberseguridad, Redes e Infraestructura',
    clasificaciones: [{ maestria: 'MISIS', tipo: 'Profundización' }],
  },
  {
    codigo: 'ISIS-4430',
    nombre: 'Seguridad y Privacidad en Sistemas IIoT y IoT',
    creditos: 4,
    area: 'Ciberseguridad, Redes e Infraestructura',
    clasificaciones: [
      { maestria: 'MESI', tipo: 'Profundización' },
      { maestria: 'MISIS', tipo: 'Profundización' },
    ],
  },
  {
    codigo: 'ISIS-4223',
    nombre: 'Internet de las Cosas',
    creditos: 4,
    area: 'Ciberseguridad, Redes e Infraestructura',
    clasificaciones: [{ maestria: 'MISIS', tipo: 'Profundización' }],
  },
  {
    codigo: 'ARTI-4204',
    nombre: 'Arquitectura de Seguridad',
    creditos: 4,
    area: 'Ciberseguridad, Redes e Infraestructura',
    clasificaciones: [
      { maestria: 'MATI', tipo: 'Profundización' },
      { maestria: 'MISIS', tipo: 'Complemento' },
    ],
  },
  {
    codigo: 'ISIS-4423',
    nombre: 'Tecnologías para el Diseño de Redes LAN y WAN',
    creditos: 4,
    area: 'Ciberseguridad, Redes e Infraestructura',
    clasificaciones: [{ maestria: 'MISIS', tipo: 'Profundización' }],
  },

  // ---------- Computación Visual, Interactiva y Videojuegos ----------
  {
    codigo: 'ISIS-4814',
    nombre: 'Desarrollo de Aplicaciones Realidad Mixta',
    creditos: 4,
    area: 'Computación Visual, Interactiva y Videojuegos',
    clasificaciones: [{ maestria: 'MISIS', tipo: 'Profundización' }],
  },
  {
    codigo: 'ISIS-4823',
    nombre: 'Computación Visual Interactiva',
    creditos: 4,
    area: 'Computación Visual, Interactiva y Videojuegos',
    clasificaciones: [{ maestria: 'MISIS', tipo: 'Profundización' }],
  },
  {
    codigo: 'ISIS-4825',
    nombre: 'Imágenes y Visión',
    creditos: 4,
    area: 'Computación Visual, Interactiva y Videojuegos',
    clasificaciones: [{ maestria: 'MISIS', tipo: 'Profundización' }],
  },
  {
    codigo: 'ISIS-4826',
    nombre: 'Robótica Móvil y Sistemas Autónomos',
    creditos: 4,
    area: 'Computación Visual, Interactiva y Videojuegos',
    clasificaciones: [{ maestria: 'MISIS', tipo: 'Profundización' }],
  },
  {
    codigo: 'ISIS-4818',
    nombre: 'Desarrollo de Videojuegos',
    creditos: 4,
    area: 'Computación Visual, Interactiva y Videojuegos',
    clasificaciones: [{ maestria: 'MISIS', tipo: 'Profundización' }],
  },
];
