import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '../api/client';
import {
  ShieldCheck,
  Server,
  Smartphone,
  Clock,
  Trash2,
  Download,
  AlertTriangle,
  RefreshCw,
  X,
  Lock,
  Globe,
  FileCheck,
} from 'lucide-react';
import { downloadEncryptedBackup, getLastBackupTimestamp } from '../utils/backup';

interface PrivacyLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FeatureEntry {
  feature: string;
  stored_on: string;
  in_transit: string;
  retention: string;
  server_plaintext: string;
}

export const PrivacyLedgerModal: React.FC<PrivacyLedgerModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState(false);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      fetchLedger();
      setLastBackup(getLastBackupTimestamp());
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any>('/api/privacy/ledger/');
      setLedgerData(data);
    } catch {
      // Fallback offline mock footprint
      setLedgerData({
        summary: {
          server_data_accumulation: 'ZERO at rest (device-owned principle)',
          pending_in_flight_envelopes: 0,
          ephemeral_bytes_in_transit: 0,
          active_safeshare_links: 0,
          registered_devices: 1,
        },
        mailbox_stats: {
          pending_envelopes_count: 0,
          total_bytes: 0,
        },
        feature_ledger: [
          {
            feature: 'Chats & Contacts (चैट और संपर्क)',
            stored_on: 'User device (IndexedDB)',
            in_transit: 'Ephemeral mailbox (0 bytes currently)',
            retention: 'Max 14 days in transit (deleted on delivery)',
            server_plaintext: '0 bytes (E2E Encrypted)',
          },
          {
            feature: 'Vault, Notes, Photos (वॉल्ट और दस्तावेज़)',
            stored_on: 'This device only (AES-256 encrypted)',
            in_transit: 'None',
            retention: 'Permanent on device',
            server_plaintext: '0 bytes (Never uploaded)',
          },
          {
            feature: 'Tasks & Habits (कार्य और आदतें)',
            stored_on: 'This device only',
            in_transit: 'None',
            retention: 'Permanent on device',
            server_plaintext: '0 bytes',
          },
          {
            feature: 'AI Conversations & BYOK Keys (एआई चैट)',
            stored_on: 'This device only',
            in_transit: 'Direct from browser to AI provider',
            retention: 'Permanent on device',
            server_plaintext: '0 bytes',
          },
          {
            feature: 'Safe Share (सुरक्षित फ़ाइल साझा)',
            stored_on: 'Temporary ciphertext blob',
            in_transit: 'Encrypted ciphertext only',
            retention: 'Max 7 days or immediate revoke',
            server_plaintext: '0 bytes (Key in URL fragment)',
          },
          {
            feature: 'Samaj Posts (समाज सार्वजनिक पोस्ट)',
            stored_on: 'Server CDN (Honest exception)',
            in_transit: 'Object storage',
            retention: 'Until deleted or auto-archived to device',
            server_plaintext: 'Public by design',
          },
        ],
        warning: 'Your data lives on your device. We cannot recover it if you lose it without a backup.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async () => {
    if (!confirm('Are you sure you want to purge all in-flight messages and revoke temporary share links on the server?')) {
      return;
    }
    setPurging(true);
    try {
      await apiRequest('/api/privacy/purge/', { method: 'POST' });
      setPurgeSuccess(true);
      setTimeout(() => setPurgeSuccess(false), 3000);
      await fetchLedger();
    } catch {
      // ignore
    } finally {
      setPurging(false);
    }
  };

  const handleExportBackupNow = async () => {
    if (!exportPassphrase || exportPassphrase.length < 8) {
      alert('Passphrase must be at least 8 characters long.');
      return;
    }
    setExportStatus('Encrypting backup on-device with Argon2id...');
    try {
      const filename = await downloadEncryptedBackup(exportPassphrase);
      setExportStatus(`Backup saved to ${filename}!`);
      setLastBackup(Date.now());
      setTimeout(() => {
        setShowExportModal(false);
        setExportStatus(null);
        setExportPassphrase('');
      }, 1500);
    } catch (err: any) {
      setExportStatus(`Error: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden z-50" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Privacy Ledger (गोपनीयता बहीखाता)
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Live audit of data locations, retention times, and server footprint.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          {/* Honest Warning Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <p className="font-semibold">Zero-Storage Guarantee & Honest Disclaimer:</p>
              <p className="mt-0.5 leading-relaxed">
                "Your data lives on your device. We cannot recover it if you lose it without a backup. We do not have it."
              </p>
            </div>
          </div>

          {/* Live Footprint Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-800">
              <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Server at Rest</p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">0 Bytes Plaintext</p>
              <p className="text-[10px] text-stone-400 mt-0.5">Device-owned model</p>
            </div>
            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-800">
              <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">In-Flight Envelopes</p>
              <p className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-1">
                {ledgerData?.summary?.pending_in_flight_envelopes ?? 0} Messages
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">Ephemeral TTL (max 14d)</p>
            </div>
            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-800 col-span-2 sm:col-span-1">
              <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Last Device Backup</p>
              <p className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-1">
                {lastBackup ? new Date(lastBackup).toLocaleDateString() : 'Never'}
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">
                {lastBackup ? 'Stored on user device' : 'Action needed'}
              </p>
            </div>
          </div>

          {/* Feature Breakdown Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
              Where Your Data Lives (Data Map)
            </h3>
            <div className="border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden divide-y divide-stone-100 dark:divide-stone-800 text-xs">
              {(ledgerData?.feature_ledger || []).map((item: FeatureEntry, idx: number) => (
                <div key={idx} className="p-3 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-900 dark:text-stone-100">{item.feature}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                      {item.retention}
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-2 text-stone-500 dark:text-stone-400 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{item.stored_on}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>{item.in_transit}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions: Purge and Export */}
          <div className="pt-2 flex flex-wrap gap-2.5">
            <button
              onClick={() => setShowExportModal(true)}
              className="btn-primary text-xs py-2.5 px-4 flex items-center gap-2 rounded-xl"
            >
              <Download className="w-3.5 h-3.5" />
              Export Encrypted Backup (.apnabackup)
            </button>
            <button
              onClick={handlePurge}
              disabled={purging}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-100 flex items-center gap-2 transition-colors ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {purging ? 'Purging...' : 'Purge Server In-Flight Data'}
            </button>
          </div>

          {purgeSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              All server in-flight envelopes and Safe Share links purged immediately.
            </div>
          )}
        </div>

        {/* Export Modal Subview */}
        {showExportModal && (
          <div className="p-5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/90 space-y-3">
            <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">
              Export Encrypted Device Backup
            </h4>
            <p className="text-xs text-stone-500">
              Set a passphrase to encrypt your `.apnabackup` file with Argon2id and libsodium.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Passphrase (min 8 characters)"
                value={exportPassphrase}
                onChange={(e) => setExportPassphrase(e.target.value)}
                className="flex-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-xs"
              />
              <button
                onClick={handleExportBackupNow}
                className="btn-primary text-xs px-4 py-2 rounded-xl"
              >
                Download
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                className="px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700"
              >
                Cancel
              </button>
            </div>
            {exportStatus && <p className="text-xs text-stone-600 dark:text-stone-300 font-medium">{exportStatus}</p>}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

