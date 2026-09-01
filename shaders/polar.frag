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

void main() {
    // 1. Normalize screen coordinates (-0.5 to 0.5, aspect corrected)
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float time = u_time * 0.5;

    // 2. Convert Cartesian to Polar coordinates
    float r = length(uv);
    float theta = atan(uv.y, uv.x);
    
    // Normalize angle theta from [-PI, PI] to [0, 1] for texture sampling
    float normalizedTheta = (theta + 3.14159265359) / 6.28318530718;
    
    // Shift texture lookup with time to make the polar ring slowly rotate
    float sampledFreq = texture(u_audioTexture, fract(normalizedTheta + time * 0.1)).r;

    // 3. Define base radius modulated by RMS amplitude and frequency texture
    float baseRadius = 0.25 + u_amplitude * 0.2;
    float dynamicRadius = baseRadius + sampledFreq * (0.3 + u_flux * 0.5);

    // 4. Create main sharp ring and secondary outer aura
    float ringWidth = 0.008 + u_centroid * 0.01;
    float ring = smoothstep(dynamicRadius, dynamicRadius - ringWidth, r) - 
                 smoothstep(dynamicRadius - ringWidth, dynamicRadius - (ringWidth * 2.0), r);

    // Outer harmonic glow based on distance to dynamic boundary
    float glow = 0.05 / abs(r - dynamicRadius);

    // 5. Map to Oklch Color Space
    // Lightness spikes with ring intensity and transient flux
    float L = clamp((ring * 0.9 + glow * 0.2) * (0.4 + u_amplitude * 0.6) + u_flux * 0.4, 0.05, 0.95);
    
    // Chroma/Saturation drops during noisy/chaotic inputs (low HNR), rich during pure tones
    float C = clamp(u_hnr * 0.35 * (1.0 - abs(u_centroid - 0.5)), 0.0, 0.4);
    
    // Hue sweeps continuously around the circle, modulated by angle and fundamental frequency
    float H = mod(normalizedTheta * 6.28318530718 + u_frequency * 6.28318530718 + time * 0.2, 6.28318530718);

    vec3 oklch = vec3(L, C, H);
    vec3 col = oklch_to_srgb(oklch);

    // Add deep space background gradient
    float bgMask = smoothstep(0.6, 0.0, r);
    vec3 bgColor = oklch_to_srgb(vec3(0.03 + u_amplitude * 0.05, 0.02, normalizedTheta * 6.28318530718)) * bgMask;
    
    col += bgColor;

    fragColor = vec4(col, 1.0);
}