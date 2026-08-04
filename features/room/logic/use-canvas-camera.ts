"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NOTE_HEIGHT, NOTE_WIDTH } from "@/contracts/board";
import type { Note } from "@/features/notes";
import {
  CANVAS_FIT_PADDING,
  type CanvasCamera,
  type CanvasPoint,
  clampCanvasZoom,
  fitCanvasCamera,
  getCanvasGridStep,
  getDefaultCanvasCamera,
  screenToWorld,
  zoomAtScreenPoint,
} from "./canvas-camera";

type CanvasPan = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCamera: CanvasCamera;
};

type UseCanvasCameraArgs = {
  viewportRef: RefObject<HTMLDivElement | null>;
  notes: Note[];
};

function viewportSize(element: HTMLDivElement): {
  width: number;
  height: number;
} | null {
  const rect = element.getBoundingClientRect();
  const width = rect.width || element.clientWidth;
  const height = rect.height || element.clientHeight;
  return width > 0 && height > 0 ? { width, height } : null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

function notesBounds(notes: Note[]) {
  if (notes.length === 0) return null;
  const minX = Math.min(...notes.map((note) => note.x));
  const minY = Math.min(...notes.map((note) => note.y));
  const maxX = Math.max(...notes.map((note) => note.x + NOTE_WIDTH));
  const maxY = Math.max(...notes.map((note) => note.y + NOTE_HEIGHT));
  return {
    x: minX - CANVAS_FIT_PADDING,
    y: minY - CANVAS_FIT_PADDING,
    width: maxX - minX + CANVAS_FIT_PADDING * 2,
    height: maxY - minY + CANVAS_FIT_PADDING * 2,
  };
}

export function useCanvasCamera({ viewportRef, notes }: UseCanvasCameraArgs) {
  const [camera, setCamera] = useState<CanvasCamera>({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const [isPanning, setIsPanning] = useState(false);
  const cameraRef = useRef(camera);
  const notesRef = useRef(notes);
  const panRef = useRef<CanvasPan | null>(null);
  const pendingCameraRef = useRef<CanvasCamera | null>(null);
  const frameRef = useRef<number | null>(null);
  const hasDefaultedRef = useRef(false);
  const hasFitRef = useRef(false);
  const spacePressedRef = useRef(false);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const setCameraImmediately = useCallback((next: CanvasCamera) => {
    cameraRef.current = next;
    pendingCameraRef.current = null;
    setCamera(next);
  }, []);

  const scheduleCamera = useCallback((next: CanvasCamera) => {
    cameraRef.current = next;
    pendingCameraRef.current = next;
    if (frameRef.current !== null) return;
    const requestFrame =
      typeof window !== "undefined" && window.requestAnimationFrame
        ? window.requestAnimationFrame.bind(window)
        : (callback: FrameRequestCallback) =>
            window.setTimeout(() => callback(Date.now()), 0);
    frameRef.current = requestFrame(() => {
      frameRef.current = null;
      const pending = pendingCameraRef.current;
      pendingCameraRef.current = null;
      if (pending) setCamera(pending);
    });
  }, []);

  const getViewportPoint = useCallback(
    (clientX: number, clientY: number): CanvasPoint | null => {
      const element = viewportRef.current;
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    [viewportRef],
  );

  const worldPointFromClient = useCallback(
    (clientX: number, clientY: number): CanvasPoint | null => {
      const point = getViewportPoint(clientX, clientY);
      return point ? screenToWorld(point, cameraRef.current) : null;
    },
    [getViewportPoint],
  );

  const fitToNotes = useCallback(() => {
    const element = viewportRef.current;
    if (!element) return;
    const size = viewportSize(element);
    if (!size) return;
    const bounds = notesBounds(notesRef.current);
    if (!bounds) {
      setCameraImmediately(getDefaultCanvasCamera(size));
      return;
    }
    setCameraImmediately(fitCanvasCamera(bounds, size));
  }, [setCameraImmediately, viewportRef]);

  const zoomTo = useCallback(
    (requestedZoom: number, point?: CanvasPoint) => {
      const element = viewportRef.current;
      if (!element) return;
      const size = viewportSize(element);
      const anchor = point ?? {
        x: (size?.width ?? 0) / 2,
        y: (size?.height ?? 0) / 2,
      };
      scheduleCamera(
        zoomAtScreenPoint(cameraRef.current, requestedZoom, anchor),
      );
    },
    [scheduleCamera, viewportRef],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const isBackground =
        event.target === event.currentTarget ||
        target.dataset.canvasBackground === "true";
      const shouldPan =
        event.button === 1 ||
        (event.button === 0 && (spacePressedRef.current || isBackground));
      if (!shouldPan) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      panRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCamera: cameraRef.current,
      };
      setIsPanning(true);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const pan = panRef.current;
      if (!pan || pan.pointerId !== event.pointerId) return;
      scheduleCamera({
        x: pan.startCamera.x + event.clientX - pan.startClientX,
        y: pan.startCamera.y + event.clientY - pan.startClientY,
        zoom: pan.startCamera.zoom,
      });
    },
    [scheduleCamera],
  );

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const pan = panRef.current;
      if (!pan || pan.pointerId !== event.pointerId) return;
      panRef.current = null;
      setIsPanning(false);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [],
  );

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const point = getViewportPoint(event.clientX, event.clientY);
      if (!point) return;
      if (event.ctrlKey || event.metaKey) {
        zoomTo(cameraRef.current.zoom * Math.exp(-event.deltaY * 0.002), point);
        return;
      }
      const deltaX =
        event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
      scheduleCamera({
        ...cameraRef.current,
        x: cameraRef.current.x - deltaX,
        y: cameraRef.current.y - event.deltaY,
      });
    },
    [getViewportPoint, scheduleCamera, zoomTo],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isEditableTarget(event.target)) return;
      spacePressedRef.current = true;
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spacePressedRef.current = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const size = viewportSize(element);
    if (!size) return;
    if (notes.length > 0 && !hasFitRef.current) {
      const bounds = notesBounds(notes);
      if (bounds) {
        setCameraImmediately(fitCanvasCamera(bounds, size));
        hasFitRef.current = true;
      }
    } else if (notes.length === 0 && !hasDefaultedRef.current) {
      setCameraImmediately(getDefaultCanvasCamera(size));
      hasDefaultedRef.current = true;
    }
  }, [notes, setCameraImmediately, viewportRef]);

  const gridStyle = useMemo(() => {
    const step = getCanvasGridStep(camera.zoom);
    const screenStep = step * camera.zoom;
    const positionX = ((camera.x % screenStep) + screenStep) % screenStep;
    const positionY = ((camera.y % screenStep) + screenStep) % screenStep;
    const dotOffset = 1;
    return {
      backgroundImage:
        "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--foreground) 30%, transparent) 1px, transparent 1.5px)",
      backgroundPosition: `${positionX - dotOffset}px ${positionY - dotOffset}px`,
      backgroundSize: `${screenStep}px ${screenStep}px`,
    };
  }, [camera]);

  return {
    camera,
    cameraRef,
    isPanning,
    gridStyle,
    worldPointFromClient,
    fitToNotes,
    zoomTo,
    zoomIn: () => zoomTo(clampCanvasZoom(cameraRef.current.zoom * 1.25)),
    zoomOut: () => zoomTo(clampCanvasZoom(cameraRef.current.zoom / 1.25)),
    resetZoom: () => zoomTo(1),
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handlePointerCancel: handlePointerEnd,
    handleWheel,
  };
}
