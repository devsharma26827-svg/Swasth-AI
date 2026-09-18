import numpy as np
from scipy import signal

TARGET_SAMPLE_RATE = 2000   # 2000 Hz is clinical standard for PhysioNet/CinC PCG
N_MELS = 64
N_FFT = 256
HOP_LENGTH = 64
FIXED_FRAMES = 128
FREQ_MIN = 25.0             # Lower cutoff: filters breathing & baseline DC rumble
FREQ_MAX = 400.0            # Upper cutoff: cardiac sounds (S1, S2, murmurs) are <400Hz

def butter_bandpass(lowcut: float, highcut: float, fs: float, order: int = 4):
    nyq = 0.5 * fs
    low = max(0.01, lowcut / nyq)
    high = min(0.99, highcut / nyq)
    b, a = signal.butter(order, [low, high], btype='band')
    return b, a

def apply_bandpass_filter(data: np.ndarray, fs: float = TARGET_SAMPLE_RATE) -> np.ndarray:
    """Applies a 4th order Butterworth bandpass filter (25Hz - 400Hz)."""
    b, a = butter_bandpass(FREQ_MIN, FREQ_MAX, fs, order=4)
    # Zero-phase digital filtering
    filtered = signal.filtfilt(b, a, data)
    return filtered

def resample_audio(audio: np.ndarray, orig_sr: int, target_sr: int = TARGET_SAMPLE_RATE) -> np.ndarray:
    """Resamples audio to target sample rate using scipy polyphase resample."""
    if orig_sr == target_sr:
        return audio
    num_target_samples = int(len(audio) * float(target_sr) / orig_sr)
    resampled = signal.resample(audio, num_target_samples)
    return resampled

def normalize_audio(audio: np.ndarray) -> np.ndarray:
    """Peak-normalization to range [-1.0, 1.0]."""
    max_val = np.max(np.abs(audio))
    if max_val > 1e-6:
        return audio / max_val
    return audio

def hz_to_mel(hz: float) -> float:
    return 2595.0 * np.log10(1.0 + hz / 700.0)

def mel_to_hz(mel: float) -> float:
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)

def create_mel_filterbank(sr: int = TARGET_SAMPLE_RATE, n_fft: int = N_FFT, n_mels: int = N_MELS, fmin: float = FREQ_MIN, fmax: float = FREQ_MAX) -> np.ndarray:
    """Creates a triangular Mel filterbank matrix of shape (n_mels, 1 + n_fft // 2)."""
    num_bins = 1 + n_fft // 2
    mel_min = hz_to_mel(fmin)
    mel_max = hz_to_mel(fmax)
    mel_points = np.linspace(mel_min, mel_max, n_mels + 2)
    hz_points = mel_to_hz(mel_points)
    bin_points = np.floor((n_fft + 1) * hz_points / sr).astype(int)

    filterbank = np.zeros((n_mels, num_bins), dtype=np.float32)
    for m in range(1, n_mels + 1):
        f_m_minus = bin_points[m - 1]
        f_m = bin_points[m]
        f_m_plus = bin_points[m + 1]

        for k in range(f_m_minus, f_m):
            if k < num_bins and (f_m - f_m_minus) > 0:
                filterbank[m - 1, k] = (k - f_m_minus) / (f_m - f_m_minus)
        for k in range(f_m, f_m_plus):
            if k < num_bins and (f_m_plus - f_m) > 0:
                filterbank[m - 1, k] = (f_m_plus - k) / (f_m_plus - f_m)

    return filterbank

def compute_mel_spectrogram(audio: np.ndarray, sr: int = TARGET_SAMPLE_RATE) -> np.ndarray:
    """
    Computes log-Mel-spectrogram for 1D audio array.
    Returns array of shape (n_mels=64, time_frames).
    """
    # 1. Short-time Fourier Transform (STFT) with Hanning window
    window = np.hanning(N_FFT)
    # Compute STFT frames
    num_frames = max(1, (len(audio) - N_FFT) // HOP_LENGTH + 1)
    stft_matrix = np.zeros((1 + N_FFT // 2, num_frames), dtype=np.float32)

    for t in range(num_frames):
        start = t * HOP_LENGTH
        segment = audio[start:start + N_FFT]
        if len(segment) < N_FFT:
            segment = np.pad(segment, (0, N_FFT - len(segment)))
        windowed = segment * window
        fft_res = np.fft.rfft(windowed, n=N_FFT)
        power_spec = np.abs(fft_res) ** 2
        stft_matrix[:, t] = power_spec

    # 2. Apply Mel filterbank
    mel_fb = create_mel_filterbank(sr, N_FFT, N_MELS, FREQ_MIN, FREQ_MAX)
    mel_spectrogram = np.dot(mel_fb, stft_matrix)

    # 3. Log scaling (dB conversion with safety floor)
    log_mel = np.log10(np.maximum(mel_spectrogram, 1e-6))

    # 4. Standardize to zero mean, unit variance
    mean = np.mean(log_mel)
    std = np.std(log_mel)
    if std > 1e-5:
        log_mel = (log_mel - mean) / std

    return log_mel

def pad_or_crop_frames(mel: np.ndarray, target_frames: int = FIXED_FRAMES) -> np.ndarray:
    """Ensures spectrogram has exactly `target_frames` along time axis."""
    n_mels, frames = mel.shape
    if frames == target_frames:
        return mel
    elif frames < target_frames:
        pad_width = target_frames - frames
        return np.pad(mel, ((0, 0), (0, pad_width)), mode='constant', constant_values=0.0)
    else:
        # Center crop
        start = (frames - target_frames) // 2
        return mel[:, start:start + target_frames]

def preprocess_audio_pipeline(raw_audio: np.ndarray, orig_sr: int) -> np.ndarray:
    """
    Full preprocessing pipeline:
    raw audio -> 2000Hz resample -> bandpass filter (25-400Hz) -> normalize -> Mel-spectrogram -> pad/crop (64, 128)
    """
    # 1. Resample
    audio_2k = resample_audio(raw_audio, orig_sr, TARGET_SAMPLE_RATE)
    # 2. Filter
    filtered = apply_bandpass_filter(audio_2k, TARGET_SAMPLE_RATE)
    # 3. Normalize
    normalized = normalize_audio(filtered)
    # 4. Mel-spectrogram
    mel = compute_mel_spectrogram(normalized, TARGET_SAMPLE_RATE)
    # 5. Fix length
    fixed_mel = pad_or_crop_frames(mel, FIXED_FRAMES)
    return fixed_mel.astype(np.float32)
