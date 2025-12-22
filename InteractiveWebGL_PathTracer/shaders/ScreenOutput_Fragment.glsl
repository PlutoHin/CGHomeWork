precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uRayTracedImageTexture;
uniform float uOneOverSampleCounter;
uniform bool uUseToneMapping;

vec3 CustomACES(vec3 color) {
	float a = 2.51; float b = 0.03; float c = 2.43; float d = 0.59; float e = 0.14;
	return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
}

void main()
{
	vec3 pixelColor = texelFetch(uRayTracedImageTexture, ivec2(gl_FragCoord.xy), 0).rgb;
	// 注意：这里不需要再乘 uOneOverSampleCounter，因为已经在 WhittedFragment 里做完平均了

	if (uUseToneMapping) pixelColor = CustomACES(pixelColor);

	// 简单的 Gamma 校正
	pc_fragColor = clamp(vec4(pow(pixelColor, vec3(1.0 / 2.2)), 1.0), 0.0, 1.0);
}