var numVertices=0; //生成顶点数组时计数
var points = [];
var colors = [];
var normalsArray =[];
var texCoordsArray = [];//顶点的纹理坐标属性数组texCoordsArray
var texCoord = [
	vec2(0, 0),
	vec2(0, 1),
	vec2(1, 1),
	vec2(1, 0)
];

/**生成立方体顶点******************************
****************************************************/
  // Create a cube
  //    v5----- v6
  //   /|      /|
  //  v1------v2|
  //  | |     | |
  //  | |v4---|-|v7
  //  |/      |/
  //  v0------v3

function colorCube(scale){
	numVertices = 0;
	var vertexMC = scale; //顶点沿轴到原点的最远距离
	var vertices = [
		vec4( -vertexMC, -vertexMC,  vertexMC, 1.0 ), //v0
		vec4( -vertexMC,  vertexMC,  vertexMC, 1.0 ), //v1
		vec4(  vertexMC,  vertexMC,  vertexMC, 1.0 ), //v2
		vec4(  vertexMC, -vertexMC,  vertexMC, 1.0 ), //v3
		vec4( -vertexMC, -vertexMC, -vertexMC, 1.0 ), //v4
		vec4( -vertexMC,  vertexMC, -vertexMC, 1.0 ), //v5
		vec4(  vertexMC,  vertexMC, -vertexMC, 1.0 ), //v6
		vec4(  vertexMC, -vertexMC, -vertexMC, 1.0 )  //v7
	];

	// 顶点颜色
	var vertexColors = [
		[ 0.0, 0.0, 0.0, 1.0 ],
		[ 0.0, 0.0, 1.0, 1.0 ],
		[ 1.0, 0.0, 0.0, 1.0 ],
		[ 0.0, 0.5, 0.0, 1.0 ],
		[ 0.0, 0.0, 0.5, 1.0 ],
		[ 0.5, 0.0, 0.0, 1.0 ],
		[ 0.0, 1.0, 0.0, 1.0 ],
		[ 1.0, 1.0, 1.0, 1.0 ]
	];

	// 纹理坐标，每个面四个顶点
	var texCoordsPerFace = [
		vec2(0.0, 0.0),
		vec2(0.0, 1.0),
		vec2(1.0, 1.0),
		vec2(1.0, 0.0)
	];

	// 创建立方体六个面
	quad(1,0,3,2); //前
	quad(4,5,6,7); //后
	quad(2,3,7,6); //右
	quad(5,4,0,1); //左
	quad(6,5,1,2); //上
	quad(3,0,4,7); //下

	function quad(a, b, c, d)
	{
		var vertexColors = [
			[ 0.0, 0.0, 0.0, 1.0 ],  // black
			[ 0.0, 0.0, 1.0, 1.0 ],  // blue
			[ 1.0, 0.0, 0.0, 1.0 ],  // red
			[ 0.0, 0.5, 0.0, 1.0 ],  // green
			[ 0.0, 0.0, 0.5, 1.0 ],  // dark blue
			[ 0.5, 0.0, 0.0, 1.0 ],  // dark red
			[ 0.0, 1.0, 0.0, 1.0 ],  // bright green
			[ 1.0, 1.0, 1.0, 1.0 ]   // white
		];

		// 计算该面法向量
		var t1 = subtract(vertices[b], vertices[a]);
		var t2 = subtract(vertices[c], vertices[b]);
		var v1 = vec3(t1[0], t1[1], t1[2]);
		var v2 = vec3(t2[0], t2[1], t2[2]);
		var normal = vec4(cross(v1, v2)[0], cross(v1, v2)[1], cross(v1, v2)[2], 0.0);

		// 每个面固定的四个纹理坐标
		var faceUV = [
			vec2(0.0, 0.0),
			vec2(0.0, 1.0),
			vec2(1.0, 1.0),
			vec2(1.0, 0.0)
		];

		// 生成两个三角形
		var verts = [a, b, c, a, c, d];
		var uvs   = [0, 1, 2, 0, 2, 3];

		for (var i = 0; i < 6; i++) {
			points.push(vertices[verts[i]]);
			colors.push(vertexColors[a]); //每面单色，也可以改成 colors.push(vertexColors[verts[i]]) 来插值彩色
			normalsArray.push(normal);
			texCoordsArray.push(faceUV[uvs[i]]);
			numVertices++;
		}
	}


	return numVertices;
}

function plane(vscale){
	numVertices = 0;
	var scale = vscale;

	var vertices = [
		vec4(scale, -0.5, scale, 1.0),
		vec4(-scale, -0.5, scale, 1.0),
		vec4(-scale, -0.5, -scale, 1.0),

		vec4(scale, -0.5,  scale, 1.0),
		vec4(-scale, -0.5,  -scale, 1.0),
		vec4(scale, -0.5,  -scale, 1.0)
	];

	var planeColors = [
		vec4(1.0, 1.0, 1.0, 1.0),
		vec4(1.0, 1.0, 1.0, 1.0),
		vec4(1.0, 1.0, 1.0, 1.0),
		vec4(1.0, 1.0, 1.0, 1.0),
		vec4(1.0, 1.0, 1.0, 1.0),
		vec4(1.0, 1.0, 1.0, 1.0),
	];

	var planeNormls = [
		vec4(0.0, 1.0, 0.0, 0.0),
		vec4(0.0, 1.0, 0.0, 0.0),
		vec4(0.0, 1.0, 0.0, 0.0),

		vec4(0.0, 1.0, 0.0, 0.0),
		vec4(0.0, 1.0, 0.0, 0.0),
		vec4(0.0, 1.0, 0.0, 0.0)
	]

	var planeTexCoords = [
		vec2(1,  0.0),
		vec2(0.0,  0.0),
		vec2(0.0, 1),

		vec2(1,  0.0),
		vec2(0.0, 1),
		vec2(1, 1)
	]
	for(var i =0; i<6;++i)
	{
		points.push(vertices[i]);
		colors.push(planeColors[i]);
		normalsArray.push(planeNormls[i]);
		texCoordsArray.push(planeTexCoords[i]);
	}
	return 6;
}
