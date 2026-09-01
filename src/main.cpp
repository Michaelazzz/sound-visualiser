#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <iostream>
#include "Shader.hpp"
#include "AudioAnalyser.hpp"

void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
    glViewport(0, 0, width, height);
}

int main() {
    if (!glfwInit()) {
        std::cerr << "Failed to initialize GLFW\n";
        return -1;
    }

    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 5);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

    GLFWwindow* window = glfwCreateWindow(1280, 720, "Sound-to-Image Generator", NULL, NULL);
    if (!window) {
        std::cerr << "Failed to create GLFW window\n";
        glfwTerminate();
        return -1;
    }
    glfwMakeContextCurrent(window);
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);

    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
        std::cerr << "Failed to initialize GLAD\n";
        return -1;
    }

    // Full-screen quad geometry
    float vertices[] = {
        -1.0f,  1.0f, 0.0f,
        -1.0f, -1.0f, 0.0f,
         1.0f, -1.0f, 0.0f,

        -1.0f,  1.0f, 0.0f,
         1.0f, -1.0f, 0.0f,
         1.0f,  1.0f, 0.0f
    };

    unsigned int VAO, VBO;
    glGenVertexArrays(1, &VAO);
    glGenBuffers(1, &VBO);
    glBindVertexArray(VAO);
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);

    AudioAnalyzer analyzer(44100, 1024);
    if (!analyzer.start()) {
        std::cerr << "Failed to start audio analyzer!\n";
        return -1;
    }

    // Create 1D Texture for Frequency Spectrum
    unsigned int spectrumTexture;
    glGenTextures(1, &spectrumTexture);
    glBindTexture(GL_TEXTURE_1D, spectrumTexture);
    glTexParameteri(GL_TEXTURE_1D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_1D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_1D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);

    Shader shader("shaders/screen.vert", "shaders/colour.frag");

    while (!glfwWindowShouldClose(window)) {
        glfwPollEvents();

        // 1. Fetch live metrics & spectrum
        AudioMetrics metrics = analyzer.getMetrics();
        std::vector<float> spectrum = analyzer.getFrequencySpectrum();

        // 2. Update 1D Audio Texture on GPU
        glBindTexture(GL_TEXTURE_1D, spectrumTexture);
        glTexImage1D(GL_TEXTURE_1D, 0, GL_R32F, spectrum.size(), 0, GL_RED, GL_FLOAT, spectrum.data());

        // 3. Render setup
        glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);

        shader.use();
        shader.setFloat("u_time", static_cast<float>(glfwGetTime()));
        shader.setFloat("u_amplitude", metrics.rms);
        shader.setFloat("u_centroid", metrics.spectralCentroid);
        shader.setFloat("u_flux", metrics.spectralFlux);
        shader.setFloat("u_hnr", metrics.hnr);
        shader.setFloat("u_frequency", metrics.fundamentalFreq);
        
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_1D, spectrumTexture);
        shader.setInt("u_audioTexture", 0);

        glBindVertexArray(VAO);
        glDrawArrays(GL_TRIANGLES, 0, 6);

        glfwSwapBuffers(window);
    }

    analyzer.stop();

    glDeleteVertexArrays(1, &VAO);
    glDeleteBuffers(1, &VBO);
    glfwTerminate();
    return 0;
}