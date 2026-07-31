/**
 * native.ts
 * Central bridge for all Capacitor native features.
 * Gracefully falls back to no-ops in browser/dev environments.
 */
import { showBanner } from '../components/InAppBanner';

// ─── Detection ───────────────────────────────────────────────────────────────
export const isNative = () =>
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor?.isNativePlatform?.() === true;

export const getPlatform = (): string =>
  (window as any).Capacitor?.getPlatform?.() ?? 'web';

// ─── Push Notifications ──────────────────────────────────────────────────────
export async function initPushNotifications(onToken?: (token: string) => void) {
  if (!isNative()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // Request permission
    const result = await PushNotifications.requestPermissions();
    if (result.receive !== 'granted') {
      console.warn('Push notification permission denied');
      return;
    }

    await PushNotifications.register();

    // Token received → send to Supabase to save for this user
    PushNotifications.addListener('registration', (token) => {
      console.log('FCM Token:', token.value);
      onToken?.(token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error:', err.error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received (foreground):', notification);
      // Show in-app banner for foreground push notifications
      showBanner({
        title: notification.title ?? 'LiveSync AI',
        body: notification.body ?? '',
      });
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Push action:', action);
    });

    // Listen for local notifications received while app is in foreground
    LocalNotifications.addListener('localNotificationReceived', (notification) => {
      console.log('Local notification received (foreground):', notification);
      showBanner({
        title: notification.title ?? 'LiveSync AI',
        body: notification.body ?? '',
      });
    });

    // Create notification channels (Android 8+)
    await LocalNotifications.createChannel({
      id: 'bills',
      name: 'Bill Reminders',
      description: 'Upcoming bill due date alerts',
      importance: 5,
      sound: 'beep.wav',
      vibration: true,
      lights: true,
      lightColor: '#6366f1',
    });

    await LocalNotifications.createChannel({
      id: 'goals',
      name: 'Goal Milestones',
      description: 'Savings goal progress alerts',
      importance: 4,
      sound: 'beep.wav',
      vibration: true,
    });

    await LocalNotifications.createChannel({
      id: 'fraud',
      name: 'Security Alerts',
      description: 'Fraud and security notifications',
      importance: 5,
      sound: 'beep.wav',
      vibration: true,
    });

    await LocalNotifications.createChannel({
      id: 'insights',
      name: 'Financial Insights',
      description: 'Monthly summary and AI tips',
      importance: 3,
    });

  } catch (err) {
    console.warn('Push notification setup failed:', err);
  }
}

// ─── Local Notifications ─────────────────────────────────────────────────────
export async function scheduleBillReminder(name: string, amount: number, dueDate: Date) {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const fireAt = new Date(dueDate);
    fireAt.setDate(fireAt.getDate() - 3); // 3 days before due

    await LocalNotifications.schedule({
      notifications: [{
        id: Math.floor(Math.random() * 100000),
        title: `📅 Bill Due Soon`,
        body: `${name} — ₹${amount.toLocaleString('en-IN')} due in 3 days`,
        channelId: 'bills',
        schedule: { at: fireAt },
        extra: { type: 'bill', name, amount },
      }],
    });
  } catch (err) {
    console.warn('Schedule bill reminder failed:', err);
  }
}

export async function scheduleGoalAlert(goalName: string, percent: number) {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [{
        id: Math.floor(Math.random() * 100000),
        title: `🎯 Goal Milestone!`,
        body: `You've reached ${percent}% of your "${goalName}" goal. Keep it up!`,
        channelId: 'goals',
        schedule: { at: new Date(Date.now() + 1000) },
        extra: { type: 'goal', goalName, percent },
      }],
    });
  } catch (err) {
    console.warn('Schedule goal alert failed:', err);
  }
}

// ─── Status Bar ──────────────────────────────────────────────────────────────
export async function initStatusBar() {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');

    // Android: prevent WebView from rendering underneath the status bar.
    // On Android 15+ (SDK 35+), edge-to-edge is forced by the OS; the
    // adjustMarginsForEdgeToEdge config key in capacitor.config.json
    // handles that layer. This call covers older Android versions.
    if (getPlatform() === 'android') {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setBackgroundColor({ color: '#0f172a' });
    }

    // Light icons on the dark status bar (works on both platforms).
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (err) {
    console.warn('StatusBar init failed:', err);
  }
}

// ─── Splash Screen ───────────────────────────────────────────────────────────
export async function hideSplash() {
  if (!isNative()) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 500 });
  } catch (err) {
    console.warn('SplashScreen hide failed:', err);
  }
}

// ─── Hardware Back Button ────────────────────────────────────────────────────
export async function initBackButton(onBack: () => void) {
  if (!isNative()) return;
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        onBack(); // show "press again to exit" toast or call App.exitApp()
      }
    });
  } catch (err) {
    console.warn('Back button init failed:', err);
  }
}

export async function exitApp() {
  if (!isNative()) return;
  try {
    const { App } = await import('@capacitor/app');
    await App.exitApp();
  } catch {}
}

// ─── Haptics ─────────────────────────────────────────────────────────────────
export async function hapticSuccess() {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
}

export async function hapticError() {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Error });
  } catch {}
}

/** Light tap feedback for buttons / nav items. No-op on web. */
export async function hapticLight() {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
}
