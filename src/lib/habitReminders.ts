import { Capacitor } from '@capacitor/core';
import {
  LocalNotifications,
  type ActionPerformed,
  type LocalNotificationSchema,
} from '@capacitor/local-notifications';

const REMINDERS_KEY = 'nutritrack_habit_reminders';

// Versão do formato da notificação agendada no SO. Lembretes agendados por uma
// versão anterior do app (every:'day') sobrevivem ao update e continuam
// disparando no formato antigo (sem o botão "Sim") até serem reagendados.
// Subir este número força a reconciliação a reagendar TODOS os lembretes
// ativos uma vez.
//   v2 = texto "Já completou "X" hoje?" + botão "Sim" (actionTypeId + extra).
const REMINDER_SCHEMA_KEY = 'nutritrack_habit_reminders_schema';
export const REMINDER_SCHEMA_VERSION = '2';

// Tipo de ação registrado no SO: a notificação de hábito ganha o botão "Sim".
export const HABIT_ACTION_TYPE_ID = 'HABIT_REMINDER';
export const HABIT_DONE_ACTION_ID = 'HABIT_DONE';
export const HABIT_DONE_ACTION_TITLE = 'Sim';
const HABIT_CHANNEL_ID = 'habit_reminders';

/** Dados guardados na notificação para saber qual hábito marcar ao tocar em "Sim". */
export interface HabitNotificationExtra {
  habitoId: string;
  habitoNome: string;
}

// Horário padrão: 20:00
const DEFAULT_HOUR = 20;
const DEFAULT_MINUTE = 0;

interface HabitReminder {
  habitoId: string;
  hora: number;   // 0-23
  minuto: number; // 0-59
  ativo: boolean;
}

// ── Persistência (localStorage) ──

function getReminders(): Record<string, HabitReminder> {
  try {
    return JSON.parse(localStorage.getItem(REMINDERS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveReminders(reminders: Record<string, HabitReminder>) {
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}

export function getReminder(habitoId: string): HabitReminder {
  const reminders = getReminders();
  return reminders[habitoId] || {
    habitoId,
    hora: DEFAULT_HOUR,
    minuto: DEFAULT_MINUTE,
    ativo: false,
  };
}

export function setReminder(habitoId: string, hora: number, minuto: number, ativo: boolean) {
  const reminders = getReminders();
  reminders[habitoId] = { habitoId, hora, minuto, ativo };
  saveReminders(reminders);
}

export function removeReminder(habitoId: string) {
  const reminders = getReminders();
  delete reminders[habitoId];
  saveReminders(reminders);
}

export function getAllActiveReminders(): HabitReminder[] {
  const reminders = getReminders();
  return Object.values(reminders).filter(r => r.ativo);
}

// ── Notificações ──

async function requestPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt') {
      perm = await LocalNotifications.requestPermissions();
    }
    return perm.display === 'granted';
  } catch (e) {
    console.warn('[HabitReminders] Permission error:', e);
    return false;
  }
}

// Checa se a permissão já está concedida SEM disparar prompt. Usado pela
// reconciliação para abortar cedo quando não há permissão (evita repetir
// requestPermissions e spam de warnings, 1 por hábito).
async function hasPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const perm = await LocalNotifications.checkPermissions();
    return perm.display === 'granted';
  } catch {
    return false;
  }
}

// Gera um ID numérico estável a partir do habitoId.
// Usa FNV-1a sobre TODOS os 32 hex do UUID (não só os 8 primeiros) para
// minimizar colisão entre hábitos — colisão fazia um lembrete sobrescrever/
// cancelar o de outro hábito, e um deles nunca tocava.
export function notificationId(habitoId: string): number {
  const hex = habitoId.replace(/-/g, '');
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < hex.length; i++) {
    h ^= hex.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return ((h >>> 0) % 2000000000) + 1; // positivo, < 2^31
}

/**
 * Monta a notificação diária de um hábito (mesmo formato no agendamento e no
 * reagendamento pós-conclusão). `at` = próximo disparo; repete todo dia.
 */
export function buildHabitNotification(
  habitoId: string,
  habitoNome: string,
  at: Date,
): LocalNotificationSchema {
  const extra: HabitNotificationExtra = { habitoId, habitoNome };
  return {
    id: notificationId(habitoId),
    title: 'Lembrete de Hábito',
    body: `Já completou "${habitoNome}" hoje?`,
    schedule: {
      at,
      every: 'day',
      allowWhileIdle: true,
    },
    channelId: HABIT_CHANNEL_ID,
    smallIcon: 'ic_stat_icon_config_sample',
    autoCancel: true,
    actionTypeId: HABIT_ACTION_TYPE_ID,
    extra,
  };
}

/**
 * Interpreta a ação recebida do SO. Devolve o hábito quando o usuário tocou em
 * "Sim"; `null` para toque no corpo da notificação, outra ação ou payload
 * sem `habitoId` (notificação de versão antiga).
 */
export function parseHabitDoneAction(action: ActionPerformed): HabitNotificationExtra | null {
  if (action.actionId !== HABIT_DONE_ACTION_ID) return null;
  const extra = action.notification?.extra as Partial<HabitNotificationExtra> | null | undefined;
  if (!extra || typeof extra.habitoId !== 'string' || !extra.habitoId) return null;
  return {
    habitoId: extra.habitoId,
    habitoNome: typeof extra.habitoNome === 'string' ? extra.habitoNome : '',
  };
}

/** `true` quando os lembretes agendados no SO ainda estão no formato antigo. */
export function needsReminderUpgrade(storedVersion: string | null): boolean {
  return storedVersion !== REMINDER_SCHEMA_VERSION;
}

// Registro do tipo de ação (botão "Sim") — 1x por sessão; o plugin persiste no
// SO. Precisa existir ANTES de agendar, senão a notificação sai sem botão.
let actionTypesRegistration: Promise<void> | null = null;
export function registerHabitActionTypes(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  if (!actionTypesRegistration) {
    actionTypesRegistration = LocalNotifications.registerActionTypes({
      types: [{
        id: HABIT_ACTION_TYPE_ID,
        actions: [{ id: HABIT_DONE_ACTION_ID, title: HABIT_DONE_ACTION_TITLE }],
      }],
    }).catch(e => {
      console.warn('[HabitReminders] Falha ao registrar ações da notificação:', e);
      actionTypesRegistration = null; // tenta de novo no próximo agendamento
    });
  }
  return actionTypesRegistration;
}

/**
 * Agenda notificação diária para um hábito.
 * A notificação só aparece se o hábito NÃO foi concluído (verificação feita no horário).
 * No Capacitor, agendamos a notificação para o horário configurado.
 */
export async function scheduleHabitNotification(
  habitoId: string,
  habitoNome: string,
  hora: number,
  minuto: number,
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const granted = await requestPermission();
  if (!granted) {
    console.warn('[HabitReminders] Permission not granted');
    return false;
  }

  const id = notificationId(habitoId);

  // Garante o botão "Sim" registrado antes de agendar.
  await registerHabitActionTypes();

  // Cancela notificação anterior deste hábito (se existir)
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch { /* não havia notificação anterior */ }

  // Agenda para o próximo horário configurado
  const now = new Date();
  const scheduled = new Date();
  scheduled.setHours(hora, minuto, 0, 0);

  // Se já passou do horário hoje, agenda para amanhã
  if (scheduled <= now) {
    scheduled.setDate(scheduled.getDate() + 1);
  }

  try {
    await LocalNotifications.schedule({
      notifications: [buildHabitNotification(habitoId, habitoNome, scheduled)],
    });
    console.log(`[HabitReminders] Scheduled "${habitoNome}" at ${hora}:${String(minuto).padStart(2, '0')} (id: ${id})`);
    return true;
  } catch (e) {
    console.error('[HabitReminders] Schedule error:', e);
    return false;
  }
}

/**
 * Retorna os IDs de notificação atualmente agendados no SO.
 */
export async function getPendingNotificationIds(): Promise<Set<number>> {
  if (!Capacitor.isNativePlatform()) return new Set();
  try {
    const { notifications } = await LocalNotifications.getPending();
    return new Set(notifications.map(n => n.id));
  } catch {
    return new Set();
  }
}

/**
 * Dado os IDs pendentes no SO e os habitoIds com lembrete ativo, retorna os IDs
 * ÓRFÃOS: pendentes que não correspondem a nenhum lembrete ativo atual.
 *
 * Órfãos surgem quando o algoritmo de `notificationId` muda entre versões
 * (ex.: v1.37 usava os 8 primeiros hex; v1.38+ usa FNV-1a dos 32). A notificação
 * agendada com `every: 'day'` sob o ID antigo sobrevive ao update do app e nunca
 * é cancelada (o app só cancela sob o ID novo) → dispara em DUPLICIDADE com a nova.
 * Também cobre notificações de hábitos removidos/desativados.
 *
 * Seguro porque o app usa LocalNotifications APENAS para lembretes de hábito.
 */
export function findOrphanNotificationIds(
  pendingIds: number[],
  activeHabitoIds: string[],
): number[] {
  const expected = new Set(activeHabitoIds.map(notificationId));
  return pendingIds.filter(id => !expected.has(id));
}

/**
 * Reconcilia os lembretes salvos (localStorage) com o que o SO tem agendado.
 * Cancela órfãos (esquema de ID antigo, hábitos removidos) e reagenda os que
 * sumiram (ex.: dados limpos, agendamento perdido pós-reboot).
 * `habitos` é a lista atual [id, nome] para saber o texto da notificação.
 */
export async function reconcileHabitNotifications(
  habitos: { id: string; nome: string }[],
) {
  if (!Capacitor.isNativePlatform()) return;
  // Sem permissão concedida não adianta reagendar — aborta cedo (sem prompt)
  // para não repetir requestPermissions por hábito.
  if (!(await hasPermission())) return;
  const pending = await getPendingNotificationIds();

  // Cancela notificações órfãs (evita duplicidade após mudança do esquema de ID).
  const activeIds = habitos.filter(h => getReminder(h.id).ativo).map(h => h.id);
  const orphans = findOrphanNotificationIds([...pending], activeIds);
  if (orphans.length) {
    try {
      await LocalNotifications.cancel({ notifications: orphans.map(id => ({ id })) });
      console.log(`[HabitReminders] Canceladas ${orphans.length} notificação(ões) órfã(s):`, orphans);
    } catch (e) {
      console.warn('[HabitReminders] Falha ao cancelar órfãs:', e);
    }
  }

  // Formato novo da notificação (ex.: botão "Sim")? Reagenda TODOS os ativos
  // uma vez — a notificação antiga (every:'day') sobreviveria ao update sem o
  // botão. Efeito colateral aceito: no dia do update, hábito já concluído antes
  // do horário volta a lembrar 1x (o "Sim" só reafirma; 23505 = já marcado).
  const upgrade = needsReminderUpgrade(localStorage.getItem(REMINDER_SCHEMA_KEY));

  for (const h of habitos) {
    const r = getReminder(h.id);
    if (r.ativo && (upgrade || !pending.has(notificationId(h.id)))) {
      await scheduleHabitNotification(h.id, h.nome, r.hora, r.minuto);
    }
  }
  if (upgrade) localStorage.setItem(REMINDER_SCHEMA_KEY, REMINDER_SCHEMA_VERSION);
}

/**
 * Cancela notificação de um hábito.
 */
export async function cancelHabitNotification(habitoId: string) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: notificationId(habitoId) }] });
  } catch { /* nada agendado pra cancelar */ }
}

/**
 * Cria o canal de notificação no Android (chamado uma vez na inicialização).
 */
export async function createHabitReminderChannel() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: HABIT_CHANNEL_ID,
      name: 'Lembretes de Hábitos',
      description: 'Notificações para lembrar de completar hábitos diários',
      importance: 4, // HIGH
      sound: 'default',
      vibration: true,
    });
  } catch (e) {
    console.warn('[HabitReminders] Channel creation error:', e);
  }
}

/**
 * Cancela a notificação de hoje para um hábito (quando o usuário marca como concluído).
 * Reagenda para amanhã.
 */
export async function onHabitCompleted(habitoId: string, habitoNome: string) {
  const reminder = getReminder(habitoId);
  if (!reminder.ativo) return;

  // Cancela a de hoje
  await cancelHabitNotification(habitoId);

  // Reagenda para amanhã
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(reminder.hora, reminder.minuto, 0, 0);

  if (!Capacitor.isNativePlatform()) return;
  try {
    await registerHabitActionTypes();
    await LocalNotifications.schedule({
      notifications: [buildHabitNotification(habitoId, habitoNome, tomorrow)],
    });
  } catch (e) {
    console.warn('[HabitReminders] Falha ao reagendar pra amanhã:', e);
  }
}
