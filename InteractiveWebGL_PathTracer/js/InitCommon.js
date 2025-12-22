// --- InitCommon.js 完整代码 ---
let SCREEN_WIDTH, SCREEN_HEIGHT;
let canvas, renderer, clock, stats;
let rayTracingRenderTarget, screenCopyRenderTarget;
let quadCamera, worldCamera;
let controls;
let rayTracingScene, screenCopyScene, screenOutputScene;
let rayTracingMaterial, screenCopyMaterial, screenOutputMaterial;
let rayTracingMesh, screenCopyMesh, screenOutputMesh;

let frameTime, elapsedTime = 0;
let sampleCounter = 1.0;
let cameraIsMoving = false;
let isPaused = false;
let pixelRatio = 1.0;

let isControllingBall = false;
let KeyboardState = { KeyW: false, KeyS: false, KeyA: false, KeyD: false, KeyQ: false, KeyE: false, KeyC: false };
let cameraDirectionVector = new THREE.Vector3();
let cameraRightVector = new THREE.Vector3();
let cameraControlsObject;
let oldYawRotation = 0, oldPitchRotation = 0;
let fileLoader = new THREE.FileLoader();
let gui;

function init() {
	window.addEventListener('resize', onWindowResize, false);

	// 键盘监听：增加对输入框的判断，防止 GUI 干扰
	window.addEventListener('keydown', (e) => {
		if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
		KeyboardState[e.code] = true;
	}, false);

	window.addEventListener('keyup', (e) => {
		KeyboardState[e.code] = false;
		if (e.code === 'KeyC') {
			isControllingBall = !isControllingBall;
			sampleCounter = 1.0;
			if (window.updateUI) window.updateUI();
		}
	}, false);

	// GUI 焦点保护：点击非输入区域时，自动从 GUI 释放焦点
	document.addEventListener('mousedown', (e) => {
		if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
			if (document.activeElement) document.activeElement.blur();
		}
	}, false);

	initTHREEjs();
}

function initTHREEjs() {
	canvas = document.createElement('canvas');
	renderer = new THREE.WebGLRenderer({ canvas: canvas, context: canvas.getContext('webgl2'), antialias: false });
	renderer.setPixelRatio(1.0);
	renderer.autoClear = false;

	container = document.getElementById('container');
	container.appendChild(renderer.domElement);
	stats = new Stats();
	container.appendChild(stats.domElement);
	clock = new THREE.Clock();

	rayTracingScene = new THREE.Scene();
	screenCopyScene = new THREE.Scene();
	screenOutputScene = new THREE.Scene();

	quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	worldCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);

	// 使用新的拖拽控制器
	controls = new DragCameraControls(worldCamera, renderer.domElement);
	cameraControlsObject = controls.getObject();
	cameraControlsObject.position.set(0, 20, 120);
	rayTracingScene.add(cameraControlsObject);

	let rtParams = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, type: THREE.FloatType, depthBuffer: false, stencilBuffer: false };
	rayTracingRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, rtParams);
	screenCopyRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, rtParams);

	if (window.initSceneData) window.initSceneData();
	animate();
}

// 拖拽式相机逻辑 (取代 PointerLock)
function DragCameraControls(camera, domElement) {
	let pitch = new THREE.Object3D(); pitch.add(camera);
	let yaw = new THREE.Object3D(); yaw.add(pitch);
	let isDragging = false;

	domElement.addEventListener('mousedown', () => isDragging = true);
	window.addEventListener('mouseup', () => isDragging = false);
	window.addEventListener('mousemove', (event) => {
		if (!isDragging || isControllingBall) return;
		yaw.rotation.y -= event.movementX * 0.002;
		pitch.rotation.x -= event.movementY * 0.002;
		pitch.rotation.x = Math.max(-1.5, Math.min(1.5, pitch.rotation.x));
	});

	this.getObject = () => yaw;
	this.getDirection = (v) => { v.set(0, 0, -1).applyQuaternion(pitch.getWorldQuaternion(new THREE.Quaternion())); return v; };
	this.getRightVector = (v) => { v.set(1, 0, 0).applyQuaternion(yaw.getWorldQuaternion(new THREE.Quaternion())); return v; };
}

function onWindowResize() {
	SCREEN_WIDTH = window.innerWidth;
	SCREEN_HEIGHT = window.innerHeight;
	renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
	let resX = Math.floor(SCREEN_WIDTH * pixelRatio);
	let resY = Math.floor(SCREEN_HEIGHT * pixelRatio);
	if (window.rayTracingUniforms) {
		window.rayTracingUniforms.uResolution.value.x = resX;
		window.rayTracingUniforms.uResolution.value.y = resY;
	}
	rayTracingRenderTarget.setSize(resX, resY);
	screenCopyRenderTarget.setSize(resX, resY);
	worldCamera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
	worldCamera.updateProjectionMatrix();
	sampleCounter = 1.0;
}

function animate() {
	requestAnimationFrame(animate);
	frameTime = clock.getDelta();
	elapsedTime += frameTime;

	if (!window.updateVariablesAndUniforms) return;

	let yawObj = controls.getObject();
	let pitchObj = yawObj.children[0];

	cameraIsMoving = false;
	if (!isControllingBall) {
		if (Math.abs(oldYawRotation - yawObj.rotation.y) > 0.0001 || Math.abs(oldPitchRotation - pitchObj.rotation.x) > 0.0001) cameraIsMoving = true;
		oldYawRotation = yawObj.rotation.y;
		oldPitchRotation = pitchObj.rotation.x;
	}

	controls.getDirection(cameraDirectionVector);
	controls.getRightVector(cameraRightVector);
	cameraDirectionVector.y = 0; cameraDirectionVector.normalize();
	cameraRightVector.y = 0; cameraRightVector.normalize();
	let speed = 80 * frameTime;

	let dPos = new THREE.Vector3(0, 0, 0);
	if (KeyboardState['KeyW']) dPos.addScaledVector(cameraDirectionVector, speed);
	if (KeyboardState['KeyS']) dPos.addScaledVector(cameraDirectionVector, -speed);
	if (KeyboardState['KeyA']) dPos.addScaledVector(cameraRightVector, -speed);
	if (KeyboardState['KeyD']) dPos.addScaledVector(cameraRightVector, speed);
	if (KeyboardState['KeyE']) dPos.y += speed;
	if (KeyboardState['KeyQ']) dPos.y -= speed;

	if (dPos.lengthSq() > 0) {
		if (!isControllingBall) {
			cameraIsMoving = true;
			let targetPos = cameraControlsObject.position.clone().add(dPos);
			if (window.resolveCollision) targetPos = window.resolveCollision(targetPos, 2.0);
			cameraControlsObject.position.copy(targetPos);
		}
	}

	window.updateVariablesAndUniforms();
	stats.update();
}