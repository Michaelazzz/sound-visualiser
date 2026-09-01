#include "AudioAnalyser.hpp"
#include <iostream>
#include <cmath>
#include <algorithm>
#include <numeric>

// Static wrapper for PortAudio callback
static int paCallback(const void* inputBuffer, void* outputBuffer,
                      unsigned long framesPerBuffer,
                      const PaStreamCallbackTimeInfo* timeInfo,
                      PaStreamCallbackFlags statusFlags,
                      void* userData) {
    AudioAnalyzer* analyzer = static_cast<AudioAnalyzer*>(userData);
    return analyzer->audioCallback(inputBuffer, outputBuffer, framesPerBuffer, timeInfo, statusFlags);
}

AudioAnalyzer::AudioAnalyzer(int sampleRate, int bufferSize)
    : sampleRate(sampleRate), bufferSize(bufferSize), stream(nullptr) {
    
    rawBuffer.resize(bufferSize, 0.0f);
    previousSpectrum.resize(bufferSize / 2, 0.0f);
    frequencySpectrum.resize(bufferSize / 2, 0.0f);
    window.resize(bufferSize);

    // Generate Hann Window to reduce spectral leakage
    for (int i = 0; i < bufferSize; ++i) {
        window[i] = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (bufferSize - 1)));
    }

    // Initialize KissFFT
    cfg = kiss_fft_alloc(bufferSize, 0, nullptr, nullptr);
    fftIn.resize(bufferSize);
    fftOut.resize(bufferSize);

    Pa_Initialize();
}

AudioAnalyzer::~AudioAnalyzer() {
    stop();
    Pa_Terminate();
    kiss_fft_free(cfg);
}

bool AudioAnalyzer::start() {
    PaStreamParameters inputParameters;
    inputParameters.device = Pa_GetDefaultInputDevice();
    if (inputParameters.device == paNoDevice) {
        std::cerr << "Error: No default audio input device found.\n";
        return false;
    }
    inputParameters.channelCount = 1; // Mono input
    inputParameters.sampleFormat = paFloat32;
    inputParameters.suggestedLatency = Pa_GetDeviceInfo(inputParameters.device)->defaultLowInputLatency;
    inputParameters.hostApiSpecificStreamInfo = nullptr;

    PaError err = Pa_OpenStream(
        &stream,
        &inputParameters,
        nullptr, // No output
        sampleRate,
        bufferSize,
        paClipOff,
        paCallback,
        this
    );

    if (err != paNoError) {
        std::cerr << "PortAudio error open stream: " << Pa_GetErrorText(err) << std::endl;
        return false;
    }

    int numDevices = Pa_GetDeviceCount();
    for (int i = 0; i < numDevices; i++) {
        const PaDeviceInfo* deviceInfo = Pa_GetDeviceInfo(i);
        std::cout << "Device " << i << ": " << deviceInfo->name 
                << " (Max Inputs: " << deviceInfo->maxInputChannels << ")\n";
    }

    err = Pa_StartStream(stream);
    if (err != paNoError) {
        std::cerr << "PortAudio error start stream: " << Pa_GetErrorText(err) << std::endl;
        return false;
    }

    return true;
}

void AudioAnalyzer::stop() {
    if (stream) {
        Pa_StopStream(stream);
        Pa_CloseStream(stream);
        stream = nullptr;
    }
}

int AudioAnalyzer::audioCallback(const void* inputBuffer, void* outputBuffer,
                                 unsigned long framesPerBuffer,
                                 const PaStreamCallbackTimeInfo* timeInfo,
                                 PaStreamCallbackFlags statusFlags) {
    const float* in = static_cast<const float*>(inputBuffer);
    if (in) {
        for (unsigned long i = 0; i < framesPerBuffer; ++i) {
            rawBuffer[i] = in[i];
        }
        processAudio();
    }
    return paContinue;
}

void AudioAnalyzer::processAudio() {
    float rmsSum = 0.0f;
    int numBins = bufferSize / 2;

    // 1. Apply Window and calculate RMS
    for (int i = 0; i < bufferSize; ++i) {
        float sample = rawBuffer[i] * window[i];
        rmsSum += sample * sample;
        fftIn[i].r = sample;
        fftIn[i].i = 0.0f;
    }
    float rms = std::sqrt(rmsSum / bufferSize);

    // 2. Execute FFT
    kiss_fft(cfg, fftIn.data(), fftOut.data());

    // 3. Compute Magnitudes & Spectral Metrics
    float centroidNumerator = 0.0f;
    float centroidDenominator = 0.0f;
    float spectralFlux = 0.0f;
    float maxMagnitude = 0.0f;
    int peakBin = 0;

    std::vector<float> currentMagnitudes(numBins);
    for (int i = 0; i < numBins; ++i) {
        float mag = std::sqrt(fftOut[i].r * fftOut[i].r + fftOut[i].i * fftOut[i].i) / bufferSize;
        currentMagnitudes[i] = mag;

        // Spectral Centroid elements
        float freq = i * (static_cast<float>(sampleRate) / bufferSize);
        centroidNumerator += freq * mag;
        centroidDenominator += mag;

        // Spectral Flux (positive difference from previous frame)
        float diff = mag - previousSpectrum[i];
        if (diff > 0.0f) {
            spectralFlux += diff;
        }

        // Track global peak for fundamental tracking
        if (mag > maxMagnitude) {
            maxMagnitude = mag;
            peakBin = i;
        }
    }

    float centroid = (centroidDenominator > 0.0f) ? (centroidNumerator / centroidDenominator) / (sampleRate / 2.0f) : 0.0f;
    float fundamentalFreq = peakBin * (static_cast<float>(sampleRate) / bufferSize) / 20000.0f; // Normalized to 20kHz

    // Simple Harmonic-to-Noise approximation based on peak prominence
    float hnr = (maxMagnitude > 0.05f) ? std::min(maxMagnitude * 5.0f, 1.0f) : 0.0f;

    previousSpectrum = currentMagnitudes;

    // Thread-safe update of metrics and spectrum
    std::lock_guard<std::mutex> lock(metricsMutex);
    currentMetrics.rms = rms * 3.0f; // Scale factor for visual responsiveness
    currentMetrics.spectralCentroid = centroid;
    currentMetrics.spectralFlux = spectralFlux * 2.0f;
    currentMetrics.hnr = hnr;
    currentMetrics.fundamentalFreq = fundamentalFreq;

    for (int i = 0; i < numBins; ++i) {
        frequencySpectrum[i] = std::min(currentMagnitudes[i] * 10.0f, 1.0f); // Normalize for texture
    }
}

AudioMetrics AudioAnalyzer::getMetrics() {
    std::lock_guard<std::mutex> lock(metricsMutex);
    return currentMetrics;
}

std::vector<float> AudioAnalyzer::getFrequencySpectrum() {
    std::lock_guard<std::mutex> lock(metricsMutex);
    return frequencySpectrum;
}