cmake_minimum_required(VERSION 3.20...3.30)
project(SoundVisualizer C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(OpenGL REQUIRED)

include(FetchContent)

# 1. GLFW
FetchContent_Declare(
    glfw
    GIT_REPOSITORY https://github.com/glfw/glfw.git
    GIT_TAG        3.4
)
set(GLFW_BUILD_DOCS OFF CACHE BOOL "" FORCE)
set(GLFW_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(GLFW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(GLFW_BUILD_WAYLAND OFF CACHE BOOL "" FORCE)
set(GLFW_BUILD_X11 ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(glfw)

# 2. GLAD (OpenGL Loader - Required for <glad/glad.h>)
FetchContent_Declare(
    glad
    GIT_REPOSITORY https://github.com/Dav1dde/glad.git
    GIT_TAG        v0.1.36
)
FetchContent_MakeAvailable(glad)

# 3. GLM
FetchContent_Declare(
    glm
    GIT_REPOSITORY https://github.com/g-truc/glm.git
    GIT_TAG        1.0.1
)
FetchContent_MakeAvailable(glm)

# 4. PortAudio
FetchContent_Declare(
    portaudio
    GIT_REPOSITORY https://github.com/PortAudio/portaudio.git
    GIT_TAG        v19.7.0
)
set(PA_BUILD_SHARED OFF CACHE BOOL "" FORCE)
set(PA_BUILD_STATIC ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(portaudio)

# 5. KissFFT
FetchContent_Declare(
    kissfft
    GIT_REPOSITORY https://github.com/mborgerding/kissfft.git
    GIT_TAG        131.1.0
)
set(KISSFFT_DATATYPE float CACHE STRING "" FORCE)
set(KISSFFT_TOOLS OFF CACHE BOOL "" FORCE)
set(KISSFFT_TEST OFF CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(kissfft)

# Executable Target
add_executable(sound_visualiser
    src/main.cpp
    src/AudioAnalyser.cpp
    src/Shader.cpp
)

target_include_directories(sound_visualiser PRIVATE
    include
    ${glad_SOURCE_DIR}/include
)

target_link_libraries(sound_visualiser PRIVATE
    glfw
    glad
    glm::glm
    portaudio
    kissfft
    OpenGL::GL
)