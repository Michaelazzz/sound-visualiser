Install System Dependencies (Ubuntu)

```
sudo apt update
sudo apt install build-essential cmake libglu1-mesa-dev portaudio19-dev libasound2-dev libx11-dev libxrandr-dev libxinerama-dev libxcursor-dev libxi-dev
```

Build Instructions

```
# 1. Create a build directory
mkdir build && cd build

# 2. Configure the project with CMake (this will automatically fetch GLFW, GLM, and KissFFT)
cmake ..

# 3. Compile the executable
make -j$(nproc)
```

Running the Program

```
./sound_visualiser
```
