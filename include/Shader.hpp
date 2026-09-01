#pragma once
#include <string>
#include <glad/glad.h>

class Shader {
public:
    unsigned int ID;
    Shader(const char* vertexPath, const char* fragmentPath);
    void use();
    void setFloat(const std::string &name, float value) const;
    void setVec2(const std::string &name, float x, float y) const;
    void setInt(const std::string &name, int value) const;
};