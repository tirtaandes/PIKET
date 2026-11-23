import React, { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { Camera, CameraOff, RefreshCw, Keyboard, Send } from 'lucide-react';

interface QrScannerViewProps {
  enabled: boolean;
  busy?: boolean;
  onScan: (token: string) => void;
  disabledMessage?: string;
}

export const QrScannerView: React.FC<QrScannerViewProps> = ({
  enabled,
  busy = false,
  onScan,
  disabledMessage
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScannedRef = useRef<{ token: string; ts: number }>({ token: '', ts: 0 });
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [showManual, setShowManual] = useState<boolean>(false);

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1046.5;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Ignore audio block
    }
  };

  useEffect(() => {
    if (!enabled) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      return;
    }

    let cancelled = false;
    const reader = new BrowserQRCodeReader();

    async function startScanner() {
      setCameraError('');
      try {
        const devices = await BrowserQRCodeReader.listVideoInputDevices();
        if (cancelled) return;
        setCameras(devices);

        // Prioritize rear/environment camera as default on mobile devices
        let targetId = selectedDeviceId;
        if (!targetId && devices.length > 0) {
          const rear = devices.find((d) =>
            /back|rear|environment|belakang/i.test(d.label)
          );
          targetId = rear ? rear.deviceId : devices[0].deviceId;
          setSelectedDeviceId(targetId);
        }

        if (!videoRef.current) return;

        const constraints: MediaStreamConstraints = {
          video: targetId
            ? { deviceId: { exact: targetId } }
            : { facingMode: { ideal: 'environment' } }
        };

        const controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current,
          (result) => {
            if (!result) return;
            const text = result.getText().trim();
            if (!text) return;
            const now = Date.now();
            if (
              lastScannedRef.current.token === text &&
              now - lastScannedRef.current.ts < 3000
            ) {
              return;
            }
            lastScannedRef.current = { token: text, ts: now };
            playBeep();
            onScanRef.current(text);
          }
        );

        if (cancelled) {
          controls.stop();
        } else {
          controlsRef.current = controls;
        }
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            err instanceof Error
              ? `Kamera tidak dapat diakses (${err.message}). Pastikan izin kamera aktif atau gunakan input scanner USB.`
              : 'Kamera tidak dapat diakses.'
          );
        }
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [enabled, selectedDeviceId]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = manualInput.trim();
    if (!token || !enabled || busy) return;
    setManualInput('');
    onScan(token);
  };

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50 px-6 py-14 text-center">
        <CameraOff className="h-12 w-12 text-rose-500" />
        <p className="mt-3 text-base font-bold text-rose-800">
          {disabledMessage || 'SCANNER TIDAK AKTIF'}
        </p>
        <p className="mt-1 max-w-md text-xs text-rose-600">
          Validasi jadwal piket ditegakkan secara otomatis di server backend.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-slate-950 shadow-lg">
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full object-cover sm:aspect-[16/10]"
          muted
          playsInline
        />
        {/* Targeting frame */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-56 w-56 rounded-2xl border-2 border-sky-400/90 shadow-[0_0_0_9999px_rgba(9,23,44,0.45)] sm:h-64 sm:w-64">
            <span className="absolute -left-0.5 -top-0.5 h-7 w-7 rounded-tl-xl border-l-4 border-t-4 border-emerald-400" />
            <span className="absolute -right-0.5 -top-0.5 h-7 w-7 rounded-tr-xl border-r-4 border-t-4 border-emerald-400" />
            <span className="absolute -bottom-0.5 -left-0.5 h-7 w-7 rounded-bl-xl border-b-4 border-l-4 border-emerald-400" />
            <span className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-br-xl border-b-4 border-r-4 border-emerald-400" />
          </div>
        </div>

        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-navy-950/70 backdrop-blur-xs">
            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-lg">
              <RefreshCw className="h-4 w-4 animate-spin text-sky-600" />
              Memproses QR...
            </div>
          </div>
        )}
      </div>

      {cameraError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {cameraError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {cameras.length > 1 && (
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-slate-500" />
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
            >
              {cameras.map((cam, idx) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label || `Kamera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Keyboard className="h-3.5 w-3.5" />
          {showManual ? 'Tutup Input Barcode USB / Manual' : 'Scanner USB / Input Token'}
        </button>
      </div>

      {showManual && (
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Tempel atau pindai token QR (SA-...)"
            className="input-field font-mono text-xs"
            autoFocus
          />
          <button type="submit" disabled={busy || !manualInput.trim()} className="btn-primary shrink-0">
            <Send className="h-4 w-4" />
            Proses
          </button>
        </form>
      )}
    </div>
  );
};
