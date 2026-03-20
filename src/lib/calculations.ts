import { Profile, Sexo } from '@/types';

export function calcularIdade(dataNascimento: string): number {
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

// TMB Mifflin-St Jeor
export function calcularTmbMifflin(peso: number, altura: number, idade: number, sexo: Sexo): number {
  if (sexo === 'masculino') {
    return 10 * peso + 6.25 * altura - 5 * idade + 5;
  }
  return 10 * peso + 6.25 * altura - 5 * idade - 161;
}

// TMB Katch-McArdle (needs lean mass)
export function calcularTmbKatch(massaMagra: number): number {
  return 370 + 21.6 * massaMagra;
}

// Jackson & Pollock 3 dobras
// Masculino: Peitoral + Abdominal + Coxa
// Feminino: Tríceps + Supra-ilíaca + Coxa
export function calcularPercentualGordura3Dobras(
  sexo: Sexo,
  idade: number,
  dobras: { d1: number; d2: number; d3: number }
): number {
  const soma = dobras.d1 + dobras.d2 + dobras.d3;

  let densidadeCorporal: number;
  if (sexo === 'masculino') {
    // J&P 3-site men: chest, abdomen, thigh
    densidadeCorporal = 1.10938 - 0.0008267 * soma + 0.0000016 * soma * soma - 0.0002574 * idade;
  } else {
    // J&P 3-site women: triceps, suprailiac, thigh
    densidadeCorporal = 1.0994921 - 0.0009929 * soma + 0.0000023 * soma * soma - 0.0001392 * idade;
  }

  return (495 / densidadeCorporal) - 450;
}

export function calcularComposicaoCorporal(peso: number, percentualGordura: number) {
  const massaGorda = (peso * percentualGordura) / 100;
  const massaMagra = peso - massaGorda;
  return { massaGorda: Math.round(massaGorda * 10) / 10, massaMagra: Math.round(massaMagra * 10) / 10 };
}

export function calcularMetaCalorica(profile: Profile): {
  tmb_mifflin: number;
  tmb_katch: number | null;
  metaBase: number;
  metaFinal: number;
} {
  const idade = profile.data_nascimento ? calcularIdade(profile.data_nascimento) : 30;
  const peso = profile.peso || 70;
  const altura = profile.altura || 170;
  const sexo = profile.sexo || 'masculino';

  const tmb_mifflin = Math.round(calcularTmbMifflin(peso, altura, idade, sexo));
  
  let tmb_katch: number | null = null;
  if (profile.massa_magra && profile.massa_magra > 0) {
    tmb_katch = Math.round(calcularTmbKatch(profile.massa_magra));
  }

  const tmbSelecionada = profile.tmb_metodo === 'katch' && tmb_katch ? tmb_katch : tmb_mifflin;
  const metaBase = Math.round(tmbSelecionada * profile.nivel_atividade);
  const metaFinal = metaBase + profile.ajuste_calorico;

  return { tmb_mifflin, tmb_katch, metaBase, metaFinal };
}

export function calcularMacros(profile: Profile, metaFinal: number) {
  const peso = profile.peso || 70;
  const proteinaG = Math.round(profile.macro_proteina_multiplicador * peso);
  const proteinaKcal = proteinaG * 4;

  const gorduraKcal = Math.round((profile.macro_gordura_percentual / 100) * metaFinal);
  const gorduraG = Math.round(gorduraKcal / 9);

  const carboKcal = Math.max(0, metaFinal - proteinaKcal - gorduraKcal);
  const carboG = Math.round(carboKcal / 4);

  const totalKcal = proteinaKcal + gorduraKcal + carboKcal;

  return {
    proteina: { g: proteinaG, kcal: proteinaKcal, pct: Math.round((proteinaKcal / totalKcal) * 100) },
    gordura: { g: gorduraG, kcal: gorduraKcal, pct: Math.round((gorduraKcal / totalKcal) * 100) },
    carbo: { g: carboG, kcal: carboKcal, pct: Math.round((carboKcal / totalKcal) * 100) },
    totalKcal,
  };
}

export function formatDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function displayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const hoje = new Date();
  const hojeStr = formatDate(hoje);
  const ontemStr = formatDate(new Date(hoje.getTime() - 86400000));

  if (dateStr === hojeStr) return 'Hoje';
  if (dateStr === ontemStr) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
}
