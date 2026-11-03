import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Users,
  Shield,
  Sparkles,
  Check,
  Plus,
  MessageSquare,
  Share2,
  Lock,
  Globe,
} from 'lucide-react';
import { APP_NAME } from '../../constants';

export interface CircleItem {
  id: string;
  name: string;
  tagline: string;
  category: string;
  membersCount: number;
  isMember: boolean;
  rules: string[];
  bannerGradient: string;
  description?: string;
  isPrivate?: boolean;
}

interface CircleDetailModalProps {
  isOpen: boolean;
  circle: CircleItem | null;
  onClose: () => void;
  onToggleJoin: (circleId: string) => void;
  onPostToCircle?: (circleId: string) => void;
}

export const CircleDetailModal: React.FC<CircleDetailModalProps> = ({
  isOpen,
  circle,
  onClose,
  onToggleJoin,
  onPostToCircle,
}) => {
  const [activeTab, setActiveTab] = useState<'about' | 'rules' | 'members'>('about');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (isOpen && circle) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, circle]);

  if (!isOpen || !circle) return null;

  const handleShare = () => {
    navigator.clipboard?.writeText?.(window.location.origin + `/#/samaj/circle/${circle.id}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const sampleMembers = [
    { name: 'Aarav Mehta', role: 'Moderator', handle: 'aarav_mindful' },
    { name: 'Dr. Ananya Rao', role: 'Member', handle: 'ananya_neuro' },
    { name: 'Priya Sharma', role: 'Member', handle: 'priya_creative' },
    { name: 'Vikram Joshi', role: 'Member', handle: 'vikram_code' },
  ];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="circle-detail-title"
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-apna-surface rounded-3xl border border-apna-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up z-50"
      >
        {/* Banner */}
        <div
          className={`h-28 bg-gradient-to-r ${circle.bannerGradient || 'from-indigo-600 to-purple-800'} p-4 flex items-between justify-between relative text-white`}
        >
          <div className="flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-xs text-[11px] font-semibold">
            {circle.isPrivate ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
            <span>{circle.category}</span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close circle modal"
            className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors cursor-pointer self-start"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Header Content */}
        <div className="px-5 pt-3 pb-3 border-b border-apna-border space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="circle-detail-title" className="text-lg font-bold text-apna-text leading-tight">
                {circle.name}
              </h2>
              <p className="text-xs text-apna-faint mt-0.5">{circle.membersCount} mindful members</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleJoin(circle.id)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  circle.isMember
                    ? 'bg-apna-surface-2 text-apna-text border border-apna-border hover:bg-rose-500/10 hover:text-rose-500'
                    : 'bg-apna-accent text-white shadow-xs hover:bg-apna-accent-ink'
                }`}
              >
                {circle.isMember ? 'Joined' : 'Join Circle'}
              </button>

              <button
                onClick={handleShare}
                className="p-2 rounded-xl bg-apna-surface-2 text-apna-text border border-apna-border hover:bg-apna-surface transition-colors cursor-pointer"
                title="Share Circle"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className="text-xs text-apna-text leading-relaxed">
            {circle.tagline}
          </p>

          {copiedLink && (
            <p className="text-[11px] text-emerald-500 font-semibold">
              Circle link copied to clipboard!
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-apna-border bg-apna-surface-2">
          <button
            onClick={() => setActiveTab('about')}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'about'
                ? 'border-apna-accent text-apna-accent bg-apna-surface'
                : 'border-transparent text-apna-muted hover:text-apna-text'
            }`}
          >
            About
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'rules'
                ? 'border-apna-accent text-apna-accent bg-apna-surface'
                : 'border-transparent text-apna-muted hover:text-apna-text'
            }`}
          >
            Rules ({circle.rules.length})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'members'
                ? 'border-apna-accent text-apna-accent bg-apna-surface'
                : 'border-transparent text-apna-muted hover:text-apna-text'
            }`}
          >
            Members
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[160px] max-h-64 text-xs">
          {activeTab === 'about' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-apna-surface-2 border border-apna-border space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-apna-text">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span>Zero-Tracking Community Guarantee</span>
                </div>
                <p className="text-apna-faint text-[11px] leading-relaxed">
                  Discussions in this circle do not train external advertising models. Members connect device-to-device through {APP_NAME}'s ephemeral courier.
                </p>
              </div>

              {onPostToCircle && circle.isMember && (
                <button
                  onClick={() => {
                    onPostToCircle(circle.id);
                    onClose();
                  }}
                  className="w-full py-2.5 rounded-xl bg-apna-accent text-white font-semibold flex items-center justify-center gap-2 hover:bg-apna-accent-ink transition-colors shadow-xs cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Start Discussion in this Circle</span>
                </button>
              )}
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-2">
              {circle.rules.map((rule, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-apna-surface-2 border border-apna-border flex items-start gap-2.5"
                >
                  <span className="w-5 h-5 rounded-full bg-apna-accent/15 text-apna-accent font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-apna-text leading-relaxed">{rule}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-2">
              {sampleMembers.map((m, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-apna-surface-2 border border-apna-border"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-apna-accent text-white font-bold text-xs flex items-center justify-center">
                      {m.name.slice(0, 1)}
                    </div>
                    <div>
                      <p className="font-bold text-apna-text">{m.name}</p>
                      <p className="text-[10px] text-apna-faint">@{m.handle}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-apna-surface border border-apna-border text-apna-muted">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

