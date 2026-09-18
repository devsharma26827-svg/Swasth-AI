"""
Synthetic Pipeline Test Only
DEVELOPER SANITY CHECK ONLY - NOT FOR CLINICAL EVALUATION
"""
import numpy as np

def extract_features(signal_data: np.ndarray, sr: int = 2000) -> np.ndarray:
    """
    Extracts classical acoustic summary features for quick POC baseline test:
    - Root Mean Square (RMS) energy
    - Zero-Crossing Rate (ZCR)
    - Spectral Centroid proxy
    - High-frequency energy ratio (murmur surrogate)
    - Peak amplitude
    """
    if len(signal_data) == 0:
        return np.zeros(5, dtype=np.float32)

    rms = np.sqrt(np.mean(signal_data ** 2))
    zero_crossings = np.sum(np.diff(np.sign(signal_data)) != 0) / len(signal_data)
    peak = np.max(np.abs(signal_data))

    # FFT for spectral features
    fft_vals = np.abs(np.fft.rfft(signal_data))
    freqs = np.fft.rfftfreq(len(signal_data), 1.0 / sr)

    sum_fft = np.sum(fft_vals) + 1e-8
    spectral_centroid = np.sum(freqs * fft_vals) / sum_fft

    # Energy in murmur band (150 - 400 Hz) vs S1/S2 band (25 - 120 Hz)
    s1s2_mask = (freqs >= 25) & (freqs <= 120)
    murmur_mask = (freqs > 120) & (freqs <= 400)

    e_s1s2 = np.sum(fft_vals[s1s2_mask] ** 2) + 1e-8
    e_murmur = np.sum(fft_vals[murmur_mask] ** 2)
    murmur_ratio = e_murmur / e_s1s2

    return np.array([rms, zero_crossings, peak, spectral_centroid / 500.0, murmur_ratio], dtype=np.float32)
