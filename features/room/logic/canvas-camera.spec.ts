import { act, renderHook } from "@testing-library/react";
import type {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { describe, expect, it, vi } from "vitest";
import {
  clampCanvasZoom,
  fitCanvasCamera,
  getCanvasGridStep,
  screenToWorld,
  worldToScreen,
  zoomAtScreenPoint,
} from "./canvas-camera";
import { useCanvasCamera } from "./use-canvas-camera";

function createViewport() {
  const element = document.createElement("div");
  Object.defineProperty(element, "getBoundingClientRect", {
    value: () => ({
      left: 10,
      top: 20,
      right: 510,
      bottom: 420,
      width: 500,
      height: 400,
    }),
  });
  element.setPointerCapture = vi.fn();
  element.releasePointerCapture = vi.fn();
  return element;
}

function pointerEvent(
  element: HTMLDivElement,
  overrides: Partial<ReactPointerEvent<HTMLDivElement>> = {},
) {
  return {
    button: 0,
    pointerId: 1,
    clientX: 100,
    clientY: 100,
    target: element,
    currentTarget: element,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as ReactPointerEvent<HTMLDivElement>;
}

describe("canvas-camera", () => {
  it("screen/world変換を倍率込みで往復できる", () => {
    const camera = { x: 120, y: -40, zoom: 2 };
    const world = { x: -30, y: 70 };
    const screen = worldToScreen(world, camera);

    expect(screen).toEqual({ x: 60, y: 100 });
    expect(screenToWorld(screen, camera)).toEqual(world);
  });

  it("カーソル位置の世界座標を固定したままズームする", () => {
    const camera = { x: 100, y: 60, zoom: 1 };
    const pointer = { x: 300, y: 260 };
    const worldBefore = screenToWorld(pointer, camera);
    const zoomed = zoomAtScreenPoint(camera, 2, pointer);

    expect(screenToWorld(pointer, zoomed)).toEqual(worldBefore);
    expect(zoomed).toEqual({ x: -100, y: -140, zoom: 2 });
  });

  it("倍率を1%〜400%に制限する", () => {
    expect(clampCanvasZoom(0)).toBe(0.01);
    expect(clampCanvasZoom(0.5)).toBe(0.5);
    expect(clampCanvasZoom(9)).toBe(4);
  });

  it("付箋の範囲を安全余白付きで全体表示する", () => {
    const camera = fitCanvasCamera(
      { x: -100, y: -50, width: 400, height: 300 },
      { width: 800, height: 600 },
    );

    expect(camera.zoom).toBe(1);
    expect(worldToScreen({ x: -100, y: -50 }, camera)).toEqual({
      x: 200,
      y: 150,
    });
    expect(worldToScreen({ x: 300, y: 250 }, camera)).toEqual({
      x: 600,
      y: 450,
    });
  });

  it("倍率に応じて格子間隔を読みやすい画面幅へ調整する", () => {
    expect(getCanvasGridStep(1)).toBe(40);
    expect(getCanvasGridStep(0.01)).toBeGreaterThan(40);
    expect(getCanvasGridStep(4)).toBeLessThan(40);
  });

  it("空白の左ドラッグでカメラを1:1にパンする", () => {
    const viewport = createViewport();
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    const { result } = renderHook(() =>
      useCanvasCamera({ viewportRef: { current: viewport }, notes: [] }),
    );
    const start = result.current.camera;

    act(() => {
      result.current.handlePointerDown(pointerEvent(viewport));
      result.current.handlePointerMove(
        pointerEvent(viewport, { clientX: 140, clientY: 130 }),
      );
    });

    expect(result.current.camera).toEqual({
      ...start,
      x: start.x + 40,
      y: start.y + 30,
    });
    expect(result.current.isPanning).toBe(true);

    act(() => {
      result.current.handlePointerEnd(
        pointerEvent(viewport, { clientX: 140, clientY: 130 }),
      );
    });
    expect(result.current.isPanning).toBe(false);
    expect(viewport.setPointerCapture).toHaveBeenCalledWith(1);
    expect(viewport.releasePointerCapture).toHaveBeenCalledWith(1);
    raf.mockRestore();
  });

  it("Ctrl/Cmdホイールでカーソル位置を固定してズームする", () => {
    const viewport = createViewport();
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    const { result } = renderHook(() =>
      useCanvasCamera({ viewportRef: { current: viewport }, notes: [] }),
    );
    const pointer = { x: 250, y: 200 };
    const worldBefore = screenToWorld(pointer, result.current.camera);
    const preventDefault = vi.fn();

    act(() => {
      result.current.handleWheel({
        clientX: 260,
        clientY: 220,
        deltaX: 0,
        deltaY: -100,
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        preventDefault,
      } as unknown as ReactWheelEvent<HTMLDivElement>);
    });

    expect(result.current.camera.zoom).toBeGreaterThan(1);
    expect(screenToWorld(pointer, result.current.camera)).toEqual(worldBefore);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    raf.mockRestore();
  });
});
