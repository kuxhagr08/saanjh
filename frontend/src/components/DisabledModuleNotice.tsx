import React from 'react';
import { useCustomization } from '../context/CustomizationContext';
import { EyeOff, Sparkles, Sliders, ArrowLeft } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface DisabledModuleNoticeProps {
  moduleId: string;
}

export const DisabledModuleNotice: React.FC<DisabledModuleNoticeProps> = ({ moduleId }) => {
  const { modules, toggleModule, setCustomizeModalOpen } = useCustomization();
  const mod = modules.find((m) => m.id === moduleId);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 animate-fade-in">
      <div className="w-full max-w-md bg-apna-surface border border-apna-border rounded-3xl p-8 shadow-sm space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-apna-surface-2 text-apna-muted flex items-center justify-center mx-auto">
          <EyeOff className="w-7 h-7 stroke-[1.5]" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-apna-text">
            {mod?.name || 'Module'} is Turned Off
          </h2>
          <p className="text-xs text-apna-muted mt-1 leading-relaxed">
            {mod?.tagline || 'This feature has been deactivated in your space to keep your interface calm and focused.'}
          </p>
        </div>

        <div className="space-y-2 pt-2">
          {mod && mod.canBeDisabled && (
            <button
              onClick={() => toggleModule(mod.id, true)}
              className="w-full py-2.5 px-4 rounded-xl bg-apna-accent hover:bg-apna-accent-ink text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Turn On {mod.name}
            </button>
          )}

          <button
            onClick={() => setCustomizeModalOpen(true)}
            className="w-full py-2.5 px-4 rounded-xl border border-apna-border text-apna-text hover:bg-apna-surface-2 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-apna-accent" />
            Customize Modules & Presets
          </button>

          <NavLink
            to="/"
            className="block text-xs text-apna-muted hover:text-apna-text pt-2 transition-colors"
          >
            Return to Home Dashboard
          </NavLink>
        </div>
      </div>
    </div>
  );
};
