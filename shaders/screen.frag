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

// Module 1: Smooth & Melodic (Laminar Flow / Liquid Sine Fields)
vec2 renderMelodic(vec2 uv, float t) {
    float freqSample = texture(u_audioTexture, abs(uv.x)).r;
    vec2 p = uv;
    p.x += sin(p.y * 3.0 + t * 0.5) * 0.2 * (1.0 + freqSample);
    p.y += cos(p.x * 3.0 + t * 0.5) * 0.2;
    return p;
}

// Module 2: Chaotic & Percussive (Fractal Domain Folding & Disruption)
vec2 renderChaotic(vec2 uv, float t, float flux) {
    vec2 p = uv;
    for(int i = 0; i < 3; i++) {
        p = abs(p) / dot(p, p) - 0.8;
        p *= mat2(cos(t), -sin(t), sin(t), cos(t));
    }
    p += (fract(uv * 10.0) - 0.5) * flux * 0.5;
    return p;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float t = u_time * 0.5;

    // Calculate Chaos Index based on low HNR and high Flux
    float chaosIndex = clamp((1.0 - u_hnr) * 0.5 + u_flux * 0.5, 0.0, 1.0);

    // Modular Blend: Interpolate coordinate space between melodic and chaotic behaviors
    vec2 pMelodic = renderMelodic(uv, t);
    vec2 pChaotic = renderChaotic(uv, t, u_flux);
    vec2 pFinal = mix(pMelodic, pChaotic, chaosIndex);

    // Distance field or pattern generation based on final coordinates
    float d = length(pFinal);
    float freqSample = texture(u_audioTexture, fract(d - t)).r;

    // Map to Oklch Color Space
    float L = clamp(pow(u_amplitude * (1.0 + freqSample), 0.75), 0.05, 0.95);
    // Chaos desaturates or shifts chroma dynamically
    float C = clamp((u_hnr * 0.3) * (1.0 - abs(u_centroid - 0.5)), 0.0, 0.4);
    float H = mod(u_frequency * 6.28318 + d * 3.14 + t * 0.1 + (chaosIndex * 3.14), 6.28318);

    vec3 oklch = vec3(L, C, H);
    vec3 col = oklch_to_srgb(oklch);

    // Add high-frequency edge glow during chaos spikes
    col += vec3(u_flux * 0.3, u_flux * 0.1, u_flux * 0.5);

    fragColor = vec4(col, 1.0);
}