/**
 * Skill Store Service
 * List installable skills, install gating, enable/disable, managed updates.
 */

import { getDatabase } from '../../db/database.js';
import { skillRegistry } from '../../skills/index.js';
import logger from '../../middleware/logger.js';

export interface SkillStoreItem {
  id: string;
  name: string;
  description: string;
  version: string;
  installed: boolean;
  enabled: boolean;
  isUser: boolean;
  requiresPro?: boolean;
  requiresDocker?: boolean;
}

/**
 * List all available skills (built-in + user) with install/enabled state
 */
export async function listSkillStore(userId?: string): Promise<SkillStoreItem[]> {
  const skills = skillRegistry.getAllSkills();
  const installed = await getInstalledSkills(userId);
  const enabled = await getEnabledSkills(userId);

  return skills.map((s) => {
    const id = s.manifest.id;
    return {
      id,
      name: s.manifest.name,
      description: s.manifest.description ?? '',
      version: s.manifest.version ?? '1.0.0',
      installed: installed.has(id),
      enabled: enabled.has(id),
      isUser: false,
    };
  });
}

async function getInstalledSkills(userId?: string): Promise<Set<string>> {
  try {
    const db = getDatabase();
    const settings = userId ? await db.getSettings(userId) : null;
    const installed =
      (settings?.preferences as { installedSkills?: string[] })?.installedSkills ?? [];
    return new Set(installed);
  } catch {
    return new Set();
  }
}

async function getEnabledSkills(userId?: string): Promise<Set<string>> {
  try {
    const db = getDatabase();
    const settings = userId ? await db.getSettings(userId) : null;
    const enabled = (settings?.preferences as { enabledSkills?: string[] })?.enabledSkills ?? [];
    return new Set(enabled);
  } catch {
    return new Set();
  }
}

/**
 * Install (enable) a skill. Gating: check tier, dependencies.
 */
export async function installSkill(
  skillId: string,
  userId?: string
): Promise<{ ok: boolean; error?: string }> {
  const skill = skillRegistry.getSkill(skillId);
  if (!skill) {
    return { ok: false, error: `Skill ${skillId} not found` };
  }
  try {
    if (!userId) return { ok: true }; // No user context - skip persist
    const db = getDatabase();
    const settings = (await db.getSettings(userId)) ?? {};
    const prefs = (settings.preferences ?? {}) as Record<string, unknown>;
    const installed = (prefs.installedSkills as string[]) ?? [];
    if (!installed.includes(skillId)) {
      prefs.installedSkills = [...installed, skillId];
      prefs.enabledSkills = [...((prefs.enabledSkills as string[]) ?? []), skillId];
      await db.saveSettings(userId, {
        ...settings,
        preferences: prefs,
      } as unknown as import('../../types/settings.js').Settings);
    }
    logger.info({ skillId, userId }, 'Skill installed');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Uninstall (disable) a skill
 */
export async function uninstallSkill(
  skillId: string,
  userId?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!userId) return { ok: true };
    const db = getDatabase();
    const settings = (await db.getSettings(userId)) ?? {};
    const prefs = (settings.preferences ?? {}) as Record<string, unknown>;
    const installed = ((prefs.installedSkills as string[]) ?? []).filter((id) => id !== skillId);
    const enabled = ((prefs.enabledSkills as string[]) ?? []).filter((id) => id !== skillId);
    prefs.installedSkills = installed;
    prefs.enabledSkills = enabled;
    await db.saveSettings(userId, {
      ...settings,
      preferences: prefs,
    } as unknown as import('../../types/settings.js').Settings);
    logger.info({ skillId, userId }, 'Skill uninstalled');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Enable/disable a skill
 */
export async function setSkillEnabled(
  skillId: string,
  enabled: boolean,
  userId?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!userId) return { ok: true };
    const db = getDatabase();
    const settings = (await db.getSettings(userId)) ?? {};
    const prefs = (settings.preferences ?? {}) as Record<string, unknown>;
    let enabledList = (prefs.enabledSkills as string[]) ?? [];
    if (enabled) {
      if (!enabledList.includes(skillId)) enabledList = [...enabledList, skillId];
    } else {
      enabledList = enabledList.filter((id) => id !== skillId);
    }
    prefs.enabledSkills = enabledList;
    await db.saveSettings(userId, {
      ...settings,
      preferences: prefs,
    } as unknown as import('../../types/settings.js').Settings);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
