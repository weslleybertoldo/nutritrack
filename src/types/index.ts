// Types for NutriTrack

export type Objetivo = 'perder' | 'manter' | 'ganhar';
export type TmbMetodo = 'mifflin' | 'katch';
export type Sexo = 'masculino' | 'feminino';
export type Tema = 'light' | 'dark' | 'system';
export type TipoRefeicao = 'cafe_manha' | 'almoco' | 'janta' | 'lanche' | 'lanche_manha' | 'personalizado';
export type Unidade = 'g' | 'ml';

export interface Profile {
  id?: string;
  user_id?: string;
  nome: string;
  email: string;
  foto_url?: string;
  data_nascimento?: string;
  sexo?: Sexo;
  peso?: number;
  altura?: number;
  tmb_metodo: TmbMetodo;
  nivel_atividade: number;
  ajuste_calorico: number;
  objetivo: Objetivo;
  macro_proteina_multiplicador: number;
  macro_gordura_percentual: number;
  // Dobras cutâneas (3 dobras J&P)
  dc_tricipital?: number;
  dc_peitoral?: number;
  dc_suprailiaca?: number;
  dc_abdominal?: number;
  dc_coxa?: number;
  percentual_gordura?: number;
  massa_gorda?: number;
  massa_magra?: number;
  // Metas de micronutrientes
  meta_fibras: number;
  meta_sodio: number;
  meta_acucares: number;
  meta_gordura_saturada: number;
  meta_colesterol: number;
  meta_potassio: number;
  tema: Tema;
  // Admin fields
  user_code?: number;
  admin_locked?: boolean;
  blocked?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Food {
  id: string;
  nome: string;
  codigo_barras?: string;
  unidade: Unidade;
  calorias_por_100: number;
  proteina_por_100: number;
  carbo_por_100: number;
  gordura_por_100: number;
  acucares_por_100: number;
  gordura_saturada_por_100: number;
  gordura_trans_por_100: number;
  fibras_por_100: number;
  sodio_por_100: number;
  colesterol_por_100: number;
  potassio_por_100: number;
  criado_por?: string;
  atualizado_por?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Meal {
  id: string;
  user_id: string;
  data: string;
  tipo: TipoRefeicao;
  nome_personalizado?: string;
  items?: MealItem[];
}

export interface MealItem {
  id: string;
  meal_id: string;
  food_id: string;
  quantidade: number;
  calorias_calculadas: number;
  proteina: number;
  carbo: number;
  gordura: number;
  food?: Food;
}

export interface Recipe {
  id: string;
  user_id: string;
  nome: string;
  descricao?: string;
  items?: RecipeItem[];
}

export interface RecipeItem {
  id: string;
  recipe_id: string;
  food_id: string;
  quantidade: number;
  food?: Food;
}

export interface Favorite {
  id: string;
  user_id: string;
  food_id: string;
  food?: Food;
}

export interface RecentFood {
  id: string;
  user_id: string;
  food_id: string;
  usado_em: string;
  food?: Food;
}

export interface MealReminder {
  id: string;
  user_id: string;
  tipo_refeicao: TipoRefeicao;
  horario: string;
  ativo: boolean;
  dias_semana: number[];
}

// Calculation helpers
export const NIVEL_ATIVIDADE_OPTIONS = [
  { value: 1.2, label: 'Sedentário', desc: 'Pouco ou nenhum exercício' },
  { value: 1.375, label: 'Levemente ativo', desc: 'Exercício 1-3 dias/semana' },
  { value: 1.55, label: 'Moderadamente ativo', desc: 'Exercício 3-5 dias/semana' },
  { value: 1.725, label: 'Muito ativo', desc: 'Exercício 6-7 dias/semana' },
  { value: 1.9, label: 'Atleta', desc: 'Treino intenso diário' },
];

export const TIPO_REFEICAO_LABELS: Record<TipoRefeicao, string> = {
  cafe_manha: 'Café da Manhã',
  lanche_manha: 'Lanche da Manhã',
  almoco: 'Almoço',
  lanche: 'Lanche da Tarde',
  janta: 'Janta',
  personalizado: 'Personalizado',
};

export const REFEICOES_PADRAO: TipoRefeicao[] = ['cafe_manha', 'lanche_manha', 'almoco', 'lanche', 'janta'];
