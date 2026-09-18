import os
import glob
import numpy as np
import torch
from torch.utils.data import Dataset
from scipy.io import wavfile

from .preprocess import preprocess_audio_pipeline

class HeartSoundDataset(Dataset):
    """
    HeartSoundDataset for PhysioNet/CinC Challenge 2016 Heart Sound Recordings.
    Reads WAV audio files, runs preprocessing pipeline, and provides (spectrogram, label).

    Label mapping:
    0: Normal
    1: Abnormal (murmur, valvular stenosis, arrhythmia)
    """
    def __init__(self, data_dir: str, file_list: list = None, labels_dict: dict = None, transform=None):
        self.data_dir = data_dir
        self.transform = transform

        if file_list is not None and labels_dict is not None:
            self.file_paths = file_list
            self.labels = [labels_dict[os.path.basename(f)] for f in self.file_paths]
        else:
            # Auto-discover files in directory
            self.file_paths = []
            self.labels = []
            # Check for REFERENCE.csv (PhysioNet format: filename, -1=normal, 1=abnormal)
            ref_path = os.path.join(data_dir, 'REFERENCE.csv')
            if os.path.exists(ref_path):
                with open(ref_path, 'r') as f:
                    for line in f:
                        parts = line.strip().split(',')
                        if len(parts) >= 2:
                            fname, lbl = parts[0].strip(), parts[1].strip()
                            wpath = os.path.join(data_dir, f"{fname}.wav")
                            if os.path.exists(wpath):
                                self.file_paths.append(wpath)
                                # Map -1 to 0 (normal), 1 to 1 (abnormal)
                                self.labels.append(1 if lbl == '1' else 0)
            else:
                # Default: scan wav files in subdirectories 'normal' and 'abnormal'
                norm_files = glob.glob(os.path.join(data_dir, 'normal', '*.wav'))
                for f in norm_files:
                    self.file_paths.append(f)
                    self.labels.append(0)

                abn_files = glob.glob(os.path.join(data_dir, 'abnormal', '*.wav'))
                for f in abn_files:
                    self.file_paths.append(f)
                    self.labels.append(1)

    def __len__(self):
        return len(self.file_paths)

    def __getitem__(self, idx):
        wav_path = self.file_paths[idx]
        label = self.labels[idx]

        # Read wav
        sr, audio_data = wavfile.read(wav_path)
        # Convert to float32 mono
        if audio_data.dtype == np.int16:
            audio = audio_data.astype(np.float32) / 32768.0
        elif audio_data.dtype == np.int32:
            audio = audio_data.astype(np.float32) / 2147483648.0
        else:
            audio = audio_data.astype(np.float32)

        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)

        # Preprocess to Mel-spectrogram
        mel_spec = preprocess_audio_pipeline(audio, sr) # Shape (64, 128)

        # To PyTorch Tensor: [1, 64, 128]
        tensor = torch.tensor(mel_spec, dtype=torch.float32).unsqueeze(0)
        label_tensor = torch.tensor(label, dtype=torch.long)

        if self.transform:
            tensor = self.transform(tensor)

        return tensor, label_tensor
