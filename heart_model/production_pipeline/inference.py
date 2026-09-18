import os
import io
import time
import numpy as np
import torch
from scipy.io import wavfile
from .model import HeartSoundCNN
from .preprocess import preprocess_audio_pipeline

# Configurable thresholds
DEFAULT_NORMAL_THRESHOLD = float(os.environ.get("HEART_SOUND_NORMAL_THRESHOLD", "0.40"))
DEFAULT_FOLLOW_UP_THRESHOLD = float(os.environ.get("HEART_SOUND_FOLLOW_UP_THRESHOLD", "0.65"))

class HeartSoundPredictor:
    def __init__(self, model_path: str = None, device_str: str = "cpu"):
        self.device = torch.device(device_str if torch.cuda.is_available() and device_str == "cuda" else "cpu")
        self.model = HeartSoundCNN(num_classes=2)
        self.model_version = "heart_sound_cnn_v1"
        self.is_loaded = False

        if model_path and os.path.exists(model_path):
            checkpoint = torch.load(model_path, map_location=self.device)
            if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
                self.model.load_state_dict(checkpoint['model_state_dict'])
                self.model_version = checkpoint.get('model_version', 'heart_sound_cnn_v1')
            else:
                self.model.load_state_dict(checkpoint)
            self.model.to(self.device)
            self.model.eval()
            self.is_loaded = True
        elif model_path:
            raise FileNotFoundError(f"Configured heart sound model checkpoint not found at: {model_path}")
        else:
            # Uninitialized / awaiting weights or demo mode
            self.model.to(self.device)
            self.model.eval()

    def predict_audio_bytes(self, wav_bytes: bytes) -> dict:
        t0 = time.time()
        sr, audio_data = wavfile.read(io.BytesIO(wav_bytes))

        if audio_data.dtype == np.int16:
            audio = audio_data.astype(np.float32) / 32768.0
        elif audio_data.dtype == np.int32:
            audio = audio_data.astype(np.float32) / 2147483648.0
        else:
            audio = audio_data.astype(np.float32)

        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)

        t_pre = time.time()
        mel_spec = preprocess_audio_pipeline(audio, sr) # (64, 128)
        pre_duration = time.time() - t_pre

        tensor = torch.tensor(mel_spec, dtype=torch.float32).unsqueeze(0).unsqueeze(0).to(self.device)

        t_inf = time.time()
        with torch.no_grad():
            logits = self.model(tensor)
            probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]
        inf_duration = time.time() - t_inf

        prob_normal = float(probs[0])
        prob_abnormal = float(probs[1])

        # Risk stratification based on configured clinical thresholds
        if prob_abnormal >= DEFAULT_FOLLOW_UP_THRESHOLD:
            risk = "FOLLOW_UP"
            prediction = "abnormal_pattern"
        elif prob_abnormal >= DEFAULT_NORMAL_THRESHOLD:
            risk = "MONITOR"
            prediction = "abnormal_pattern"
        else:
            risk = "NORMAL"
            prediction = "normal"

        confidence = float(max(prob_normal, prob_abnormal))

        return {
            "module": "heart_sound",
            "prediction": prediction,
            "abnormal_probability": round(prob_abnormal, 4),
            "confidence": round(confidence, 4),
            "quality": "good" if len(audio) >= sr * 3 else "moderate",
            "risk": risk,
            "model_version": self.model_version,
            "screening_only": True,
            "disclaimer": "This screening identifies sound patterns that may warrant further evaluation. It does not diagnose a condition.",
            "metrics": {
                "inference_duration_ms": round(inf_duration * 1000, 2),
                "preprocessing_duration_ms": round(pre_duration * 1000, 2),
                "total_duration_ms": round((time.time() - t0) * 1000, 2)
            }
        }
