import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const REMINDERS_KEY = 'nutritrack_habit_reminders';

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

  // Cancela notificação anterior deste hábito (se existir)
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {}

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
      notifications: [{
        id,
        title: 'Lembrete de Hábito',
        body: `Você ainda não completou "${habitoNome}" hoje!`,
        schedule: {
          at: scheduled,
          every: 'day',
          allowWhileIdle: true,
        },
        channelId: 'habit_reminders',
        smallIcon: 'ic_stat_icon_config_sample',
        autoCancel: true,
      }],
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

  for (const h of habitos) {
    const r = getReminder(h.id);
    if (r.ativo && !pending.has(notificationId(h.id))) {
      await scheduleHabitNotification(h.id, h.nome, r.hora, r.minuto);
    }
  }
}

/**
 * Cancela notificação de um hábito.
 */
export async function cancelHabitNotification(habitoId: string) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: notificationId(habitoId) }] });
  } catch {}
}

/**
 * Cria o canal de notificação no Android (chamado uma vez na inicialização).
 */
export async function createHabitReminderChannel() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: 'habit_reminders',
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
    await LocalNotifications.schedule({
      notifications: [{
        id: notificationId(habitoId),
        title: 'Lembrete de Hábito',
        body: `Você ainda não completou "${habitoNome}" hoje!`,
        schedule: {
          at: tomorrow,
          every: 'day',
          allowWhileIdle: true,
        },
        channelId: 'habit_reminders',
        smallIcon: 'ic_stat_icon_config_sample',
        autoCancel: true,
      }],
    });
  } catch {}
}
