#version 300 es
precision mediump float;

out vec4 FragColor;

uniform float ambientStrength, specularStrength, diffuseStrength, shininess;

in vec3 Normal; // 法向量
in vec3 FragPos; // 片元世界位置
in vec2 TexCoord; // 纹理坐标
in vec4 FragPosLightSpace; // 片元在光空间的位置

uniform vec3 viewPos; // 相机位置
uniform vec4 u_lightPosition; // 光源位置（w==1 点光源；w==0 方向光）
uniform vec3 lightColor; // 光源颜色

uniform sampler2D diffuseTexture;
uniform sampler2D depthTexture;
uniform samplerCube cubeSampler; // 盒子环境贴图

// fog uniforms
uniform int u_fogEnabled; // 0/1
uniform int u_fogMode; // 0 = linear, 1 = exp, 2 = exp2
uniform vec3 u_fogColor;
uniform float u_fogDensity;
uniform float u_fogNear;
uniform float u_fogFar;

// 计算阴影，返回 1.0 = 阴影，0.0 = 非阴影
float shadowCalculation(vec4 fragPosLightSpace, vec3 normal, vec3 lightDir)
{
    /*TODO3: 添加阴影计算，返回1表示是阴影，返回0表示非阴影*/
    // 将片元在光空间中的坐标变换到 [0,1] 范围用于采样深度贴图
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    projCoords = projCoords * 0.5 + 0.5;

    // 若超出光的裁剪空间（在光源视锥外），认为不在阴影中
    if (projCoords.z > 1.0) {
        return 0.0;
    }

    // 从深度贴图读取最近的深度
    float closestDepth = texture(depthTexture, projCoords.xy).r;

    // 当前片元在光空间的深度
    float currentDepth = projCoords.z;

    // 计算 bias 防止自阴影 acne
    float bias = max(0.005 * (1.0 - dot(normal, lightDir)), 0.0005);

    // 简单深度比较
    float shadow = currentDepth - bias > closestDepth ? 1.0 : 0.0;

    return shadow;
}

// 计算 fog factor (返回 value in [0,1], 1.0 => keep object color, 0.0 => fully fog color)
float computeFogFactor(float dist)
{
    if (u_fogEnabled == 0) return 1.0;

    if (u_fogMode == 0) {
        // linear
        float f = (u_fogFar - dist) / (u_fogFar - u_fogNear);
        return clamp(f, 0.0, 1.0);
    } else if (u_fogMode == 1) {
        // exp
        float f = exp(-u_fogDensity * dist);
        return clamp(f, 0.0, 1.0);
    } else {
        // exp2
        float f = exp(- (u_fogDensity * dist) * (u_fogDensity * dist));
        return clamp(f, 0.0, 1.0);
    }
}

void main()
{
    // 采样纹理颜色
    vec3 TextureColor = texture(diffuseTexture, TexCoord).xyz;

    // 归一化向量
    vec3 norm = normalize(Normal);
    vec3 lightDir;
    if (u_lightPosition.w == 1.0)
    lightDir = normalize(u_lightPosition.xyz - FragPos);
    else
    lightDir = normalize(u_lightPosition.xyz);
    vec3 viewDir = normalize(viewPos - FragPos);
    vec3 halfDir = normalize(viewDir + lightDir);

    /*TODO2:根据phong shading方法计算ambient,diffuse,specular*/

    // Phong / Blinn-Phong 计算
    // 环境光
    vec3 ambient = ambientStrength * lightColor;

    // 漫反射
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = diffuseStrength * diff * lightColor;

    // 镜面反射
    float spec = 0.0;
    if (diff > 0.0) {
        spec = pow(max(dot(norm, halfDir), 0.0), shininess);
    }
    vec3 specular = specularStrength * spec * lightColor;

    // 总的反射光颜色
    vec3 lightReflectColor = ambient + diffuse + specular;

    // 阴影判定
    float shadow = shadowCalculation(FragPosLightSpace, norm, lightDir);

    // 合成最终颜色,阴影时保留环境光，抑制漫反射与镜面反射
    vec3 litColor = (1.0 - shadow) * (ambient + diffuse + specular) * TextureColor
    + shadow * (ambient * TextureColor);

    // Fog
    float dist = length(viewPos - FragPos);
    float fogFactor = computeFogFactor(dist);

    vec3 finalColor = mix(u_fogColor, litColor, fogFactor);


    FragColor = vec4(finalColor, 1.0);
}