// Global store for the beforeinstallprompt event so it can be reused across components

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function getPwaPrompt() {
  return deferredPrompt;
}

export function clearPwaPrompt() {
  deferredPrompt = null;
  listeners.forEach(fn => fn());
}

export function subscribePwaPrompt(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;
}

// Listen globally once
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach(fn => fn());
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach(fn => fn());
  });
}
