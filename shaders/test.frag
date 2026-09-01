#version 410 core
out vec4 FragColor;

uniform float u_time;
uniform float u_amplitude;
uniform sampler1D u_audioTexture;

void main() {
    // Hardcoded animated color to test if rendering pipeline works
    vec3 color = vec3(abs(sin(u_time)), 0.5, 0.8);
    FragColor = vec4(color, 1.0);
}