/**
 * useContentScan — core business logic hook for the scanner screen.
 *
 * Manages the full scan lifecycle:
 *   idle → capturing → submitting → polling → complete / error
 */
import { useState, useCallback, useRef } from 'react';
import { CameraView } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { submitFrames, pollUntilComplete, ScanCompleteResult, ScanUnidentifiedResult } from '../services/api';
import { cacheScanResult } from '../services/storage';

export type ScanPhase =
  | 'idle'
  | 'capturing'
  | 'processing'
  | 'complete'
  | 'unidentified'
  | 'error';

export interface ScanState {
  phase: ScanPhase;
  progress: number;         // 0–1
  stage: string;            // e.g. "Identifying content..."
  result: ScanCompleteResult | null;
  unidentified: ScanUnidentifiedResult | null;
  error: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  vision:      'Reading your screen...',
  search:      'Identifying content...',
  reviews:     'Gathering reviews...',
  scoring:     'Computing honest score...',
  explanation: 'Generating insights...',
};

export function useContentScan() {
  const cameraRef = useRef<CameraView>(null);
  const [state, setState] = useState<ScanState>({
    phase: 'idle',
    progress: 0,
    stage: '',
    result: null,
    unidentified: null,
    error: null,
  });

  const scan = useCallback(async () => {
    if (!cameraRef.current) return;

    setState(s => ({ ...s, phase: 'capturing', progress: 0.05, stage: 'Capturing frame...' }));

    try {
      // ── Capture multiple frames with slight delay between them ──
      const frames = await _captureFrames(cameraRef.current, 3);

      setState(s => ({ ...s, phase: 'processing', progress: 0.15, stage: 'Reading your screen...' }));

      // ── Submit to backend ──
      const { scan_id } = await submitFrames(frames);

      // ── Poll with progress updates ──
      const result = await pollUntilComplete(
        scan_id,
        (stage, progress) => {
          setState(s => ({
            ...s,
            progress: 0.15 + progress * 0.8,
            stage: STAGE_LABELS[stage] ?? 'Processing...',
          }));
        }
      );

      if (result.status === 'complete') {
        await cacheScanResult(result);
        setState({
          phase: 'complete',
          progress: 1,
          stage: 'Done!',
          result,
          unidentified: null,
          error: null,
        });
      } else {
        setState({
          phase: 'unidentified',
          progress: 1,
          stage: 'Could not identify',
          result: null,
          unidentified: result as ScanUnidentifiedResult,
          error: null,
        });
      }

    } catch (err: any) {
      setState({
        phase: 'error',
        progress: 0,
        stage: '',
        result: null,
        unidentified: null,
        error: err.message ?? 'An error occurred. Please try again.',
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      phase: 'idle',
      progress: 0,
      stage: '',
      result: null,
      unidentified: null,
      error: null,
    });
  }, []);

  return { cameraRef, state, scan, reset };
}


// ─── Frame capture helpers ────────────────────────────────────────────────────

async function _captureFrames(camera: CameraView, count: number): Promise<string[]> {
  const frames: string[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const photo = await camera.takePictureAsync({
        quality: 0.5,       // reduce size for faster upload
        base64: false,
        skipProcessing: true,
      });

      if (!photo?.uri) continue;

      // Resize to max 640px wide to reduce payload size
      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 640 } }],
        { format: ImageManipulator.SaveFormat.JPEG, base64: true, compress: 0.7 }
      );

      if (resized.base64) {
        frames.push(resized.base64);
      }
    } catch {
      // Silently skip failed frames
    }

    if (i < count - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return frames;
}
