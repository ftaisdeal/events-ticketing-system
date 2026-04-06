import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { useCallback, useEffect, useRef, useState } from 'react';

type ScannerPanelProps = {
  onScan: (code: string) => void;
};

const duplicateWindowMs = 5000;

const isCameraSupported = (): boolean => {
  return Boolean(
    typeof navigator !== 'undefined'
      && navigator.mediaDevices
      && typeof navigator.mediaDevices.getUserMedia === 'function'
  );
};

const getPreferredVideoDeviceId = async (): Promise<string | undefined> => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return undefined;
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter((device) => device.kind === 'videoinput');
  const rearCamera = videoInputs.find((device) => /back|rear|environment/i.test(device.label));

  return rearCamera?.deviceId;
};

const ScannerPanel = ({ onScan }: ScannerPanelProps): JSX.Element => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef<{ value: string; timestamp: number } | null>(null);
  const restartTimeoutRef = useRef<number | null>(null);
  const shouldResumeOnForegroundRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();

    return () => {
      if (restartTimeoutRef.current !== null) {
        window.clearTimeout(restartTimeoutRef.current);
      }

      controlsRef.current?.stop();
      readerRef.current = null;
    };
  }, []);

  const stopScanner = useCallback((options?: { shouldResumeOnForeground?: boolean; statusMessage?: string | null }) => {
    shouldResumeOnForegroundRef.current = options?.shouldResumeOnForeground ?? false;
    controlsRef.current?.stop();
    setIsScanning(false);
    setStatusMessage(options?.statusMessage ?? null);
  }, []);

  const startScanner = useCallback(async (options?: { isAutomaticResume?: boolean }) => {
    if (!videoRef.current || !readerRef.current) {
      return;
    }

    if (!isCameraSupported()) {
      setError('This browser does not support camera scanning. Use Safari on iPad or enter the code manually.');
      setIsScanning(false);
      return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError('Camera scanning requires HTTPS or localhost on this device.');
      setIsScanning(false);
      return;
    }

    setError(null);
    setStatusMessage(options?.isAutomaticResume ? 'Restarting camera after returning to the app...' : null);

    try {
      controlsRef.current?.stop();

      const handleScan = (result: { getText: () => string } | undefined, scanError: unknown) => {
        if (scanError) {
          return;
        }

        if (!result) {
          return;
        }

        const value = result.getText().trim();
        if (!value) {
          return;
        }

        const now = Date.now();
        const lastScan = lastScanRef.current;
        if (lastScan && lastScan.value === value && now - lastScan.timestamp < duplicateWindowMs) {
          return;
        }

        lastScanRef.current = { value, timestamp: now };
        onScan(value);
      };

      const preferredDeviceId = await getPreferredVideoDeviceId();

      try {
        controlsRef.current = await readerRef.current.decodeFromVideoDevice(preferredDeviceId, videoRef.current, handleScan);
      } catch (preferredDeviceError) {
        if (!preferredDeviceId) {
          throw preferredDeviceError;
        }

        controlsRef.current = await readerRef.current.decodeFromVideoDevice(undefined, videoRef.current, handleScan);
      }

      shouldResumeOnForegroundRef.current = true;
      setStatusMessage('Rear camera preferred when available. Keep Safari in the foreground while scanning.');
      setIsScanning(true);
    } catch (_error) {
      setError('Camera access failed. On iPad, allow camera permission in Safari and keep the app in the foreground. Use manual entry if needed.');
      setStatusMessage(null);
      setIsScanning(false);
    }
  }, [onScan]);

  useEffect(() => {
    const pauseForBackground = () => {
      if (!isScanning) {
        return;
      }

      stopScanner({
        shouldResumeOnForeground: true,
        statusMessage: 'Camera paused while the app was in the background.'
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseForBackground();
        return;
      }

      if (!shouldResumeOnForegroundRef.current) {
        return;
      }

      if (restartTimeoutRef.current !== null) {
        window.clearTimeout(restartTimeoutRef.current);
      }

      restartTimeoutRef.current = window.setTimeout(() => {
        void startScanner({ isAutomaticResume: true });
      }, 250);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', pauseForBackground);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', pauseForBackground);
    };
  }, [isScanning, startScanner, stopScanner]);

  return (
    <section className="scanner-card">
      <div className="scanner-header">
        <div>
          <p className="eyebrow">Live Scanner</p>
        </div>
        <button type="button" className="ghost-button" onClick={isScanning ? stopScanner : () => void startScanner()}>
          {isScanning ? 'Stop camera' : 'Start camera'}
        </button>
      </div>
      <video ref={videoRef} className="scanner-video" muted playsInline />
      {error ? <p className="inline-error">{error}</p> : null}
      {statusMessage ? <p className="hint-text">{statusMessage}</p> : null}
      <p className="hint-text">Continuous scan is de-duplicated for five seconds to avoid double reads at the door.</p>
    </section>
  );
};

export default ScannerPanel;