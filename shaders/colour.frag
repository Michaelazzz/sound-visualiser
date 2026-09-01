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
    // Direct mapping of the sound space vector to color space across the entire screen
    float L = clamp(pow(u_amplitude, 0.75), 0.05, 0.95);
    float C = clamp(u_hnr * 0.3 * (1.0 - abs(u_centroid - 0.5)), 0.0, 0.4);
    float H = mod(u_frequency * 6.28318 + u_time * 0.05, 6.28318);

    vec3 oklch = vec3(L, C, H);
    vec3 col = oklch_to_srgb(oklch);

    fragColor = vec4(col, 1.0);
}