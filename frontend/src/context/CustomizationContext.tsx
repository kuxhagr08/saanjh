import React, { createContext, useContext, useState, useEffect } from 'react';
import { APNA_MODULES, CUSTOMIZATION_PRESETS, type AppModuleConfig, type CustomizationPreset } from '../customization/featureRegistry';

interface CustomizationState {
  enabledModules: Record<string, boolean>;
  mobileTabs: string[];
  activePreset: string;
  glassIntensity: 'off' | 'low' | 'high';
}

interface CustomizationContextType extends CustomizationState {
  modules: AppModuleConfig[];
  presets: CustomizationPreset[];
  isModuleEnabled: (moduleId: string) => boolean;
  toggleModule: (moduleId: string, enabled: boolean) => void;
  applyPreset: (presetId: string) => void;
  setMobileTabs: (tabs: string[]) => void;
  setGlassIntensity: (intensity: 'off' | 'low' | 'high') => void;
  resetCustomization: () => void;
  customizeModalOpen: boolean;
  setCustomizeModalOpen: (open: boolean) => void;
}

const STORAGE_KEY = 'apna_customization_v2';

const DEFAULT_STATE: CustomizationState = {
  enabledModules: {
    home: true,
    messages: true,
    social: true,
    vault: true,
    ai: true,
    planner: true,
    growth: true,
    security: true,
  },
  mobileTabs: ['home', 'messages', 'social', 'planner', 'vault'],
  activePreset: 'standard',
  glassIntensity: 'high',
};

const CustomizationContext = createContext<CustomizationContextType | null>(null);

export const CustomizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CustomizationState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_STATE,
          ...parsed,
          enabledModules: { ...DEFAULT_STATE.enabledModules, ...parsed.enabledModules },
        };
      }
    } catch {
      // fallback
    }
    return DEFAULT_STATE;
  });

  const [customizeModalOpen, setCustomizeModalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save customization state', e);
    }
  }, [state]);

  const isModuleEnabled = (moduleId: string): boolean => {
    if (moduleId === 'home' || moduleId === 'security') return true;
    return state.enabledModules[moduleId] ?? true;
  };

  const toggleModule = (moduleId: string, enabled: boolean) => {
    setState((prev) => {
      const updatedModules = { ...prev.enabledModules, [moduleId]: enabled };
      // If disabled module is in mobile tabs, filter it out or replace
      let updatedTabs = prev.mobileTabs;
      if (!enabled && updatedTabs.includes(moduleId)) {
        updatedTabs = updatedTabs.filter((t) => t !== moduleId);
        // Add a fallback enabled module if needed
        const fallback = APNA_MODULES.find((m) => updatedModules[m.id] && !updatedTabs.includes(m.id))?.id;
        if (fallback && updatedTabs.length < 5) {
          updatedTabs.push(fallback);
        }
      }
      return {
        ...prev,
        enabledModules: updatedModules,
        mobileTabs: updatedTabs,
        activePreset: 'custom',
      };
    });
  };

  const applyPreset = (presetId: string) => {
    const preset = CUSTOMIZATION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const newEnabled: Record<string, boolean> = { home: true, security: true };
    APNA_MODULES.forEach((m) => {
      newEnabled[m.id] = preset.enabledModules.includes(m.id);
    });

    setState((prev) => ({
      ...prev,
      enabledModules: newEnabled,
      mobileTabs: preset.mobileTabs,
      activePreset: presetId,
    }));
  };

  const setMobileTabs = (tabs: string[]) => {
    setState((prev) => ({
      ...prev,
      mobileTabs: tabs.slice(0, 5),
    }));
  };

  const setGlassIntensity = (intensity: 'off' | 'low' | 'high') => {
    setState((prev) => ({ ...prev, glassIntensity: intensity }));
  };

  const resetCustomization = () => {
    setState(DEFAULT_STATE);
  };

  return (
    <CustomizationContext.Provider
      value={{
        ...state,
        modules: APNA_MODULES,
        presets: CUSTOMIZATION_PRESETS,
        isModuleEnabled,
        toggleModule,
        applyPreset,
        setMobileTabs,
        setGlassIntensity,
        resetCustomization,
        customizeModalOpen,
        setCustomizeModalOpen,
      }}
    >
      {children}
    </CustomizationContext.Provider>
  );
};

export const useCustomization = () => {
  const context = useContext(CustomizationContext);
  if (!context) {
    throw new Error('useCustomization must be used within a CustomizationProvider');
  }
  return context;
};
