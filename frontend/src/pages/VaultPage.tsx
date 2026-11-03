import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { db, type LocalVaultItem, type LocalNote } from '../db';
import { deriveVaultMasterKey, encryptVaultFile, decryptVaultFile } from '../utils/crypto';
import {
  Lock,
  Upload,
  FileText,
  Image as ImageIcon,
  Video,
  File,
  Trash2,
  Star,
  Search,
  Plus,
  FolderOpen,
  Eye,
  Download,
  X,
  StickyNote,
  Shield,
} from 'lucide-react';

type VaultTab = 'files' | 'notes';

export const VaultPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<VaultTab>('notes');
  const [vaultItems, setVaultItems] = useState<LocalVaultItem[]>([]);
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LocalVaultItem | null>(null);
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<LocalNote | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [showNoteEditor, setShowNoteEditor] = useState(false);

  useEffect(() => {
    loadVaultData();
  }, []);

  useEffect(() => {
    if (showNoteEditor || (selectedItem && decryptedUrl)) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [showNoteEditor, selectedItem, decryptedUrl]);

  const loadVaultData = async () => {
    const [items, notesList] = await Promise.all([
      db.vaultItems.filter((i) => !i.isDeleted).toArray(),
      db.notes.orderBy('updatedAt').reverse().toArray(),
    ]);
    setVaultItems(items);
    setNotes(notesList);
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    try {
      const saltKey = `apna_vault_salt_${user?.email}`;
      let saltHex = localStorage.getItem(saltKey);
      if (!saltHex) {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(saltKey, saltHex);
      }
      const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
      const key = await deriveVaultMasterKey(passphrase, salt);
      setMasterKey(key);
      setIsUnlocked(true);
      setPassphrase('');
    } catch {
      setUnlockError('Failed to derive vault key. Check passphrase.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !masterKey) return;
    setUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        const buffer = await file.arrayBuffer();
        const encrypted = await encryptVaultFile(buffer, masterKey);
        await db.vaultItems.add({
          name: file.name,
          type: file.type.startsWith('image/')
            ? 'image'
            : file.type.startsWith('video/')
            ? 'video'
            : 'document',
          mimeType: file.type,
          sizeBytes: file.size,
          folder: 'Inbox',
          tags: [],
          isFavorite: false,
          isDeleted: false,
          encryptedData: encrypted.encryptedData,
          dataNonce: encrypted.dataNonce,
          wrappedFileKey: encrypted.wrappedFileKey,
          keyNonce: encrypted.keyNonce,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      await loadVaultData();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = async (item: LocalVaultItem) => {
    if (!masterKey) return;
    try {
      const decryptedBuffer = await decryptVaultFile(
        item.encryptedData,
        item.dataNonce,
        item.wrappedFileKey,
        item.keyNonce,
        masterKey
      );
      const blob = new Blob([decryptedBuffer], { type: item.mimeType });
      const url = URL.createObjectURL(blob);
      setDecryptedUrl(url);
      setSelectedItem(item);
    } catch {
      console.error('Decryption failed');
    }
  };

  const handleDelete = async (id: number) => {
    await db.vaultItems.update(id, { isDeleted: true, deletedAt: Date.now() });
    await loadVaultData();
  };

  const handleToggleFavorite = async (item: LocalVaultItem) => {
    await db.vaultItems.update(item.id!, { isFavorite: !item.isFavorite });
    await loadVaultData();
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;
    if (editingNote?.id) {
      await db.notes.update(editingNote.id, {
        title: noteTitle,
        content: noteContent,
        updatedAt: Date.now(),
      });
    } else {
      await db.notes.add({
        title: noteTitle,
        content: noteContent,
        tags: [],
        isPinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    setNoteTitle('');
    setNoteContent('');
    setEditingNote(null);
    setShowNoteEditor(false);
    await loadVaultData();
  };

  const handleDeleteNote = async (id: number) => {
    await db.notes.delete(id);
    await loadVaultData();
  };

  const filteredNotes = notes.filter((n) =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredItems = vaultItems.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFileIcon = (type: string) => {
    if (type === 'image') return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (type === 'video') return <Video className="w-5 h-5 text-purple-500" />;
    if (type === 'note') return <StickyNote className="w-5 h-5 text-amber-500" />;
    return <File className="w-5 h-5 text-apna-muted" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-semibold text-2xl text-apna-text tracking-tight">Private Vault</h1>
        <p className="text-sm text-apna-muted mt-0.5">
          Files and notes encrypted with AES-256-GCM. Only you can decrypt.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex bg-apna-surface-2 border border-apna-border p-1 rounded-xl">
        {[
          { key: 'notes', label: 'Notes', icon: StickyNote },
          { key: 'files', label: 'Files', icon: FolderOpen },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as VaultTab)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-apna-text shadow-sm border border-apna-border'
                : 'text-apna-muted hover:text-apna-text'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-apna-faint" />
        <input
          type="text"
          placeholder={`Search ${activeTab}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="apna-input pl-10"
        />
      </div>

      {/* NOTES TAB */}
      {activeTab === 'notes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-apna-muted font-semibold">{filteredNotes.length} notes</span>
            <button
              onClick={() => { setEditingNote(null); setNoteTitle(''); setNoteContent(''); setShowNoteEditor(true); }}
              className="btn-primary py-2 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              New Note
            </button>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="apna-card p-8 text-center">
              <StickyNote className="w-8 h-8 text-apna-faint mx-auto mb-3" />
              <p className="text-sm font-medium text-apna-text">No notes yet</p>
              <p className="text-xs text-apna-muted mt-1">Your notes live locally, private by default.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredNotes.map((note) => (
                <div key={note.id} className="apna-card p-4 group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setEditingNote(note); setNoteTitle(note.title); setNoteContent(note.content); setShowNoteEditor(true); }}>
                      <div className="flex items-center gap-2">
                        {note.isPinned && (
                          <span className="badge badge-amber text-[10px]">📌 Pinned</span>
                        )}
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{note.title}</h3>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">{note.content}</p>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium mt-2">
                        {new Date(note.updatedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id!)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-apna-faint hover:text-apna-danger transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FILES TAB */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          {!isUnlocked ? (
            <div className="apna-card p-6">
              <div className="flex flex-col items-center text-center mb-5">
                <div className="w-12 h-12 rounded-2xl bg-apna-accent-soft flex items-center justify-center mb-3">
                  <Lock className="w-6 h-6 text-apna-accent" />
                </div>
                <h3 className="font-semibold text-apna-text">Encrypted File Vault</h3>
                <p className="text-xs text-apna-muted mt-1 max-w-xs">
                  Files are encrypted with AES-256-GCM using a key derived from your passphrase. Enter it to unlock.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-apna-surface-2 border border-apna-border flex gap-2 items-center text-xs text-apna-muted mb-4">
                <Shield className="w-3.5 h-3.5 text-apna-success shrink-0" />
                Files are encrypted on your device before display. Your passphrase never leaves this browser.
              </div>

              {unlockError && (
                <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-apna-danger">
                  {unlockError}
                </div>
              )}

              <form onSubmit={handleUnlock} className="space-y-3">
                <input
                  type="password"
                  placeholder="Enter your master passphrase..."
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  required
                  className="apna-input"
                />
                <button type="submit" className="btn-primary w-full">
                  <Lock className="w-4 h-4" />
                  Unlock File Vault
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs badge badge-green">🔓 Vault Unlocked</span>
                  <span className="text-xs text-apna-faint">{filteredItems.length} files</span>
                </div>
                <label className={`btn-primary py-2 px-3 text-xs cursor-pointer ${uploading ? 'opacity-50' : ''}`}>
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? 'Encrypting...' : 'Upload File'}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </div>

              {filteredItems.length === 0 ? (
                <div className="apna-card p-8 text-center border-2 border-dashed border-apna-border">
                  <Upload className="w-8 h-8 text-apna-faint mx-auto mb-3" />
                  <p className="text-sm font-medium text-apna-text">No encrypted files yet</p>
                  <p className="text-xs text-apna-muted mt-1">Upload files to encrypt them locally with AES-256-GCM</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="vault-item group">
                      <div className="w-9 h-9 rounded-xl bg-apna-surface-2 flex items-center justify-center shrink-0">
                        {getFileIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{item.name}</p>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium mt-0.5">
                          {formatSize(item.sizeBytes)} · {item.folder}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handlePreview(item)}
                          className="p-1.5 rounded-lg hover:bg-apna-surface-2 text-apna-muted hover:text-apna-accent transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleFavorite(item)}
                          className={`p-1.5 rounded-lg hover:bg-apna-surface-2 transition-colors ${item.isFavorite ? 'text-amber-500' : 'text-apna-muted hover:text-amber-400'}`}
                          title="Favourite"
                        >
                          <Star className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-amber-500' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id!)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-apna-muted hover:text-apna-danger transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Note Editor Modal */}
      {showNoteEditor && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowNoteEditor(false)}
        >
          <div
            className="w-full max-w-lg bg-apna-surface rounded-3xl border border-apna-border shadow-2xl p-0 overflow-hidden animate-slide-up z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-apna-border">
              <h3 className="font-semibold text-apna-text text-sm">
                {editingNote ? 'Edit Note' : 'New Note'}
              </h3>
              <button onClick={() => setShowNoteEditor(false)} className="text-apna-faint hover:text-apna-text cursor-pointer p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveNote} className="p-4 space-y-3">
              <input
                type="text"
                required
                placeholder="Note title..."
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="apna-input font-medium"
                autoFocus
              />
              <textarea
                rows={8}
                placeholder="Write your thoughts..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="apna-input resize-none leading-relaxed"
              />
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowNoteEditor(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Preview Modal */}
      {selectedItem && decryptedUrl && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={() => { setSelectedItem(null); setDecryptedUrl(null); }}
        >
          <div
            className="w-full max-w-xl bg-apna-surface rounded-3xl border border-apna-border shadow-2xl p-5 overflow-hidden animate-slide-up z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-apna-text truncate">{selectedItem.name}</p>
              <button onClick={() => { setSelectedItem(null); setDecryptedUrl(null); }} className="text-apna-faint hover:text-apna-text cursor-pointer p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            {selectedItem.type === 'image' ? (
              <img src={decryptedUrl} alt={selectedItem.name} className="w-full rounded-xl object-contain max-h-96" />
            ) : selectedItem.type === 'video' ? (
              <video src={decryptedUrl} controls className="w-full rounded-xl max-h-96" />
            ) : (
              <div className="p-6 text-center">
                <File className="w-12 h-12 text-apna-faint mx-auto mb-2" />
                <p className="text-sm text-apna-muted">Preview not available for this file type</p>
              </div>
            )}
            <a
              href={decryptedUrl}
              download={selectedItem.name}
              className="btn-secondary w-full mt-4 text-sm"
            >
              <Download className="w-4 h-4" />
              Download Decrypted File
            </a>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
