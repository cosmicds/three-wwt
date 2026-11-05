import { Matrix3d, RenderContext, WWTControl } from "@wwtelescope/engine";
import * as THREE from "three";

type ThreeJS = typeof THREE;

let threeJS: ThreeJS;
let eclipticToWWT: THREE.Matrix4;
export function setThree(three: ThreeJS) {
  threeJS = three;
  updateWorldTransformMatrix(threeJS);
}

function updateWorldTransformMatrix(three: ThreeJS) {
  eclipticToWWT = new three.Matrix4().set(
    1, 0, 0, 0,
    0, 0, 1, 0,
    0, 1, 0, 0,
    0, 0, 0, 1,
  );  
}

interface DummyCanvasOptions {
  opacity?: number;
  attach?: boolean;
}

function matchDimensions(source: HTMLCanvasElement, target: HTMLCanvasElement) {
  target.style.width = source.style.width;
  target.style.height = source.style.height;
  target.height = source.height;
  target.width = source.width;
}

function setupResizeObserver(source: HTMLCanvasElement, target: HTMLCanvasElement): ResizeObserver {
  const observer = new ResizeObserver(_entries => {
    matchDimensions(source, target);
  });
  observer.observe(source);
  return observer;
}

export function createDummyCanvas(canvas: HTMLCanvasElement, options?: DummyCanvasOptions): [HTMLCanvasElement, ResizeObserver] {
  const dummy = document.createElement("canvas");
  matchDimensions(canvas, dummy);

  dummy.id = "three-js-canvas";
  dummy.style.position = "absolute";
  dummy.style.left = canvas.offsetLeft + "px";
  dummy.style.top = canvas.offsetTop + "px";

  const opacity = options?.opacity ?? 0;
  dummy.style.background = `rgba(0, 0, 0, ${opacity})`;
  dummy.style.pointerEvents = "none";

  const canvasZindex = canvas.style.zIndex;
  dummy.style.zIndex = canvasZindex ? `${canvasZindex + 10}` : "10";

  const observer = setupResizeObserver(canvas, dummy);

  if (options?.attach ?? true) {
    canvas.parentNode?.appendChild(dummy);
  }

  return [dummy, observer];
}

export function createTHREECamera(renderContext: RenderContext, far=1) {
  const camera = new threeJS.PerspectiveCamera(75, renderContext.width / renderContext.height, renderContext.nearPlane, far);
  camera.matrixAutoUpdate = false;
  camera.matrixWorldAutoUpdate = false;
  return camera;
}

export function createTHREEScene(ambientLight=true) {
  const scene = new threeJS.Scene();
  if (ambientLight) {
    const light = new threeJS.AmbientLight(0xffffff, 1);
    scene.add(light);
  }
  return scene;
}

export function createTHREERenderer(control: WWTControl, canvas: HTMLCanvasElement) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error `WWTControl` does have a `canvas` member
  const wwtCanvas: HTMLCanvasElement = control.canvas;
  const context = canvas.getContext("webgl2")!;
  const renderer = new threeJS.WebGLRenderer({
    canvas,
    context,
    antialias: true,
    alpha: true,
  });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setPixelRatio(wwtCanvas.width / wwtCanvas.clientWidth);
  renderer.setClearColor(0x000000, 0);

  renderer.toneMapping = threeJS.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;

  return renderer;
}

export function wwtMatrixToTHREE(mat: Matrix3d) {
  const matrix = new threeJS.Matrix4();
  matrix.set(
    mat.get_m11(), mat.get_m21(), mat.get_m31(), mat.get_m41(),
    mat.get_m12(), mat.get_m22(), mat.get_m32(), mat.get_m42(),
    mat.get_m13(), mat.get_m23(), mat.get_m33(), mat.get_m43(),
    mat.get_m14(), mat.get_m24(), mat.get_m34(), mat.get_m44(),
  );
  return matrix;
}

export function updateTHREECamera(camera: THREE.PerspectiveCamera, renderContext: RenderContext) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error `get_projection` exists
  camera.projectionMatrix.copy(wwtMatrixToTHREE(renderContext.get_projection()));
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error `get_view` exists
  camera.matrixWorldInverse.copy(wwtMatrixToTHREE(renderContext.get_view()));
  camera.matrixWorld.copy(camera.matrixWorldInverse).invert();
  camera.matrixWorldInverse.multiply(eclipticToWWT);
  camera.matrixWorld.premultiply(eclipticToWWT);
  camera.matrixWorldNeedsUpdate = false;
}

export function renderTHREE(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  renderer.render(scene, camera);
}
