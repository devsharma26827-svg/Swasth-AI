"""
Synthetic Pipeline Test Only
DEVELOPER SANITY CHECK ONLY - NOT FOR CLINICAL EVALUATION
Trains a lightweight sklearn classifier on synthetic data to sanity check feature extraction.
"""
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import joblib

from .generate_synthetic_data import generate_pcg_cycle
from .features import extract_features

def train_synthetic_poc():
    print("=== Training Synthetic POC Classifier (DEVELOPER TEST ONLY) ===")
    X = []
    y = []

    # Generate 100 synthetic normal & 100 synthetic abnormal signals
    np.random.seed(42)
    for _ in range(100):
        sig = generate_pcg_cycle(is_abnormal=False)
        feats = extract_features(sig)
        X.append(feats)
        y.append(0)

    for _ in range(100):
        sig = generate_pcg_cycle(is_abnormal=True)
        feats = extract_features(sig)
        X.append(feats)
        y.append(1)

    X = np.array(X)
    y = np.array(y)

    clf = RandomForestClassifier(n_estimators=50, random_state=42)
    clf.fit(X, y)

    preds = clf.predict(X)
    acc = accuracy_score(y, preds)
    print(f"Synthetic POC Training Accuracy: {acc * 100:.1f}%")

    joblib.dump(clf, "heart_model/synthetic_poc/model.joblib")
    print("Saved model to heart_model/synthetic_poc/model.joblib")

if __name__ == "__main__":
    train_synthetic_poc()
