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

// Pseudo-random hash function
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

// 2D Value Noise
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal Brownian Motion (fBm) for cloud generation
float fbm(vec2 p, float time) {
    float sum = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    
    for (int i = 0; i < 4; i++) {
        sum += amp * noise(p * freq + time);
        freq *= 2.0;
        amp *= 0.5;
    }
    return sum;
}

void main() {
    // 1. Normalize screen coordinates
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float time = u_time * 0.2;

    // Sample audio texture to modulate spatial distortion
    float audioSample = texture(u_audioTexture, abs(uv.x)).r;

    // 2. Domain warping: shift coordinates using nested sine/cosine and audio flux
    vec2 q = uv * 2.0;
    q.x += sin(time * 0.5 + q.y * 2.0) * (0.2 + u_flux * 0.5);
    q.y += cos(time * 0.3 - q.x * 2.0) * (0.2 + audioSample * 0.3);

    // Compute multi-octave nebula density field
    float n = fbm(q + vec2(time * 0.1), time);
    
    // Secondary noise layer for fine particle-like dust specs
    float dust = noise(uv * 20.0 + time * 2.0) * u_flux;

    // Combine layers into a final intensity scalar
    float density = smoothstep(0.1, 0.9, n) * (0.5 + u_amplitude * 1.5) + dust;

    // 3. Map to Oklch Color Space
    // Lightness maps directly to gas cloud density and transient hits
    float L = clamp(density * 0.8 + u_flux * 0.4, 0.02, 0.95);
    
    // Chroma is enriched by pure tonal inputs (high HNR) and muted during broadband noise
    float C = clamp(u_hnr * 0.3 * (1.0 - abs(u_centroid - 0.5)), 0.0, 0.4);
    
    // Hue drifts continuously across coordinates and time, modulated by fundamental frequency
    float H = mod(uv.x * 3.14159 + uv.y * 1.57 + u_frequency * 6.28318 + time * 0.2, 6.28318);

    vec3 oklch = vec3(L, C, H);
    vec3 col = oklch_to_srgb(oklch);

    // Vignette mask to softly fade nebula edges into black space
    float vignette = smoothstep(0.8, 0.2, length(uv));
    col *= vignette;

    fragColor = vec4(col, 1.0);
}