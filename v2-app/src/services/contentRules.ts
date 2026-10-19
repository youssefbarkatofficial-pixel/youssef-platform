import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEFAULT_CONTENT_RULES } from '../lib/contentRules.ts';
import type { ContentRulesSettings } from '../lib/contentRules.ts';

export async function getContentRules(): Promise<ContentRulesSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'contentRules'));
    if (snap.exists()) {
      const data = snap.data();
      let enabledAt: number | null = null;
      if (typeof data.enabledAt === 'number') {
        enabledAt = data.enabledAt;
      } else if (data.enabledAt?.toMillis) {
        enabledAt = data.enabledAt.toMillis();
      }

      return {
        enabled: Boolean(data.enabled),
        enabledAt,
        watchThreshold: typeof data.watchThreshold === 'number' ? data.watchThreshold : 0.95
      };
    }

    // fallback: platform_settings/contentRules
    const altSnap = await getDoc(doc(db, 'platform_settings', 'contentRules'));
    if (altSnap.exists()) {
      const data = altSnap.data();
      let enabledAt: number | null = null;
      if (typeof data.enabledAt === 'number') {
        enabledAt = data.enabledAt;
      } else if (data.enabledAt?.toMillis) {
        enabledAt = data.enabledAt.toMillis();
      }

      return {
        enabled: Boolean(data.enabled),
        enabledAt,
        watchThreshold: typeof data.watchThreshold === 'number' ? data.watchThreshold : 0.95
      };
    }

    return DEFAULT_CONTENT_RULES;
  } catch (err) {
    console.warn('Error reading contentRules settings:', err);
    return DEFAULT_CONTENT_RULES;
  }
}

export async function saveContentRules(settings: Partial<ContentRulesSettings>): Promise<void> {
  const payload: Record<string, any> = {
    updatedAt: serverTimestamp()
  };

  if (typeof settings.enabled === 'boolean') {
    payload.enabled = settings.enabled;
  }
  if (typeof settings.enabledAt === 'number') {
    payload.enabledAt = settings.enabledAt;
  }
  if (typeof settings.watchThreshold === 'number') {
    payload.watchThreshold = settings.watchThreshold;
  }

  await setDoc(doc(db, 'settings', 'contentRules'), payload, { merge: true });
}

export async function enableContentRules(threshold: number = 0.95): Promise<ContentRulesSettings> {
  const now = Date.now();
  const settings: ContentRulesSettings = {
    enabled: true,
    enabledAt: now,
    watchThreshold: threshold
  };

  await setDoc(doc(db, 'settings', 'contentRules'), {
    enabled: true,
    enabledAt: now,
    watchThreshold: threshold,
    activatedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  return settings;
}

export async function disableContentRules(): Promise<void> {
  await setDoc(doc(db, 'settings', 'contentRules'), {
    enabled: false,
    updatedAt: serverTimestamp()
  }, { merge: true });
}
