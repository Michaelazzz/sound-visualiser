#pragma once

#include <vector>
#include <mutex>
#include <portaudio.h>
#include <kiss_fft.h>

struct AudioMetrics {
    float rms = 0.0f;
    float spectralCentroid = 0.0f;
    float spectralFlux = 0.0f;
    float hnr = 0.0f;
    float fundamentalFreq = 0.0f;
};

class AudioAnalyzer {
public:
    AudioAnalyzer(int sampleRate = 44100, int bufferSize = 1024);
    ~AudioAnalyzer();

    bool start();
    void stop();

    AudioMetrics getMetrics();
    std::vector<float> getFrequencySpectrum();

    // PortAudio C-style callback hook
    int audioCallback(const void* inputBuffer, void* outputBuffer,
                      unsigned long framesPerBuffer,
                      const PaStreamCallbackTimeInfo* timeInfo,
                      PaStreamCallbackFlags statusFlags);

private:
    int sampleRate;
    int bufferSize;
    PaStream* stream;

    std::vector<float> rawBuffer;
    std::vector<float> previousSpectrum;
    std::vector<float> frequencySpectrum;
    std::vector<float> window;
    
    AudioMetrics currentMetrics;
    std::mutex metricsMutex;

    // KissFFT configuration
    kiss_fft_cfg cfg;
    std::vector<kiss_fft_cpx> fftIn;
    std::vector<kiss_fft_cpx> fftOut;

    void processAudio();
};