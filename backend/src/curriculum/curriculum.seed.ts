/**
 * Semilla del plan de estudios oficial de Ingeniería de Sistemas y Computación
 * (2025-20 / 2026-10). Fuente de verdad para el seed inicial y "Restaurar pensum".
 */
export interface CurriculumSeedItem {
  codigo: string;
  nombre: string;
  creditos: number;
  semestre: number;
  area: string;
  prerrequisitos: string[];
}

/** Equivalencias de códigos antiguos, para resolver nombres en prerrequisitos. */
export const CODIGO_EQUIVALENCIAS: Record<string, string> = {
  'ISIS-2304': 'Sistemas Transaccionales',
  'ISIS-2603': 'Desarrollo de SW en Equipo',
  'ISIS-1304': 'Infraestructura Computacional',
  'ISIS-2403': 'Arquitectura Empresarial',
  'ISIS-2503': 'Arquitectura y Diseño de SW',
  'ISIS-3204': 'Infraestructura de Comunicaciones',
  'ISIS-2007': 'Diseño de Productos e Innovación en TI',
  'FISI-1528': 'Física Experimental II',
};

/** Créditos por semestre (para encabezados de columnas). */
export const CREDITOS_POR_SEMESTRE: Record<number, number> = {
  1: 16,
  2: 16,
  3: 18,
  4: 18,
  5: 17,
  6: 17,
  7: 17,
  8: 15,
};

export const CURRICULUM_SEED: CurriculumSeedItem[] = [
  // ---------- Semestre 1 (16 cr) ----------
  { codigo: 'ISIS-1001', nombre: 'Introducción a la Ingeniería de Sistemas', creditos: 3, semestre: 1, area: 'Proyectos', prerrequisitos: [] },
  { codigo: 'ISIS-1221', nombre: 'Introducción a la Programación', creditos: 3, semestre: 1, area: 'Programación y Software', prerrequisitos: [] },
  { codigo: 'MATE-1201', nombre: 'Pre-cálculo', creditos: 3, semestre: 1, area: 'Complemento de Ingeniería', prerrequisitos: [] },
  { codigo: 'ESCR-1101', nombre: 'Escritura Universitaria I', creditos: 2, semestre: 1, area: 'Fundamentos', prerrequisitos: [] },
  { codigo: 'ESCR-1102', nombre: 'Escritura Universitaria II', creditos: 2, semestre: 1, area: 'Fundamentos', prerrequisitos: ['ESCR-1101'] },
  { codigo: 'DERE-1300', nombre: 'Constitución y Democracia', creditos: 3, semestre: 1, area: 'Fundamentos', prerrequisitos: [] },

  // ---------- Semestre 2 (16 cr) ----------
  { codigo: 'ISIS-1107', nombre: 'Fundamentos Matemáticos para Computación', creditos: 3, semestre: 2, area: 'Ciencias de la Computación', prerrequisitos: ['ISIS-1221', 'MATE-1201'] },
  { codigo: 'ISIS-1225', nombre: 'Estructuras de datos y algoritmos', creditos: 3, semestre: 2, area: 'Programación y Software', prerrequisitos: ['ISIS-1221', 'MATE-1201'] },
  { codigo: 'MATE-1203', nombre: 'Cálculo Diferencial', creditos: 3, semestre: 2, area: 'Fundamentos', prerrequisitos: ['MATE-1201'] },
  { codigo: 'CLE-1', nombre: 'Curso de Libre Elección', creditos: 1, semestre: 2, area: 'Fundamentos', prerrequisitos: [] },
  { codigo: 'CLE-2', nombre: 'Curso de Libre Elección', creditos: 1, semestre: 2, area: 'Fundamentos', prerrequisitos: [] },
  { codigo: 'CLE-3', nombre: 'Curso de Libre Elección', creditos: 1, semestre: 2, area: 'Fundamentos', prerrequisitos: [] },
  { codigo: 'CBCC-1177', nombre: 'COL: Espacio, Tiempo y Diferencia', creditos: 2, semestre: 2, area: 'Fundamentos', prerrequisitos: [] },
  { codigo: 'CBPC-XXXX', nombre: 'CBU Pensamiento Científico', creditos: 2, semestre: 2, area: 'Fundamentos', prerrequisitos: [] },

  // ---------- Semestre 3 (18 cr) ----------
  { codigo: 'ISIS-1226', nombre: 'Diseño y Programación Orientada a Objetos', creditos: 3, semestre: 3, area: 'Programación y Software', prerrequisitos: ['ISIS-1225'] },
  { codigo: 'ISIS-1511', nombre: 'Fundamentos de Bases de Datos', creditos: 3, semestre: 3, area: 'Datos', prerrequisitos: ['ISIS-1225', 'ESCR-1102'] },
  { codigo: 'ISIS-1611', nombre: 'Inteligencia Artificial', creditos: 3, semestre: 3, area: 'Inteligencia Artificial', prerrequisitos: ['ISIS-1225', 'MATE-1203'] },
  { codigo: 'MATE-1214', nombre: 'Cálculo Integral y Ecuaciones Diferenciales', creditos: 3, semestre: 3, area: 'Fundamentos', prerrequisitos: ['MATE-1203'] },
  { codigo: 'FISI-A', nombre: 'Física A (Electromagnetismo)', creditos: 3, semestre: 3, area: 'Fundamentos', prerrequisitos: ['MATE-1203'] },
  { codigo: 'MATE-1105', nombre: 'Álgebra Lineal', creditos: 3, semestre: 3, area: 'Fundamentos', prerrequisitos: ['MATE-1203'] },
  { codigo: 'RLEC', nombre: 'Requisito Lectura Inglés', creditos: 0, semestre: 3, area: 'Fundamentos', prerrequisitos: [] },

  // ---------- Semestre 4 (18 cr) ----------
  { codigo: 'ISIS-2111', nombre: 'Elementos Esenciales de Lenguajes de Programación', creditos: 3, semestre: 4, area: 'Ciencias de la Computación', prerrequisitos: ['ISIS-1107', 'ISIS-1226'] },
  { codigo: 'ISIS-2211', nombre: 'Ingeniería de Software Moderna', creditos: 3, semestre: 4, area: 'Programación y Software', prerrequisitos: ['ISIS-1226', 'ISIS-1511 o ISIS-2304'] },
  { codigo: 'ISIS-1311', nombre: 'Tecnologías e Infraestructura de cómputo', creditos: 3, semestre: 4, area: 'Infraestructura', prerrequisitos: ['ISIS-1226'] },
  { codigo: 'IIND-2401', nombre: 'Análisis de Decisión de Inversión', creditos: 3, semestre: 4, area: 'Complemento de Ingeniería', prerrequisitos: ['MATE-1203', 'ISIS-1001'] },
  { codigo: 'MATE-1207', nombre: 'Cálculo Vectorial', creditos: 3, semestre: 4, area: 'Fundamentos', prerrequisitos: ['MATE-1214', 'MATE-1105'] },
  { codigo: 'IIND-2106', nombre: 'Probabilidad y Estadística', creditos: 3, semestre: 4, area: 'Complemento de Ingeniería', prerrequisitos: ['MATE-1214', 'MATE-1105'] },

  // ---------- Semestre 5 (17 cr) ----------
  { codigo: 'ISIS-2212', nombre: 'Arquitecturas de Software Robustas', creditos: 3, semestre: 5, area: 'Programación y Software', prerrequisitos: ['ISIS-2211 o ISIS-2603', 'ISIS-1511 o ISIS-2304'] },
  { codigo: 'ISIS-2311', nombre: 'Redes y Servicios de Comunicaciones', creditos: 3, semestre: 5, area: 'Infraestructura', prerrequisitos: ['ISIS-1311 o ISIS-1304', 'ISIS-1225'] },
  { codigo: 'ISIS-2411', nombre: 'Ingeniería de Negocios Digitales', creditos: 3, semestre: 5, area: 'Negocios Digitales', prerrequisitos: ['ISIS-1221', 'IIND-2401'] },
  { codigo: 'ISIS-2611', nombre: 'Aprendizaje de Máquina', creditos: 3, semestre: 5, area: 'Inteligencia Artificial', prerrequisitos: ['ISIS-1511 o ISIS-2304', 'IIND-2106'] },
  { codigo: 'EING', nombre: 'Electiva de Ingeniería', creditos: 2, semestre: 5, area: 'Complemento de Ingeniería', prerrequisitos: [] },
  { codigo: 'FISI-B', nombre: 'Física B (Física para Computación Cuántica)', creditos: 3, semestre: 5, area: 'Fundamentos', prerrequisitos: ['FISI-A', 'MATE-1105'] },

  // ---------- Semestre 6 (17 cr) ----------
  { codigo: 'ISIS-2011', nombre: 'Productos Digitales Innovadores', creditos: 3, semestre: 6, area: 'Proyectos', prerrequisitos: ['ISIS-2211 o ISIS-2603', 'ISIS-2411 o ISIS-2403', 'RLEC'] },
  { codigo: 'ISIS-2112', nombre: 'Diseño de Algoritmos', creditos: 3, semestre: 6, area: 'Ciencias de la Computación', prerrequisitos: ['ISIS-1107', 'ISIS-1226', 'IIND-2106', 'RLEC'] },
  { codigo: 'ISIS-2213', nombre: 'Diseño de Aplicaciones Complejas', creditos: 3, semestre: 6, area: 'Programación y Software', prerrequisitos: ['ISIS-2212 o ISIS-2503', 'ISIS-2311 o ISIS-3204', 'RLEC'] },
  { codigo: 'ISIS-2214', nombre: 'Tecnologías Emergentes', creditos: 3, semestre: 6, area: 'Programación y Software', prerrequisitos: ['ISIS-2213', 'ISIS-2611', 'ESCR-1102', 'RLEC'] },
  { codigo: 'ISIS-3311', nombre: 'Ciberseguridad', creditos: 3, semestre: 6, area: 'Infraestructura', prerrequisitos: ['ISIS-2311 o ISIS-3204', 'ISIS-1511 o ISIS-2304', 'ISIS-2212 o ISIS-2503', 'ESCR-1102', 'RLEC'] },
  { codigo: 'CBCA-XXXX', nombre: 'CBU Culturas, Artes y Humanidades', creditos: 2, semestre: 6, area: 'Fundamentos', prerrequisitos: [] },

  // ---------- Semestre 7 (17 cr) ----------
  { codigo: 'ISIS-3211', nombre: 'Fábricas de Software Globales', creditos: 3, semestre: 7, area: 'Programación y Software', prerrequisitos: ['ISIS-2213', 'ISIS-3311', 'ESCR-1102', 'RLEC'] },
  { codigo: 'EP-1', nombre: 'Electiva Profesional', creditos: 2, semestre: 7, area: 'Electivas', prerrequisitos: ['ISIS-2011 o ISIS-2007'] },
  { codigo: 'EP-2', nombre: 'Electiva Profesional', creditos: 2, semestre: 7, area: 'Electivas', prerrequisitos: ['ISIS-2011 o ISIS-2007'] },
  { codigo: 'ECIENCIAS-1', nombre: 'Electiva de Ciencias', creditos: 1, semestre: 7, area: 'Fundamentos', prerrequisitos: [] },
  { codigo: 'ECIENCIAS-2', nombre: 'Electiva de Ciencias', creditos: 1, semestre: 7, area: 'Fundamentos', prerrequisitos: [] },
  { codigo: 'ECIENCIAS-3', nombre: 'Electiva de Ciencias', creditos: 1, semestre: 7, area: 'Fundamentos', prerrequisitos: [] },
  { codigo: 'CLE-4', nombre: 'Curso de Libre Elección', creditos: 1, semestre: 7, area: 'Fundamentos', prerrequisitos: [] },
  { codigo: 'CLE-5', nombre: 'Curso de Libre Elección', creditos: 1, semestre: 7, area: 'Fundamentos', prerrequisitos: [] },
  { codigo: 'CLE-6', nombre: 'Curso de Libre Elección', creditos: 1, semestre: 7, area: 'Fundamentos', prerrequisitos: [] },
  { codigo: 'CBU-1', nombre: 'Curso Básico Uniandino', creditos: 2, semestre: 7, area: 'Fundamentos', prerrequisitos: [] },
  { codigo: 'CBU-2', nombre: 'Curso Básico Uniandino', creditos: 2, semestre: 7, area: 'Fundamentos', prerrequisitos: [] },

  // ---------- Semestre 8 (15 cr) ----------
  { codigo: 'ISIS-3007', nombre: 'Proyecto de Grado', creditos: 3, semestre: 8, area: 'Proyectos', prerrequisitos: ['ISIS-2611', 'ISIS-2213 o ISIS-2503', 'ISIS-2011 o ISIS-2007', 'FISI-B o FISI-1528', 'RLEC', 'Nivel 1 y 2 aprobados'] },
  { codigo: 'EP-3', nombre: 'Electiva Profesional', creditos: 2, semestre: 8, area: 'Electivas', prerrequisitos: ['ISIS-2011 o ISIS-2007'] },
  { codigo: 'EP-4', nombre: 'Electiva Profesional', creditos: 2, semestre: 8, area: 'Electivas', prerrequisitos: ['ISIS-2011 o ISIS-2007'] },
  { codigo: 'EP-5', nombre: 'Electiva Profesional', creditos: 2, semestre: 8, area: 'Electivas', prerrequisitos: ['ISIS-2011 o ISIS-2007'] },
  { codigo: 'EP-6', nombre: 'Electiva Profesional', creditos: 2, semestre: 8, area: 'Electivas', prerrequisitos: ['ISIS-2011 o ISIS-2007'] },
  { codigo: 'CBCO-XXXX', nombre: 'CBU Colombia', creditos: 2, semestre: 8, area: 'Fundamentos', prerrequisitos: [] },
  { codigo: 'CBU-3', nombre: 'Curso Básico Uniandino', creditos: 2, semestre: 8, area: 'Fundamentos', prerrequisitos: [] },
  { codigo: 'RIDI', nombre: 'Requisito de Idiomas', creditos: 0, semestre: 8, area: 'Fundamentos', prerrequisitos: [] },
];
