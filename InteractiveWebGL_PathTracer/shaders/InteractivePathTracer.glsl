precision highp float;
precision highp int;
precision highp sampler2D;

#include <raytracing_uniforms_and_defines>

#define N_SPHERES 8
#define N_BOXES 8
#define N_MATERIALS 8

#ifndef DIFFUSE
    #define DIFFUSE 0
#endif
#ifndef METAL
    #define METAL 1
#endif
#ifndef TRANSPARENT
    #define TRANSPARENT 2
#endif

uniform vec3 uBallPos;
uniform vec3 uLightPos;
uniform float uTimeOfDay; 
uniform int uBallMaterialID;
uniform float uAccumAlpha;
// --- 新增环境 Uniform ---
uniform float uLightIntensity; // 灯光强度
uniform vec3 uWallColor;       // 墙壁颜色

vec3 rayOrigin, rayDirection;
vec3 intersectionNormal;
int intersectionMaterialID;
vec3 intersectionPoint;

struct Material { int type; vec3 albedo; vec3 emission; float roughness; float metalness; float ior; };
struct Sphere { float radius; vec3 position; int materialID; };
struct Box { vec3 minCorner; vec3 maxCorner; int materialID; };

Material materials[N_MATERIALS];
Sphere spheres[N_SPHERES];
Box boxes[N_BOXES];

void SetupScene() {
    // 0: 墙面 - 使用 uWallColor 变量
    materials[0] = Material(DIFFUSE, uWallColor, vec3(0.0), 1.0, 0.0, 1.0);
    // 1: 顶灯 - 使用 uLightIntensity 变量 (作为发光颜色)
    materials[1] = Material(DIFFUSE, vec3(0.0), vec3(uLightIntensity), 0.0, 0.0, 1.0);
    
    // 其他材质保持不变
    materials[2] = Material(DIFFUSE, vec3(1.0, 0.1, 0.1), vec3(20.0, 1.5, 1.0), 0.2, 0.0, 1.0);
    materials[3] = Material(METAL, vec3(0.95), vec3(0.0), 0.01, 1.0, 1.0);
    materials[4] = Material(METAL, vec3(1.0, 0.7, 0.2), vec3(0.0), 0.1, 1.0, 1.0);
    materials[5] = Material(TRANSPARENT, vec3(0.98), vec3(0.0), 0.0, 0.0, 1.55);
    materials[6] = Material(METAL, vec3(0.0), vec3(0.0), 0.1, 0.2, 1.0);
    materials[7] = Material(DIFFUSE, vec3(0.0), vec3(0.2, 12.0, 0.5), 0.0, 0.0, 1.0);

    boxes[0] = Box(vec3(-200.0, -2.0, -200.0), vec3(200.0, 0.0, 200.0), 6);
    boxes[1] = Box(uLightPos + vec3(-40.0, -1.0, -40.0), uLightPos + vec3(40.0, 0.0, 40.0), 1);
    boxes[2] = Box(vec3(-100.0, 0.0, -100.0), vec3(100.0, 100.0, -105.0), 0);
    boxes[3] = Box(vec3(-80.0, 0.0, -80.0), vec3(-75.0, 60.0, 80.0), 2);
    boxes[4] = Box(vec3(75.0, 0.0, -80.0), vec3(80.0, 60.0, 80.0), 0);

    spheres[0] = Sphere(15.0, vec3(0.0, 15.0, -30.0), 3);
    spheres[1] = Sphere(12.0, vec3(-35.0, 12.0, 10.0), 5);
    spheres[2] = Sphere(10.0, vec3(35.0, 10.0, 10.0), 7);
    spheres[3] = Sphere(6.0, uBallPos, uBallMaterialID); 
    spheres[4] = Sphere(4.0, vec3(cos(uTime)*25.0, 25.0, sin(uTime)*25.0), 2);
    spheres[5] = Sphere(4.0, vec3(cos(uTime+3.14)*40.0, 10.0, sin(uTime+3.14)*40.0), 5);
}

// (中间工具函数省略，保持与前版本一致)
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float my_rng() { return fract(tan(distance(gl_FragCoord.xy * 1.618, gl_FragCoord.xy) * mod(uTime * 10.0 + uSampleCounter, 1000.0)) * gl_FragCoord.x); }
float tentFilter(float x) { return (x < 0.5) ? sqrt(2.0 * x) - 1.0 : 1.0 - sqrt(2.0 - 2.0 * x); }
vec3 randomDirectionInHemisphere(vec3 normal) { float z = my_rng() * 2.0 - 1.0; float a = my_rng() * 6.2831853; float r = sqrt(1.0 - z * z); vec3 randVec = normalize(vec3(r * cos(a), r * sin(a), z)); return dot(randVec, normal) < 0.0 ? -randVec : randVec; }
float SphereIntersect(float rad, vec3 pos, vec3 ro, vec3 rd) { vec3 op = pos - ro; float b = dot(op, rd); float det = b * b - dot(op, op) + rad * rad; if (det < 0.0) return INFINITY; det = sqrt(det); float t1 = b - det, t2 = b + det; if (t1 > 0.001) return t1; if (t2 > 0.001) return t2; return INFINITY; }
float BoxIntersect(vec3 minC, vec3 maxC, vec3 ro, vec3 rd, out vec3 n) { vec3 invDir = 1.0 / (rd + vec3(1e-6)); vec3 tMin = (minC - ro) * invDir, tMax = (maxC - ro) * invDir; vec3 t1 = min(tMin, tMax), t2 = max(tMin, tMax); float tN = max(max(t1.x, t1.y), t1.z), tF = min(min(t2.x, t2.y), t2.z); if (tN > tF || tF < 0.0) return INFINITY; vec3 p = ro + tN * rd - (minC + maxC) * 0.5; vec3 s = sign(p), d = abs(p) - (maxC - minC) * 0.5; if (d.x > d.y && d.x > d.z) n = vec3(s.x, 0, 0); else if (d.y > d.z) n = vec3(0, s.y, 0); else n = vec3(0, 0, s.z); return tN; }
float SceneIntersect() { float t = INFINITY, d; vec3 tmpN; for (int i = 0; i < N_SPHERES; i++) { d = SphereIntersect(spheres[i].radius, spheres[i].position, rayOrigin, rayDirection); if (d < t) { t = d; intersectionNormal = (rayOrigin + t * rayDirection) - spheres[i].position; intersectionMaterialID = spheres[i].materialID; intersectionPoint = rayOrigin + t * rayDirection; } } for (int i = 0; i < N_BOXES; i++) { d = BoxIntersect(boxes[i].minCorner, boxes[i].maxCorner, rayOrigin, rayDirection, tmpN); if (d < t) { t = d; intersectionNormal = tmpN; intersectionMaterialID = boxes[i].materialID; intersectionPoint = rayOrigin + t * rayDirection; } } return t; }

vec3 RayTrace(int maxBounces) {
    vec3 col = vec3(0.0), throughput = vec3(1.0);
    float sunAngle = uTimeOfDay * 6.283185 - 3.14159;
    vec3 currentSunDir = normalize(vec3(sin(sunAngle), cos(sunAngle), -0.5));
    float sunHeight = currentSunDir.y;

    for (int bounce = 0; bounce < 8; bounce++) {
        if (bounce >= maxBounces) break;
        float t = SceneIntersect();
        if (t == INFINITY) {
            vec3 nightSky = vec3(0.01, 0.02, 0.05); vec3 sunsetSky = vec3(0.9, 0.35, 0.1); vec3 daySky = vec3(0.15, 0.45, 0.9);
            vec3 ambientSky = (sunHeight > 0.1) ? mix(sunsetSky, daySky, smoothstep(0.1, 0.5, sunHeight)) : (sunHeight > -0.1 ? mix(nightSky, sunsetSky, smoothstep(-0.1, 0.1, sunHeight)) : nightSky);
            vec3 sunCol = (sunHeight > -0.05) ? mix(vec3(12.0, 4.0, 1.0), vec3(12.0, 11.0, 9.0), smoothstep(0.0, 0.4, sunHeight)) * pow(max(0.0, dot(rayDirection, currentSunDir)), 512.0) : vec3(0.0);
            if(sunHeight < 0.1) ambientSky += pow(hash12(rayDirection.xy * 150.0), 100.0) * smoothstep(0.1, -0.4, sunHeight) * 0.8;
            col += (ambientSky * 0.5 + sunCol) * throughput;
            break;
        }
        vec3 n = normalize(intersectionNormal); bool into = dot(n, rayDirection) < 0.0; vec3 normal = into ? n : -n;
        Material mat = materials[clamp(intersectionMaterialID, 0, N_MATERIALS - 1)];
        if (intersectionMaterialID == 6) {
            float check = mod(floor(intersectionPoint.x / 20.0) + floor(intersectionPoint.z / 20.0), 2.0); float noise = hash12(intersectionPoint.xz * 8.0);
            if (check < 0.5) { mat.albedo = vec3(0.04 + noise * 0.02); mat.roughness = 0.05 + noise * 0.1; }
            else { mat.albedo = vec3(0.92 - noise * 0.05); mat.roughness = 0.1 + noise * 0.15; }
        }
        col += mat.emission * throughput;
        if (mat.type == DIFFUSE && mat.emission.x < 0.1) {
            vec3 lightTarget = uLightPos + (randomDirectionInHemisphere(vec3(0,-1,0)) * 30.0);
            vec3 toLight = lightTarget - intersectionPoint; float dist = length(toLight);
            vec3 oldRo = rayOrigin, oldRd = rayDirection;
            rayOrigin = intersectionPoint + normal * 0.001; rayDirection = normalize(toLight);
            if (SceneIntersect() > dist - 0.1) col += (mat.albedo * vec3(mix(22.0, 15.0, smoothstep(-0.2, 0.2, sunHeight))) * max(0.0, dot(normal, rayDirection)) * 0.18) * throughput;
            rayOrigin = oldRo; rayDirection = oldRd;
        }
        if (bounce > 2) { float p = max(max(throughput.r, throughput.g), throughput.b); if (my_rng() > p) break; throughput /= p; }
        vec3 nextDir;
        if (mat.type == METAL) { nextDir = normalize(mix(reflect(rayDirection, normal), randomDirectionInHemisphere(normal), mat.roughness)); }
        else if (mat.type == TRANSPARENT) {
            float ior = mat.ior; float ni_over_nt = into ? (1.0 / ior) : ior;
            float cosTheta = min(dot(-rayDirection, normal), 1.0);
            float fresnel = pow((1.0-ior)/(1.0+ior), 2.0) + (1.0-pow((1.0-ior)/(1.0+ior), 2.0)) * pow(1.0-cosTheta, 5.0);
            if (my_rng() < fresnel) nextDir = reflect(rayDirection, n);
            else {
                if (uCameraIsMoving) { nextDir = refract(rayDirection, normal, ni_over_nt); if(length(nextDir) < 0.01) nextDir = reflect(rayDirection, n); }
                else {
                    vec3 refrR = refract(rayDirection, normal, ni_over_nt * 0.985), refrG = refract(rayDirection, normal, ni_over_nt), refrB = refract(rayDirection, normal, ni_over_nt * 1.015);
                    if (length(refrG) < 0.01) nextDir = reflect(rayDirection, n);
                    else { nextDir = refrG; throughput.r *= (length(refrR) > 0.01 ? 1.0 : 0.0); throughput.b *= (length(refrB) > 0.01 ? 1.0 : 0.0); }
                }
            }
            if(mat.roughness > 0.001) nextDir = normalize(mix(nextDir, randomDirectionInHemisphere(normal), mat.roughness));
        } else { nextDir = randomDirectionInHemisphere(normal); }
        col = mix(mix(vec3(0.01, 0.02, 0.04), vec3(0.5, 0.6, 0.8), smoothstep(-0.2, 0.3, sunHeight)) * throughput * 0.1, col, exp(-t * 0.0006));
        rayOrigin = intersectionPoint + nextDir * 0.001; rayDirection = nextDir; throughput *= mat.albedo;
    }
    return min(col, vec3(15.0));
}

void main() {
    vec3 camR = vec3(uCameraMatrix[0][0], uCameraMatrix[0][1], uCameraMatrix[0][2]);
    vec3 camU = vec3(uCameraMatrix[1][0], uCameraMatrix[1][1], uCameraMatrix[1][2]);
    vec3 camF = vec3(-uCameraMatrix[2][0], -uCameraMatrix[2][1], -uCameraMatrix[2][2]);
    SetupScene();
    vec3 accCol = vec3(0.0);
    int samples = uCameraIsMoving ? 1 : 8;
    int maxBounces = uCameraIsMoving ? 2 : 4;
    for(int i = 0; i < 8; i++) {
        if (i >= samples) break;
        vec2 off = !uCameraIsMoving && uSampleCounter < 500.0 ? vec2(tentFilter(my_rng()), tentFilter(my_rng())) : vec2(0.0);
        vec3 rd = normalize(camR * (((gl_FragCoord.xy + off) / uResolution) * 2.0 - 1.0).x * uULen + camU * (((gl_FragCoord.xy + off) / uResolution) * 2.0 - 1.0).y * uVLen + camF);
        vec3 ro = cameraPosition;
        if (!uCameraIsMoving && uApertureSize > 0.0) {
            vec3 focal = uFocusDistance * rd; float ang = my_rng() * 6.283, rad = sqrt(my_rng()) * uApertureSize;
            vec3 apPos = (camR * cos(ang) + camU * sin(ang)) * rad;
            ro += apPos; rd = normalize(focal - apPos);
        }
        rayOrigin = ro; rayDirection = rd; accCol += RayTrace(maxBounces);
    }
    vec3 curr = accCol / float(samples);
    vec3 prev = texelFetch(uPreviousTexture, ivec2(gl_FragCoord.xy), 0).rgb;
    float lerpAlpha = (uSampleCounter < 1.1) ? 1.0 : (uCameraIsMoving ? 0.45 : max(1.0/uSampleCounter, uAccumAlpha));
    pc_fragColor = vec4(mix(prev, curr, lerpAlpha), 1.0);
}