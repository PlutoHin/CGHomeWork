// --- InteractivePathTracer.js 完整代码 ---
window.rayTracingUniforms = {};
let movableBallPosition = new THREE.Vector3(0, 10, 0);
let lightPosition = new THREE.Vector3(0, 99, 0);
let sceneSettings = { timeOfDay: 0.5 };

const PHYSICS_SCENE = {
	boxes: [{ min: new THREE.Vector3(-200, -100, -200), max: new THREE.Vector3(200, 0, 200) }],
	spheres: [
		{ center: new THREE.Vector3(0, 15, -30), radius: 15.0 },
		{ center: new THREE.Vector3(-35, 12, 10), radius: 12.0 },
		{ center: new THREE.Vector3(35, 10, 10), radius: 10.0 }
	]
};

const ROOM_BOUNDS = { min: new THREE.Vector3(-70, 0, -90), max: new THREE.Vector3(70, 90, 90) };

window.resolveCollision = function (position, radius) {
	let tempPos = position.clone();
	for (let sphere of PHYSICS_SCENE.spheres) {
		let diff = new THREE.Vector3().subVectors(tempPos, sphere.center);
		let dist = diff.length();
		let minDist = radius + sphere.radius;
		if (dist < minDist) tempPos.addScaledVector(diff.normalize(), minDist - dist);
	}
	tempPos.x = Math.max(ROOM_BOUNDS.min.x + radius, Math.min(ROOM_BOUNDS.max.x - radius, tempPos.x));
	tempPos.z = Math.max(ROOM_BOUNDS.min.z + radius, Math.min(ROOM_BOUNDS.max.z - radius, tempPos.z));
	tempPos.y = Math.max(ROOM_BOUNDS.min.y + radius, Math.min(ROOM_BOUNDS.max.y - radius, tempPos.y));
	return tempPos;
}

const COMMON_VERTEX = `precision highp float; void main() { gl_Position = vec4(position, 1.0); }`;

const SCREEN_OUTPUT_FRAG = `
precision highp float; precision highp sampler2D;
uniform sampler2D uRayTracedImageTexture;
uniform bool uUseToneMapping;
vec3 filmicToneMapping(vec3 x) {
    vec3 a = vec3(2.51), b = vec3(0.03), c = vec3(2.43), d = vec3(0.59), e = vec3(0.14);
    return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}
void main() {
    vec3 color = texelFetch(uRayTracedImageTexture, ivec2(gl_FragCoord.xy), 0).rgb;
    if(uUseToneMapping) {
        color *= 1.35; 
        color = filmicToneMapping(color);
    }
    gl_FragColor = vec4(pow(clamp(color, 0.0, 1.0), vec3(1.0/2.2)), 1.0);
}
`;

const SCREEN_COPY_FRAG = `precision highp float; precision highp sampler2D; uniform sampler2D uRayTracedImageTexture; void main() { gl_FragColor = texelFetch(uRayTracedImageTexture, ivec2(gl_FragCoord.xy), 0); }`;

window.updateUI = function () {
	let uiControlText = document.getElementById('control-mode-text');
	if (uiControlText) {
		uiControlText.innerText = isControllingBall ? "动态球体 (移动物体模式)" : "摄像机 (漫游模式)";
		uiControlText.style.color = isControllingBall ? "#ffcc00" : "#00ff88";
	}
};

window.initSceneData = function () {
	gui = new GUI({ title: "交互式路径追踪控制" });

	// GUI 初始参数
	let params = {
		resolution: 0.8,
		aperture: 0.0,
		focus: 80,
		emaAlpha: 0.1,
		lightIntensity: 18.0,
		wallColor: "#e6e6e6" // 初始灰色
	};
	pixelRatio = params.resolution;

	gui.add(params, 'resolution', 0.1, 1.0).name("渲染清晰度").onChange(v => { pixelRatio = v; onWindowResize(); });
	gui.add(params, 'emaAlpha', 0.01, 0.5).name("累积平滑度(EMA)").onChange(v => { rayTracingUniforms.uAccumAlpha.value = v; });
	gui.add(params, 'aperture', 0.0, 3.0).name("景深(光圈)").onChange(v => { rayTracingUniforms.uApertureSize.value = v; sampleCounter = 1.0; });

	let ballFolder = gui.addFolder("动态球体设置");
	let ballMaterials = { "黄金 (Gold)": 4, "透明玻璃 (Glass)": 5, "镜面 (Steel)": 3, "发光红石 (Redstone)": 2, "白色石膏 (Diffuse)": 0 };
	rayTracingUniforms.uBallMaterialID = { value: 4 };
	ballFolder.add(rayTracingUniforms.uBallMaterialID, 'value', ballMaterials).name("实时切换材质").onChange(() => sampleCounter = 1.0);
	ballFolder.open();

	// --- 新增：环境光影调�? Folder ---
	let envStyleFolder = gui.addFolder("环境光影与氛围");
	rayTracingUniforms.uLightIntensity = { value: params.lightIntensity };
	envStyleFolder.add(params, 'lightIntensity', 0.0, 50.0).name("顶灯强度").onChange(v => {
		rayTracingUniforms.uLightIntensity.value = v;
		sampleCounter = 1.0;
	});

	rayTracingUniforms.uWallColor = { value: new THREE.Color(params.wallColor) };
	envStyleFolder.addColor(params, 'wallColor').name("墙壁色彩").onChange(v => {
		rayTracingUniforms.uWallColor.value.set(v);
		sampleCounter = 1.0;
	});
	envStyleFolder.open();

	let envFolder = gui.addFolder("昼夜系统控制");
	envFolder.add(sceneSettings, 'timeOfDay', 0.0, 1.0).name("昼夜时间").onChange(v => { rayTracingUniforms.uTimeOfDay.value = v; sampleCounter = 1.0; });
	envFolder.open();

	let lightFolder = gui.addFolder("顶灯位置控制");
	lightFolder.add(lightPosition, 'x', -80, 80).onChange(() => sampleCounter = 1.0);
	lightFolder.add(lightPosition, 'y', 30, 100).onChange(() => sampleCounter = 1.0);
	lightFolder.add(lightPosition, 'z', -80, 80).onChange(() => sampleCounter = 1.0);

	rayTracingUniforms.uPreviousTexture = { value: screenCopyRenderTarget.texture };
	rayTracingUniforms.uCameraMatrix = { value: new THREE.Matrix4() };
	rayTracingUniforms.uResolution = { value: new THREE.Vector2(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio) };
	rayTracingUniforms.uSampleCounter = { value: 0.0 };
	rayTracingUniforms.uFrameCounter = { value: 0.0 };
	rayTracingUniforms.uTime = { value: 0.0 };
	rayTracingUniforms.uCameraIsMoving = { value: false };
	rayTracingUniforms.uApertureSize = { value: params.aperture };
	rayTracingUniforms.uFocusDistance = { value: params.focus };
	rayTracingUniforms.uULen = { value: 1.0 };
	rayTracingUniforms.uVLen = { value: 1.0 };
	rayTracingUniforms.uBallPos = { value: movableBallPosition };
	rayTracingUniforms.uLightPos = { value: lightPosition };
	rayTracingUniforms.uTimeOfDay = { value: sceneSettings.timeOfDay };
	rayTracingUniforms.uAccumAlpha = { value: params.emaAlpha };

	let fovScale = worldCamera.fov * 0.5 * (Math.PI / 180.0);
	rayTracingUniforms.uVLen.value = Math.tan(fovScale);
	rayTracingUniforms.uULen.value = rayTracingUniforms.uVLen.value * worldCamera.aspect;

	let planeGeo = new THREE.PlaneGeometry(2, 2);

	fileLoader.load('shaders/InteractivePathTracer.glsl', function (fragCode) {
		rayTracingMaterial = new THREE.ShaderMaterial({ uniforms: rayTracingUniforms, vertexShader: COMMON_VERTEX, fragmentShader: fragCode, depthWrite: false, depthTest: false });
		rayTracingMesh = new THREE.Mesh(planeGeo, rayTracingMaterial);
		rayTracingMesh.frustumCulled = false;
		rayTracingScene.add(rayTracingMesh);
		worldCamera.add(rayTracingMesh);
	});

	screenOutputMaterial = new THREE.ShaderMaterial({ uniforms: { uRayTracedImageTexture: { value: rayTracingRenderTarget.texture }, uUseToneMapping: { value: true } }, vertexShader: COMMON_VERTEX, fragmentShader: SCREEN_OUTPUT_FRAG, depthWrite: false, depthTest: false });
	screenOutputMesh = new THREE.Mesh(planeGeo, screenOutputMaterial);
	screenOutputMesh.frustumCulled = false;
	screenOutputScene.add(screenOutputMesh);

	screenCopyMaterial = new THREE.ShaderMaterial({ uniforms: { uRayTracedImageTexture: { value: rayTracingRenderTarget.texture } }, vertexShader: COMMON_VERTEX, fragmentShader: SCREEN_COPY_FRAG, depthWrite: false, depthTest: false });
	screenCopyMesh = new THREE.Mesh(planeGeo, screenCopyMaterial);
	screenCopyMesh.frustumCulled = false;
	screenCopyScene.add(screenCopyMesh);

	window.updateUI();
};

window.updateVariablesAndUniforms = function () {
	if (isControllingBall) {
		let speed = 60 * frameTime;
		let dPos = new THREE.Vector3(0, 0, 0);
		if (KeyboardState['KeyW']) dPos.z -= speed;
		if (KeyboardState['KeyS']) dPos.z += speed;
		if (KeyboardState['KeyA']) dPos.x -= speed;
		if (KeyboardState['KeyD']) dPos.x += speed;
		if (KeyboardState['KeyE']) dPos.y += speed;
		if (KeyboardState['KeyQ']) dPos.y -= speed;
		if (dPos.lengthSq() > 0) {
			cameraIsMoving = true;
			let targetPos = movableBallPosition.clone().add(dPos);
			movableBallPosition.copy(window.resolveCollision(targetPos, 6.0));
			rayTracingUniforms.uBallPos.value.copy(movableBallPosition);
		}
	}

	let statusEl = document.getElementById('render-status');
	if (cameraIsMoving) {
		sampleCounter = 1.0;
		rayTracingUniforms.uCameraIsMoving.value = true;
		if (statusEl) statusEl.innerHTML = "状态: <span style='color:#ff4444'> 实时渲染 (TAA)</span>";
	} else {
		sampleCounter = Math.min(sampleCounter + 1.0, 5000.0);
		rayTracingUniforms.uCameraIsMoving.value = false;
		if (statusEl) {
			statusEl.innerHTML = `状态: <span style='color:#00ff88'> 高清累积 (SPP: ${Math.floor(sampleCounter)})</span>`;
		}
	}

	rayTracingUniforms.uSampleCounter.value = sampleCounter;
	rayTracingUniforms.uTime.value = elapsedTime;
	rayTracingUniforms.uFrameCounter.value += 1.0;

	if (worldCamera) {
		worldCamera.updateMatrixWorld(true);
		rayTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
	}

	if (rayTracingMaterial && screenOutputMaterial && screenCopyMaterial) {
		renderer.setRenderTarget(rayTracingRenderTarget);
		renderer.render(rayTracingScene, worldCamera);
		renderer.setRenderTarget(null);
		renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
		renderer.render(screenOutputScene, quadCamera);
		renderer.setRenderTarget(screenCopyRenderTarget);
		renderer.render(screenCopyScene, quadCamera);
	}
}

init();