import jsPDF from 'jspdf';
import { calcularIdade, calcularMetaCalorica, calcularMacros, calcularTmbMifflin, calcularTmbKatch } from './calculations';
import { Profile } from '@/types';

interface MealItem {
  calorias_calculadas: number;
  proteina: number;
  carbo: number;
  gordura: number;
  quantidade: number;
  food?: { nome: string; unidade: string };
}

interface Meal {
  tipo: string;
  nome_personalizado?: string;
  meal_items: MealItem[];
}

interface UserDetail {
  profile: any;
  meals: Meal[];
  weekMeals: Meal[];
}

function getMealTypeName(tipo: string) {
  const map: Record<string, string> = {
    cafe_da_manha: 'Café da Manhã',
    lanche_manha: 'Lanche da Manhã',
    almoco: 'Almoço',
    lanche_tarde: 'Lanche da Tarde',
    jantar: 'Jantar',
    ceia: 'Ceia',
  };
  return map[tipo] || tipo;
}

export function generateUserReport(detail: UserDetail) {
  const p = detail.profile;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 15;

  const checkPage = (needed: number) => {
    if (y + needed > 275) {
      doc.addPage();
      y = 15;
    }
  };

  const addTitle = (text: string) => {
    checkPage(12);
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text(text, margin, y);
    y += 3;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
  };

  const addLabel = (label: string, value: string, x?: number) => {
    checkPage(7);
    const xPos = x ?? margin;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(label, xPos, y);
    doc.setFont('helvetica', 'bold');
    doc.text(value, xPos + doc.getTextWidth(label) + 2, y);
  };

  // ===== HEADER =====
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.text('NutriTrack — Relatório Individual', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${p.nome || 'Sem nome'} — ID: ${p.user_code || '—'}`, margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, margin, y);
  y += 10;

  // ===== SEÇÃO 1: DADOS PESSOAIS =====
  addTitle('1. Dados Pessoais');

  const idade = p.data_nascimento ? calcularIdade(p.data_nascimento) : null;

  const dados = [
    ['Nome: ', p.nome || '—'],
    ['Email: ', p.email || '—'],
    ['Idade: ', idade ? `${idade} anos` : '—'],
    ['Sexo: ', p.sexo === 'masculino' ? 'Masculino' : p.sexo === 'feminino' ? 'Feminino' : '—'],
    ['Peso: ', p.peso ? `${p.peso} kg` : '—'],
    ['Altura: ', p.altura ? `${p.altura} cm` : '—'],
  ];

  for (let i = 0; i < dados.length; i += 2) {
    addLabel(dados[i][0], dados[i][1]);
    if (dados[i + 1]) addLabel(dados[i + 1][0], dados[i + 1][1], pageW / 2);
    y += 6;
  }
  y += 2;

  // ===== SEÇÃO 2: COMPOSIÇÃO CORPORAL =====
  addTitle('2. Composição Corporal');

  if (p.percentual_gordura != null) {
    addLabel('% Gordura: ', `${(Number(p.percentual_gordura) || 0).toFixed(1)}%`);
    y += 6;
    addLabel('Massa Gorda: ', p.massa_gorda != null ? `${(Number(p.massa_gorda) || 0).toFixed(1)} kg` : '—');
    addLabel('Massa Magra: ', p.massa_magra != null ? `${(Number(p.massa_magra) || 0).toFixed(1)} kg` : '—', pageW / 2);
    y += 6;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Dobras cutâneas não preenchidas.', margin, y);
    y += 6;
  }

  const peso = p.peso || 70;
  const altura = p.altura || 170;
  const idadeCalc = idade || 30;
  const sexo = p.sexo || 'masculino';

  const tmbMifflin = Math.round(calcularTmbMifflin(peso, altura, idadeCalc, sexo));
  addLabel('TMB Mifflin-St Jeor: ', `${tmbMifflin} kcal`);
  y += 6;

  if (p.massa_magra && p.massa_magra > 0) {
    const tmbKatch = Math.round(calcularTmbKatch(p.massa_magra));
    addLabel('TMB Katch-McArdle: ', `${tmbKatch} kcal`);
    y += 6;
  }
  y += 2;

  // ===== SEÇÃO 3: METAS =====
  addTitle('3. Metas');

  const profileForCalc: Profile = {
    ...p,
    tmb_metodo: p.tmb_metodo || 'mifflin',
    nivel_atividade: p.nivel_atividade || 1.55,
    ajuste_calorico: p.ajuste_calorico || 0,
    objetivo: p.objetivo || 'manter',
    macro_proteina_multiplicador: p.macro_proteina_multiplicador || 2.2,
    macro_gordura_percentual: p.macro_gordura_percentual || 15,
    meta_fibras: p.meta_fibras || 25,
    meta_sodio: p.meta_sodio || 2000,
    meta_acucares: p.meta_acucares || 50,
    meta_gordura_saturada: p.meta_gordura_saturada || 20,
    meta_colesterol: p.meta_colesterol || 300,
    meta_potassio: p.meta_potassio || 3500,
    tema: p.tema || 'system',
  };

  const metaCalc = calcularMetaCalorica(profileForCalc);
  const macros = calcularMacros(profileForCalc, metaCalc.metaFinal);

  const tmbUsada = p.tmb_metodo === 'katch' ? 'Katch-McArdle' : 'Mifflin-St Jeor';
  addLabel('TMB utilizada: ', tmbUsada);
  addLabel('Nível atividade: ', `×${p.nivel_atividade ?? 1.55}`, pageW / 2);
  y += 6;
  addLabel('Meta base: ', `${metaCalc.metaBase || 0} kcal`);
  addLabel('Ajuste: ', `${p.ajuste_calorico ?? 0} kcal`, pageW / 2);
  y += 6;
  addLabel('Meta final: ', `${metaCalc.metaFinal || 0} kcal/dia`);
  y += 8;

  addLabel('Proteína: ', `${macros.proteina.g || 0}g (${macros.proteina.pct || 0}%)`);
  y += 6;
  addLabel('Gordura: ', `${macros.gordura.g || 0}g (${macros.gordura.pct || 0}%)`);
  y += 6;
  addLabel('Carboidrato: ', `${macros.carbo.g || 0}g (${macros.carbo.pct || 0}%)`);
  y += 4;

  // ===== SEÇÃO 4: DIÁRIO ATUAL =====
  addTitle('4. Diário do Dia Atual');

  const getDaySummary = (meals: Meal[]) =>
    meals.reduce(
      (acc, meal) => {
        (meal.meal_items || []).forEach((item) => {
          acc.calorias += Number(item.calorias_calculadas) || 0;
          acc.proteina += Number(item.proteina) || 0;
          acc.carbo += Number(item.carbo) || 0;
          acc.gordura += Number(item.gordura) || 0;
        });
        return acc;
      },
      { calorias: 0, proteina: 0, carbo: 0, gordura: 0 }
    );

  const todaySummary = getDaySummary(detail.meals);

  addLabel('Calorias: ', `${Math.round(todaySummary.calorias)} / ${metaCalc.metaFinal} kcal`);
  y += 6;
  addLabel('Proteína: ', `${Math.round(todaySummary.proteina)}g / ${macros.proteina.g}g`);
  addLabel('Carbo: ', `${Math.round(todaySummary.carbo)}g / ${macros.carbo.g}g`, pageW / 2);
  y += 6;
  addLabel('Gordura: ', `${Math.round(todaySummary.gordura)}g / ${macros.gordura.g}g`);
  y += 8;

  // List meals
  if (detail.meals.length > 0) {
    detail.meals.forEach((meal) => {
      checkPage(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(meal.nome_personalizado || getMealTypeName(meal.tipo), margin, y);
      y += 5;

      (meal.meal_items || []).forEach((item) => {
        checkPage(6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const foodName = item.food?.nome || 'Alimento';
        const unit = item.food?.unidade || 'g';
        const cal = Math.round(Number(item.calorias_calculadas) || 0);
        const qty = item.quantidade || 0;
        doc.text(`  • ${foodName} — ${qty}${unit} (${cal} kcal)`, margin, y);
        y += 5;
      });
      y += 2;
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Nenhuma refeição registrada hoje.', margin, y);
    y += 6;
  }

  // ===== SEÇÃO 5: RESUMO DA SEMANA =====
  addTitle('5. Resumo da Semana');

  const weekDays: { date: string; calorias: number; proteina: number; carbo: number; gordura: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayMeals = (detail.weekMeals || []).filter((m: any) => m.data === dateStr);
    const s = getDaySummary(dayMeals);
    weekDays.push({ date: dateStr, ...s });
  }

  const avgCal = Math.round(weekDays.reduce((s, d) => s + d.calorias, 0) / 7);
  addLabel('Média diária: ', `${avgCal} kcal`);
  y += 8;

  // Table header
  checkPage(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const cols = [margin, margin + 30, margin + 60, margin + 90, margin + 120];
  doc.text('Data', cols[0], y);
  doc.text('Calorias', cols[1], y);
  doc.text('Proteína', cols[2], y);
  doc.text('Carbo', cols[3], y);
  doc.text('Gordura', cols[4], y);
  y += 2;
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  weekDays.forEach((day) => {
    checkPage(6);
    const dateFormatted = new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    doc.text(dateFormatted, cols[0], y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${Math.round(day.calorias)}`, cols[1], y);
    doc.text(`${Math.round(day.proteina)}g`, cols[2], y);
    doc.text(`${Math.round(day.carbo)}g`, cols[3], y);
    doc.text(`${Math.round(day.gordura)}g`, cols[4], y);
    doc.setFont('helvetica', 'normal');
    y += 5;
  });

  // ===== FOOTER on every page =====
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('By Weslley Bertoldo', margin, 290);
    doc.text(`Página ${i}/${totalPages}`, pageW - margin - 20, 290);
    doc.setTextColor(0);
  }

  // Save
  const safeName = ((p.nome || 'usuario') + '').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  doc.save(`Relatorio-${safeName}-${p.user_code || 'ID'}.pdf`);
}
