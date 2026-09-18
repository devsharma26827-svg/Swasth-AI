"""
Synthetic Pipeline Test Only
DEVELOPER SANITY CHECK ONLY - NOT FOR CLINICAL EVALUATION
"""
import os
import joblib
import numpy as np
from .features import extract_features

def predict_synthetic(signal_data: np.ndarray, model_path: str = "heart_model/synthetic_poc/model.joblib") -> dict:
    if not os.path.exists(model_path):
        return {
            "error": "Synthetic POC model.joblib not found. Run train_sklearn.py first.",
            "pipeline": "synthetic_poc_test_only"
        }

    clf = joblib.load(model_path)
    feats = extract_features(signal_data).reshape(1, -1)
    proba = clf.predict_proba(feats)[0]

    return {
        "pipeline": "synthetic_poc_test_only",
        "predicted_class": int(clf.predict(feats)[0]),
        "abnormal_probability": float(proba[1]),
        "disclaimer": "DEVELOPER SANITY CHECK ONLY - NOT EVIDENCE OF MEDICAL PERFORMANCE"
    }
