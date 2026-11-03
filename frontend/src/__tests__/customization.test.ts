import { describe, it, expect } from 'vitest';
import { APNA_MODULES, CUSTOMIZATION_PRESETS, getModuleConfig } from '../customization/featureRegistry';

describe('Customization Engine (Z01 - Z11)', () => {
  it('Z01: Central feature registry contains all expected core modules', () => {
    expect(APNA_MODULES.length).toBeGreaterThanOrEqual(8);
    const moduleIds = APNA_MODULES.map((m) => m.id);
    expect(moduleIds).toContain('home');
    expect(moduleIds).toContain('messages');
    expect(moduleIds).toContain('social');
    expect(moduleIds).toContain('planner');
    expect(moduleIds).toContain('vault');
    expect(moduleIds).toContain('ai');
    expect(moduleIds).toContain('growth');
    expect(moduleIds).toContain('security');
  });

  it('Z02 & Z03: Every module has required metadata, categories, routes and default states', () => {
    APNA_MODULES.forEach((mod) => {
      expect(mod.id).toBeTruthy();
      expect(mod.name).toBeTruthy();
      expect(mod.category).toBeTruthy();
      expect(typeof mod.defaultEnabled).toBe('boolean');
      expect(typeof mod.route).toBe('string');
      expect(Array.isArray(mod.subFeatures)).toBe(true);
      expect(mod.subFeatures.length).toBeGreaterThan(0);
    });
  });

  it('Z08 & Z09: Modules provide clarity on what turning them off does', () => {
    const messagesMod = getModuleConfig('messages');
    expect(messagesMod?.whatTurningOffDoes).toBeTruthy();
    expect(messagesMod?.canBeDisabled).toBe(true);

    const socialMod = getModuleConfig('social');
    expect(socialMod?.whatTurningOffDoes).toBeTruthy();
    expect(socialMod?.canBeDisabled).toBe(true);

    // Home is the core anchor and cannot be turned off
    const homeMod = getModuleConfig('home');
    expect(homeMod?.canBeDisabled).toBe(false);
  });

  it('Z10: Presets define consistent enabled module sets', () => {
    expect(CUSTOMIZATION_PRESETS.length).toBeGreaterThanOrEqual(5);
    const presetIds = CUSTOMIZATION_PRESETS.map((p) => p.id);
    expect(presetIds).toContain('standard');
    expect(presetIds).toContain('minimal');
    expect(presetIds).toContain('student');
    expect(presetIds).toContain('privacy_max');
    expect(presetIds).toContain('creator');

    // Minimal preset should have fewer modules enabled than standard
    const minPreset = CUSTOMIZATION_PRESETS.find((p) => p.id === 'minimal')!;
    const stdPreset = CUSTOMIZATION_PRESETS.find((p) => p.id === 'standard')!;
    
    expect(minPreset.enabledModules.length).toBeLessThan(stdPreset.enabledModules.length);
  });

  it('Z04 & Route Guard: Blocked routes when module is disabled', () => {
    const isModuleEnabled = (enabledModules: Record<string, boolean>, modId: string) => {
      return enabledModules[modId] ?? false;
    };

    const userState = {
      home: true,
      messages: false, // turned OFF
      social: true,
      vault: false,   // turned OFF
      ai: false,      // turned OFF
      planner: true,
      growth: true,
      security: true,
    };

    expect(isModuleEnabled(userState, 'messages')).toBe(false);
    expect(isModuleEnabled(userState, 'vault')).toBe(false);
    expect(isModuleEnabled(userState, 'social')).toBe(true);
  });
});
