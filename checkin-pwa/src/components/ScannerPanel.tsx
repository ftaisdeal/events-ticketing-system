import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { useEffect, useRef, useState } from 'react';

type ScannerPanelProps = {
  onScan: (code: string) => void;
};

const duplicateWindowMs = 5000;

const ScannerPanel = ({ onScan }: ScannerPanelProps): JSX.Element => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef<{ value: string; timestamp: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();

    return () => {
      controlsRef.current?.stop();
      readerRef.current = null;
    };
  }, []);

  const startScanner = async () => {
    if (!videoRef.current || !readerRef.current) {
      return;
    }

    setError(null);

    try {
      controlsRef.current?.stop();
      controlsRef.current = await readerRef.current.decodeFromVideoDevice(undefined, videoRef.current, (result, scanError) => {
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
      });
      setIsScanning(true);
    } catch (_error) {
      setError('Camera access failed. Use manual entry if the scanner cannot start on this device.');
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    controlsRef.current?.stop();
    setIsScanning(false);
  };

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
      <p className="hint-text">Continuous scan is de-duplicated for five seconds to avoid double reads at the door.</p>
    </section>
  );
};

export default ScannerPanel;