#version 450 core

out vec4 fragColor;
in vec2 fragCoord;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_amplitude;
uniform float u_centroid;
uniform float u_flux;
uniform float u_hnr;
uniform float u_frequency;
uniform sampler1D u_audioTexture;

// Oklch to Linear sRGB Conversion
vec3 oklch_to_srgb(vec3 oklch) {
    float L = oklch.x;
    float C = oklch.y;
    float h = oklch.z;
    
    float a = C * cos(h);
    float b = C * sin(h);
    
    float l_ = L + 0.3963377774f * a + 0.2158037573f * b;
    float m_ = L - 0.1055613458f * a - 0.0638541728f * b;
    float s_ = L - 0.0894841775f * a - 1.2914855480f * b;
    
    float l = l_ * l_ * l_;
    float m = m_ * m_ * m_;
    float s = s_ * s_ * s_;
    
    vec3 rgb;
    rgb.r =  4.0767416621f * l - 3.3077115913f * m + 0.2309699292f * s;
    rgb.g = -1.2684380046f * l + 2.6097574011f * m - 0.3413193965f * s;
    rgb.b = -0.0041960863f * l - 0.7034186147f * m + 1.7076147010f * s;
    
    return clamp(rgb, 0.0, 1.0);
}

// Smooth minimum for organic metaball blending
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// Signed Distance Function for the scene
float mapScene(vec3 p, float time) {
    // Sample texture based on position to distort space with audio
    float texSample = texture(u_audioTexture, abs(p.z * 0.1 + 0.5)).r;
    
    // Orbiting metaball centers modulated by audio amplitude and time
    vec3 c1 = vec3(sin(time * 0.7) * 1.2, cos(time * 0.5) * 0.8, sin(time * 0.3) * 0.5);
    vec3 c2 = vec3(cos(time * 0.9) * 1.0, sin(time * 0.6) * 1.0, cos(time * 0.4) * 0.5);
    
    // Scale radii dynamically using RMS amplitude and frequency feedback
    float r1 = 0.6 + u_amplitude * 0.5 + texSample * 0.3;
    float r2 = 0.5 + u_frequency * 0.4;
    
    float d1 = length(p - c1) - r1;
    float d2 = length(p - c2) - r2;
    
    // Smooth blend factor driven by HNR (purer sounds blend softer, noisy sounds are sharper)
    float blendFactor = 0.4 + (1.0 - u_hnr) * 0.3;
    float dist = smin(d1, d2, blendFactor);
    
    // Add high-frequency displacement based on spectral centroid
    float displacement = sin(p.x * 10.0 + time * 2.0) * sin(p.y * 10.0) * sin(p.z * 10.0) * (u_centroid * 0.1);
    
    return dist + displacement;
}

// Calculate normal vector for lighting by sampling gradients
vec3 calcNormal(vec3 p, float time) {
    float eps = 0.001;
    vec2 h = vec2(eps, 0.0);
    vec3 n = vec3(
        mapScene(p + h.xyy, time) - mapScene(p - h.xyy, time),
        mapScene(p + h.yxy, time) - mapScene(p - h.yxy, time),
        mapScene(p + h.yyx, time) - mapScene(p - h.yyx, time)
    );
    return normalize(n);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float time = u_time * 0.4;

    // Camera setup
    vec3 ro = vec3(0.0, 0.0, -3.5); // Ray origin (camera position)
    vec3 rd = normalize(vec3(uv, 1.0)); // Ray direction

    // Raymarching loop
    float t = 0.0;
    float maxDist = 20.0;
    int maxSteps = 64;
    bool hit = false;
    
    for (int i = 0; i < maxSteps; i++) {
        vec3 p = ro + rd * t;
        float d = mapScene(p, time);
        if (d < 0.001) {
            hit = true;
            break;
        }
        t += d;
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.0);

    if (hit) {
        vec3 p = ro + rd * t;
        vec3 normal = calcNormal(p, time);
        
        // Simple diffuse lighting vector
        vec3 lightDir = normalize(vec3(1.0, 2.0, -2.0));
        float diff = max(dot(normal, lightDir), 0.1);
        
        // Map audio features to Oklch Color Space for surface shading
        float L = clamp(diff * (0.2 + u_amplitude * 0.8) + (u_flux * 0.3), 0.05, 0.95);
        float C = clamp(u_hnr * 0.35 * (1.0 - abs(u_centroid - 0.5)), 0.0, 0.4);
        float H = mod(u_frequency * 6.28318 + t * 0.2 + time * 0.1, 6.28318);
        
        vec3 oklch = vec3(L, C, H);
        col = oklch_to_srgb(oklch);
        
        // Rim lighting glow on edges
        float rim = 1.0 - max(dot(-rd, normal), 0.0);
        col += vec3(rim * u_flux * 0.5);
    } else {
        // Deep background gradient mapped to frequency/amplitude floor
        float bgL = clamp(u_amplitude * 0.1, 0.01, 0.1);
        col = oklch_to_srgb(vec3(bgL, 0.05, u_frequency * 6.28318));
    }

    fragColor = vec4(col, 1.0);
}