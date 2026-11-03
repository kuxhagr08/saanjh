import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCustomization } from '../context/CustomizationContext';
import {
  X,
  Sliders,
  Check,
  Search,
  Smartphone,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const CustomizeModal: React.FC = () => {
  const {
    modules,
    presets,
    enabledModules,
    mobileTabs,
    activePreset,
    isModuleEnabled,
    toggleModule,
    applyPreset,
    setMobileTabs,
    glassIntensity,
    setGlassIntensity,
    resetCustomization,
    customizeModalOpen,
    setCustomizeModalOpen,
  } = useCustomization();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [confirmDisableModule, setConfirmDisableModule] = useState<string | null>(null);

  useEffect(() => {
    if (customizeModalOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [customizeModalOpen]);

  if (!customizeModalOpen) return null;

  const categories = [
    { id: 'all', label: 'All Modules' },
    { id: 'communication', label: 'Chat & Circle' },
    { id: 'social', label: 'Social / Samaj' },
    { id: 'productivity', label: 'Planner & AI' },
    { id: 'vault', label: 'Encrypted Vault' },
    { id: 'utilities', label: 'Utilities' },
  ];

  const filteredModules = modules.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tagline.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || m.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleToggleClick = (moduleId: string, currentlyEnabled: boolean) => {
    if (currentlyEnabled) {
      setConfirmDisableModule(moduleId);
    } else {
      toggleModule(moduleId, true);
    }
  };

  const handleConfirmDisable = (keepData: boolean) => {
    if (confirmDisableModule) {
      toggleModule(confirmDisableModule, false);
      setConfirmDisableModule(null);
    }
  };

  const handleMobileTabToggle = (moduleId: string) => {
    if (mobileTabs.includes(moduleId)) {
      if (mobileTabs.length <= 2) return; // Keep at least 2
      setMobileTabs(mobileTabs.filter((id) => id !== moduleId));
    } else {
      if (mobileTabs.length >= 5) {
        // Replace last item
        setMobileTabs([...mobileTabs.slice(0, 4), moduleId]);
      } else {
        setMobileTabs([...mobileTabs, moduleId]);
      }
    }
  };

  const pendingModuleObj = modules.find((m) => m.id === confirmDisableModule);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-fade-in" onClick={() => setCustomizeModalOpen(false)}>
      <div className="w-full max-w-3xl bg-apna-surface border border-apna-border rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden z-50" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-apna-border flex items-center justify-between bg-apna-surface-2/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-apna-accent/15 text-apna-accent flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-apna-text">Customize Your Saanjh Space</h2>
              <p className="text-xs text-apna-muted">
                Turn on only what you need. Zero background work when turned off.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCustomizeModalOpen(false)}
            className="w-8 h-8 rounded-xl hover:bg-apna-surface-2 text-apna-muted hover:text-apna-text flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Personality Presets */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-apna-muted flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-apna-accent" />
                Quick Lifestyle Presets
              </span>
              <button
                onClick={resetCustomization}
                className="text-[11px] font-semibold text-apna-muted hover:text-apna-accent flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {presets.map((p) => {
                const isSelected = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-apna-accent bg-apna-accent/10 shadow-xs'
                        : 'border-apna-border bg-apna-surface-2/50 hover:bg-apna-surface-2'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-apna-text">{p.name.split(' ')[0]}</span>
                      {isSelected && <Check className="w-3 h-3 text-apna-accent" />}
                    </div>
                    <span className="text-[10px] text-apna-muted line-clamp-1">{p.badge}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search & Category Filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-apna-faint" />
              <input
                type="text"
                placeholder="Search modules or features (e.g. Chat, Social, AI, Habits)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-apna-surface-2 border border-apna-border rounded-2xl text-xs text-apna-text placeholder:text-apna-faint focus:outline-none focus:border-apna-accent transition-colors"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    activeCategory === c.id
                      ? 'bg-apna-accent text-white shadow-xs'
                      : 'bg-apna-surface-2 text-apna-muted hover:text-apna-text'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Module List with Toggles */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-apna-muted">
              Modules & Capabilities ({filteredModules.length})
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredModules.map((mod) => {
                const enabled = isModuleEnabled(mod.id);
                return (
                  <div
                    key={mod.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      enabled
                        ? 'border-apna-border bg-apna-surface shadow-2xs'
                        : 'border-apna-border/50 bg-apna-surface-2/40 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-apna-text truncate">{mod.name}</h4>
                          {!mod.canBeDisabled && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-apna-surface-2 text-apna-faint">
                              Core
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-apna-muted mt-0.5 line-clamp-1">{mod.tagline}</p>
                      </div>

                      {/* Toggle button */}
                      {mod.canBeDisabled ? (
                        <button
                          type="button"
                          onClick={() => handleToggleClick(mod.id, enabled)}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                            enabled ? 'bg-apna-accent' : 'bg-stone-300 dark:bg-stone-700'
                          }`}
                        >
                          <span
                            className={`block w-4 h-4 rounded-full bg-white transition-transform transform shadow-sm ${
                              enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-semibold shrink-0">Always On</span>
                      )}
                    </div>

                    <p className="text-[10px] text-apna-faint mt-2.5 pt-2 border-t border-apna-border/40">
                      {enabled ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <Eye className="w-3 h-3" /> Visible in navigation & active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-apna-faint">
                          <EyeOff className="w-3 h-3" /> Turned off · routes & background blocked
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile Bottom Tab Bar Customizer */}
          <div className="p-4 rounded-2xl border border-apna-border bg-apna-surface-2/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-apna-text flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-apna-accent" />
                Mobile Liquid-Glass Tab Bar (Choose up to 5)
              </span>
              <span className="text-[11px] text-apna-faint">{mobileTabs.length}/5 selected</span>
            </div>
            <p className="text-[11px] text-apna-muted leading-relaxed">
              Choose which modules appear directly on the floating glass tab bar on your phone.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {modules
                .filter((m) => isModuleEnabled(m.id))
                .map((m) => {
                  const isSelected = mobileTabs.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleMobileTabToggle(m.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-apna-accent text-white shadow-xs'
                          : 'bg-apna-surface border border-apna-border text-apna-muted hover:text-apna-text'
                      }`}
                    >
                      <span>{m.name}</span>
                      {isSelected ? <Check className="w-3 h-3" /> : <span className="text-[10px]">+</span>}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-apna-border bg-apna-surface-2/60 flex items-center justify-between">
          <p className="text-xs text-apna-faint">Settings are synced securely to this browser device.</p>
          <button
            onClick={() => setCustomizeModalOpen(false)}
            className="px-5 py-2.5 rounded-xl bg-apna-accent hover:bg-apna-accent-ink text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
          >
            Apply & Close
          </button>
        </div>

        {/* Confirmation Dialog on Disable */}
        {confirmDisableModule && pendingModuleObj && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-sm bg-apna-surface border border-apna-border rounded-3xl p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-apna-text">
                Turn off {pendingModuleObj.name}?
              </h3>
              <p className="text-xs text-apna-muted leading-relaxed">
                {pendingModuleObj.whatTurningOffDoes}
              </p>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handleConfirmDisable(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-apna-accent text-white text-xs font-semibold hover:bg-apna-accent-ink transition-colors cursor-pointer"
                >
                  Turn Off (Keep My Data Safe)
                </button>
                <button
                  onClick={() => setConfirmDisableModule(null)}
                  className="w-full py-2 px-4 rounded-xl border border-apna-border text-apna-text text-xs font-semibold hover:bg-apna-surface-2 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
