import React, { useRef, useState } from 'react';
import {
  Image,
  Video,
  FileText,
  MapPin,
  Camera,
  X,
  Upload,
  Loader2,
  Check,
} from 'lucide-react';
import type { MessageAttachment } from '../db';

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSendAttachment: (attachment: MessageAttachment, caption?: string) => Promise<void>;
}

export const AttachmentMenu: React.FC<AttachmentMenuProps> = ({
  isOpen,
  onClose,
  onSendAttachment,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  if (!isOpen) return null;

  // Compress and read image as base64 data URL
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1280;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle Photo/Video input
  const handlePhotoVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      if (file.type.startsWith('image/')) {
        const compressedBase64 = await processImageFile(file);
        await onSendAttachment({
          type: 'image',
          data: compressedBase64,
          url: compressedBase64,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });
      } else if (file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = async (re) => {
          const base64 = re.target?.result as string;
          await onSendAttachment({
            type: 'video',
            data: base64,
            url: base64,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          });
        };
        reader.readAsDataURL(file);
      }
      onClose();
    } catch (err) {
      console.error('Failed to process media attachment:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Document input
  const handleDocChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (re) => {
        const base64 = re.target?.result as string;
        await onSendAttachment({
          type: 'document',
          data: base64,
          url: base64,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
        });
        onClose();
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to process document attachment:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Location Sharing
  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          await onSendAttachment({
            type: 'location',
            location: {
              latitude: lat,
              longitude: lng,
              address: `Lat: ${lat.toFixed(4)}, Long: ${lng.toFixed(4)}`,
            },
          });
          onClose();
        } finally {
          setLocationLoading(false);
        }
      },
      (err) => {
        setLocationLoading(false);
        alert(`Location permission denied: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Open Webcam viewfinder
  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoElementRef.current) {
        videoElementRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('Unable to access camera. Please check permissions.');
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoElementRef.current) return;
    const video = videoElementRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoData = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(photoData);
    stopCamera();
  };

  const sendCapturedPhoto = async () => {
    if (!capturedImage) return;
    setIsProcessing(true);
    try {
      await onSendAttachment({
        type: 'image',
        data: capturedImage,
        url: capturedImage,
        fileName: `photo_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
      });
      onClose();
    } finally {
      setIsProcessing(false);
      setCapturedImage(null);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const closeCameraModal = () => {
    stopCamera();
    setCameraActive(false);
    setCapturedImage(null);
  };

  return (
    <>
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handlePhotoVideoChange}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.zip,.xlsx,.csv,.ppt,.pptx"
        className="hidden"
        onChange={handleDocChange}
      />

      {/* Camera Fullscreen Viewfinder Modal */}
      {cameraActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-3xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 z-10 bg-gradient-to-b from-black/80 to-transparent">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <Camera size={18} className="text-violet-400" /> Instant Camera
              </span>
              <button
                onClick={closeCameraModal}
                className="p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
              {capturedImage ? (
                <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
              ) : (
                <video
                  ref={videoElementRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="p-4 flex items-center justify-center gap-6 bg-slate-900">
              {capturedImage ? (
                <>
                  <button
                    onClick={() => {
                      setCapturedImage(null);
                      startCamera();
                    }}
                    className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20"
                  >
                    Retake
                  </button>
                  <button
                    onClick={sendCapturedPhoto}
                    disabled={isProcessing}
                    className="px-6 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-violet-700 shadow-lg shadow-violet-600/30"
                  >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Send Photo
                  </button>
                </>
              ) : (
                <button
                  onClick={capturePhoto}
                  className="w-16 h-16 rounded-full border-4 border-white bg-violet-600 hover:bg-violet-500 shadow-xl flex items-center justify-center transition-transform transform active:scale-95"
                >
                  <Camera size={24} className="text-white" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Liquid-Glass Action Sheet */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="absolute bottom-20 left-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="p-3 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl flex flex-col gap-2 min-w-[220px]">
          <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 pt-1">
            Share Privately (On-Device)
          </div>

          {/* Camera Snap */}
          <button
            onClick={startCamera}
            className="flex items-center gap-3 w-full p-2.5 rounded-2xl hover:bg-violet-500/10 text-slate-700 dark:text-slate-200 transition-colors text-left font-medium text-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-pink-500/15 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
              <Camera size={20} />
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight">Camera</div>
              <div className="text-[11px] text-slate-400 font-normal">Take a live photo</div>
            </div>
          </button>

          {/* Photos & Videos */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 w-full p-2.5 rounded-2xl hover:bg-violet-500/10 text-slate-700 dark:text-slate-200 transition-colors text-left font-medium text-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
              <Image size={20} />
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight">Photos & Videos</div>
              <div className="text-[11px] text-slate-400 font-normal">Images & video clips</div>
            </div>
          </button>

          {/* Documents */}
          <button
            onClick={() => docInputRef.current?.click()}
            className="flex items-center gap-3 w-full p-2.5 rounded-2xl hover:bg-violet-500/10 text-slate-700 dark:text-slate-200 transition-colors text-left font-medium text-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight">Document</div>
              <div className="text-[11px] text-slate-400 font-normal">PDF, DOC, TXT, Zip</div>
            </div>
          </button>

          {/* Location */}
          <button
            onClick={handleShareLocation}
            disabled={locationLoading}
            className="flex items-center gap-3 w-full p-2.5 rounded-2xl hover:bg-violet-500/10 text-slate-700 dark:text-slate-200 transition-colors text-left font-medium text-sm disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              {locationLoading ? <Loader2 size={20} className="animate-spin" /> : <MapPin size={20} />}
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight">Location</div>
              <div className="text-[11px] text-slate-400 font-normal">
                {locationLoading ? 'Fetching GPS...' : 'Share live location'}
              </div>
            </div>
          </button>
        </div>
      </div>
    </>
  );
};
