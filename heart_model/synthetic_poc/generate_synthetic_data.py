"""
Synthetic Pipeline Test Only
DEVELOPER SANITY CHECK ONLY - NOT FOR CLINICAL EVALUATION
Generates synthetic Phonocardiogram (PCG) acoustic waveforms for pipeline verification.
"""
import numpy as np

def generate_pcg_cycle(is_abnormal: bool = False, duration_sec: float = 5.0, sr: int = 2000) -> np.ndarray:
    t = np.linspace(0, duration_sec, int(sr * duration_sec))
    period = 0.85 # ~70 BPM
    signal = np.zeros_like(t)

    # Fundamental cardiac cycles (S1: mitral/tricuspid closure, S2: aortic/pulmonary closure)
    for cycle_start in np.arange(0, duration_sec, period):
        # S1 around +0.05s
        t_s1 = cycle_start + 0.05
        s1 = np.exp(-((t - t_s1) ** 2) / 0.0015) * np.sin(2 * np.pi * 55 * (t - t_s1))
        # S2 around +0.35s
        t_s2 = cycle_start + 0.35
        s2 = 0.8 * np.exp(-((t - t_s2) ** 2) / 0.0012) * np.sin(2 * np.pi * 85 * (t - t_s2))

        signal += s1 + s2

        if is_abnormal:
            # Systolic murmur: turbulent high-frequency acoustic rumble between S1 and S2
            t_murmur_start = cycle_start + 0.12
            t_murmur_end = cycle_start + 0.30
            murmur_mask = (t >= t_murmur_start) & (t <= t_murmur_end)
            murmur = 0.35 * np.sin(2 * np.pi * 280 * t) * np.sin(np.pi * (t - t_murmur_start) / (t_murmur_end - t_murmur_start))
            signal[murmur_mask] += murmur[murmur_mask]

    # Add gentle pink/gaussian ambient sensor noise
    noise = np.random.normal(0, 0.03, len(t))
    signal += noise

    return signal.astype(np.float32)

if __name__ == "__main__":
    print("Generating synthetic sample signals...")
    normal_sample = generate_pcg_cycle(is_abnormal=False)
    abnormal_sample = generate_pcg_cycle(is_abnormal=True)
    print(f"Generated normal ({len(normal_sample)} samples) and abnormal ({len(abnormal_sample)} samples).")
