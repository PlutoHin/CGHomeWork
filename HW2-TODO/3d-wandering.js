var canvas;
var gl;
var program;
var vBuffer, cBuffer;

// 顶点属性数组
var modelScale, theta, phi, isOrth, fov;
var ModelMatrix, ViewMatrix, ProjectionMatrix;

// shader里的统一变量
var u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix, u_Flag;

// 全局记录：轨道占用的顶点数
var orbitCount = 0;

window.onload = function() {
    console.log("3d-wandering.js window.onload start");
    canvas = document.getElementById("canvas");
    gl = canvas.getContext('webgl2');
    if (!gl) { alert("WebGL isn't available"); return; }

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    console.log("program:", program);
    gl.useProgram(program);
    resize();

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    // 初始化缓冲区
    vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    u_ModelMatrix = gl.getUniformLocation(program, "u_ModelMatrix");
    u_ViewMatrix = gl.getUniformLocation(program, "u_ViewMatrix");
    u_ProjectionMatrix = gl.getUniformLocation(program, "u_ProjectionMatrix");
    u_Flag = gl.getUniformLocation(program, "u_Flag");

    initViewingParameters();

    vertextsXYZ();
    generateCube();
    SendData();
    render();

    // ====== 鼠标拖动控制视角 ======
    var isDragging = false;
    var lastX, lastY;

    canvas.onmousedown = function(e) {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    }

    canvas.onmouseup = function(e) {
        isDragging = false;
    }

    canvas.onmousemove = function(e) {
        if (!isDragging) return;

        var dx = e.clientX - lastX;
        var dy = e.clientY - lastY;

        // 控制旋转灵敏度
        var sensitivity = 0.5;

        theta += dx * sensitivity;
        phi -= dy * sensitivity;

        // 限制phi范围，防止翻转
        phi = Math.max(5, Math.min(175, phi));

        lastX = e.clientX;
        lastY = e.clientY;

        render();
    }

};

// 键盘事件
window.onkeydown = function(e){
    var keyHandled = true;
    switch (e.keyCode) {
        case 90: modelScale *=1.1; break; // Z
        case 67: modelScale *=0.9; break; // C
        case 87: phi -= 5; break; // W
        case 83: phi += 5; break; // S
        case 65: theta -= 5; break; // A
        case 68: theta += 5; break; // D
        case 80: isOrth = !isOrth; break; // P
        case 77: fov = Math.min(fov + 5, 170); break; // M
        case 78: fov = Math.max(fov - 5, 5); break; // N
        case 32: initViewingParameters();break;
        case 82: gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); alert("开启后向面剔除"); break;
        case 84: gl.disable(gl.CULL_FACE); alert("关闭后向面剔除"); break;
        case 66: gl.enable(gl.DEPTH_TEST); alert("开启深度缓存消隐算法"); break;
        case 86: gl.disable(gl.DEPTH_TEST); alert("关闭深度缓存消隐算法"); break;
        default: keyHandled = false;
    }
    if(keyHandled){
        try{
            render();
        } catch(err){
            console.error("渲染出错：", err);
        }
    }
};

// 窗口自适应
window.onresize = resize;
function resize(){
    if (!canvas) return;
    var size = Math.min(document.body.clientWidth, document.body.clientHeight);
    if (size <= 0) size = 600;
    canvas.width = size;
    canvas.height = size;
    gl.viewport(0, 0, canvas.width, canvas.height);
    try{
        render();
    } catch(err){
        console.error("渲染出错：", err);
    }
}

// 渲染函数
function render(){
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    ModelMatrix = formModelMatrix();
    ViewMatrix = formViewMatrix();
    ProjectionMatrix = formProjectMatrix();

    gl.uniformMatrix4fv(u_ModelMatrix, false, flatten(ModelMatrix));
    gl.uniformMatrix4fv(u_ViewMatrix, false, flatten(ViewMatrix));
    gl.uniformMatrix4fv(u_ProjectionMatrix, false, flatten(ProjectionMatrix));

    // 绘制坐标轴
    gl.uniform1i(u_Flag, 0);
    gl.drawArrays(gl.LINES, 0, 18);

    // 如果有轨道数据，则绘制轨道
    if (orbitCount > 0) {
        gl.drawArrays(gl.LINES, 18, orbitCount);
    }

    // 绘制三角形网格，起始索引随轨道数量变化
    gl.uniform1i(u_Flag, 1);
    var triStart = 18 + orbitCount;
    if (points.length > triStart) {
        gl.drawArrays(gl.TRIANGLES, triStart, points.length - triStart);
    }
}

function initViewingParameters(){
    modelScale = 1.0;
    theta = 0;
    phi = 90;
    isOrth = true;
    fov = 120;
    ModelMatrix = mat4();
    ViewMatrix = mat4();
    ProjectionMatrix = mat4();

    // 初始化轨道计数
    orbitCount = 0;
}

function SendData(){
    if(!points || !colors) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
}

function modelChange(model){
    points = [];
    colors = [];
    orbitCount = 0; // 重置轨道计数
    switch(model){
        case 'cube': vertextsXYZ(); generateCube(); break;
        case 'sphere': vertextsXYZ(); generateSphere(); break;
        case 'hat': vertextsXYZ(); generateHat(); break;
        case 'solar': vertextsXYZ(); generateSolarSystem(); break;
    }
    SendData();
    render();
}

// M矩阵
function formModelMatrix(){
    return scale(modelScale, modelScale, modelScale);
}

// V矩阵
function formViewMatrix(){
    var radius = 2.5;
    const at = vec3(0.0,0.0,0.0);
    var eye = vec3(
        radius*Math.sin(radians(theta))*Math.sin(radians(phi)),
        radius*Math.cos(radians(phi)),
        radius*Math.cos(radians(theta))*Math.sin(radians(phi))
    );
    var up = (Math.abs(phi%180)<5)? vec3(0,0,1) : vec3(0,1,0);
    return lookAt(eye, at, up);
}

// P矩阵
function formProjectMatrix(){
    const near = 0.1, far=10.0, aspect=1.0;
    if(isOrth){
        return ortho(-1.5,1.5,-1.5,1.5,near,far);
    } else {
        return perspective(fov,aspect,near,far);
    }
}

/* ================= 精致化的太阳系模型 ================= */
function generateSolarSystem() {
    // points/colors 已由 modelChange 清空，vertextsXYZ() 已经被调用
    orbitCount = 0;

    // 轨道线段：我们在坐标轴后面直接追加轨道顶点
    const earthOrbit = 1.5;
    const segments = 160; // 更多段数更圆
    const orbitColor = vec4(0.7, 0.7, 0.7, 1.0);

    // 轨道数据开始索引是 18
    for (let i = 0; i < segments; i++) {
        let a1 = 2*Math.PI*i/segments;
        let a2 = 2*Math.PI*(i+1)/segments;
        points.push(vec4(Math.cos(a1)*earthOrbit, 0, Math.sin(a1)*earthOrbit, 1.0));
        points.push(vec4(Math.cos(a2)*earthOrbit, 0, Math.sin(a2)*earthOrbit, 1.0));
        colors.push(orbitColor); colors.push(orbitColor);
    }
    orbitCount = segments * 2; // 每段两个顶点

    // 太阳
    addSphereAt(0, 0, 0, 0.6, null, 5, true); // 第五个参数 color 为 null 表示使用渐变，最后一个参数 true 启用渐变模式

    // 地球
    addSphereAt(earthOrbit, 0, 0, 0.25, vec4(0.15, 0.45, 1.0, 1.0), 4, false);

    // 月球
    addSphereAt(earthOrbit + 0.35, 0, 0, 0.08, vec4(0.7, 0.7, 0.7, 1.0), 3, false);

    // 不在这里调用 SendData(); modelChange 会在外面统一调用
}

/*
 addSphereAt:
  - cx,cy,cz: 中心位置
  - radius: 半径
  - color: 若为 null 则启用渐变着色，否则为固定颜色
  - subdivisions: 细分层数
  - useGradient: 当 color==null 且 useGradient==true 时，对太阳使用渐变色
*/
function addSphereAt(cx, cy, cz, radius, color, subdivisions, useGradient) {
    subdivisions = (typeof subdivisions === 'number') ? subdivisions : 3;
    useGradient = !!useGradient;

    const va = vec4(0.0, 0.0, -1.0, 1.0);
    const vb = vec4(0.0, 0.942809, 0.333333, 1.0);
    const vc = vec4(-0.816497, -0.471405, 0.333333, 1.0);
    const vd = vec4(0.816497, -0.471405, 0.333333, 1.0);

    function triangle(a, b, c) {
        points.push(a); points.push(b); points.push(c);

        if (useGradient) {
            // 用顶点位置决定颜色，太阳使用渐变
            colors.push(computeSunColor(a));
            colors.push(computeSunColor(b));
            colors.push(computeSunColor(c));
        } else {
            // 固定颜色或轻微扰动
            colors.push(color); colors.push(color); colors.push(color);
        }
    }

    function divideTriangle(a, b, c, count) {
        if(count > 0) {
            var ab = normalize(mix(a, b, 0.5), true);
            var ac = normalize(mix(a, c, 0.5), true);
            var bc = normalize(mix(b, c, 0.5), true);
            divideTriangle(a, ab, ac, count-1);
            divideTriangle(ab, b, bc, count-1);
            divideTriangle(bc, c, ac, count-1);
            divideTriangle(ab, bc, ac, count-1);
        } else {
            triangle(a, b, c);
        }
    }

    function tetrahedron(a, b, c, d, n) {
        divideTriangle(a, b, c, n);
        divideTriangle(d, c, b, n);
        divideTriangle(a, d, b, n);
        divideTriangle(a, c, d, n);
    }

    const oldLen = points.length;
    tetrahedron(va, vb, vc, vd, subdivisions);

    // 缩放 & 平移：使用 MVnew.js 的 scale() 返回矩阵，并用 mult(mat, vec4) 对顶点变换
    const S = scale(radius, radius, radius);
    const offset = vec4(cx, cy, cz, 0.0);

    for (let i = oldLen; i < points.length; i++) {
        // mult(S, points[i]) 是 vec4；然后加偏移
        points[i] = add(mult(S, points[i]), offset);
    }
}

// 根据顶点位置计算太阳的颜色，简单渐变
function computeSunColor(v) {
    // v 是 vec4，按原点方向取 z 或 y 作为亮度参考
    // 归一化位置的高度（-1..1）到 0..1
    var nz = Math.abs(v[2]); // 0..1
    var ny = (v[1] + 1.0) * 0.5; // 0..1
    var t = Math.max(nz, ny); // 简单合成
    // 颜色在黄色(1.0,0.9,0)到橙色(1.0,0.45,0)之间插值
    var r = 1.0;
    var g = 0.9 * (1 - t) + 0.45 * t;
    var b = 0.0;
    return vec4(r, g, b, 1.0);
}
