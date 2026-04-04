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

// Gera um ID numérico estável a partir do habitoId (primeiros 8 chars hex → int)
function notificationId(habitoId: string): number {
  const hex = habitoId.replace(/-/g, '').slice(0, 8);
  return (parseInt(hex, 16) % 2000000000) + 1; // positivo, < 2^31
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
) {
  if (!Capacitor.isNativePlatform()) return;

  const granted = await requestPermission();
  if (!granted) {
    console.warn('[HabitReminders] Permission not granted');
    return;
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
  } catch (e) {
    console.error('[HabitReminders] Schedule error:', e);
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
