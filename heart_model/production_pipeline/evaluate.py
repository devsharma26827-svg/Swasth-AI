import argparse
import torch
import numpy as np
from torch.utils.data import DataLoader
from sklearn.metrics import confusion_matrix, roc_auc_score, classification_report
from .model import HeartSoundCNN
from .dataset import HeartSoundDataset

def evaluate(model_path: str, data_dir: str, batch_size: int = 32, device_str: str = "cpu"):
    device = torch.device(device_str if torch.cuda.is_available() and device_str == "cuda" else "cpu")
    print(f"=== Evaluating HeartSoundCNN Model: {model_path} on {data_dir} ===")

    dataset = HeartSoundDataset(data_dir=data_dir)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    model = HeartSoundCNN(num_classes=2)
    checkpoint = torch.load(model_path, map_location=device)
    if 'model_state_dict' in checkpoint:
        model.load_state_dict(checkpoint['model_state_dict'])
    else:
        model.load_state_dict(checkpoint)

    model.to(device)
    model.eval()

    all_preds = []
    all_probs = []
    all_targets = []

    with torch.no_grad():
        for inputs, targets in loader:
            inputs = inputs.to(device)
            logits = model(inputs)
            probs = torch.softmax(logits, dim=-1)

            all_probs.extend(probs[:, 1].cpu().numpy())
            all_preds.extend(torch.argmax(logits, dim=-1).cpu().numpy())
            all_targets.extend(targets.numpy())

    all_preds = np.array(all_preds)
    all_probs = np.array(all_probs)
    all_targets = np.array(all_targets)

    # Confusion matrix
    tn, fp, fn, tp = confusion_matrix(all_targets, all_preds, labels=[0, 1]).ravel()
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    macc = 0.5 * (sensitivity + specificity) # Official PhysioNet/CinC 2016 challenge metric
    roc_auc = roc_auc_score(all_targets, all_probs) if len(np.unique(all_targets)) > 1 else 0.5

    print("\n--- Clinical Evaluation Metrics ---")
    print(f"True Negatives (Normal detected as Normal): {tn}")
    print(f"False Positives (Normal flagged as Abnormal): {fp}")
    print(f"False Negatives (Abnormal missed): {fn}")
    print(f"True Positives (Abnormal detected): {tp}")
    print(f"Sensitivity (True Positive Rate): {sensitivity * 100:.2f}%")
    print(f"Specificity (True Negative Rate): {specificity * 100:.2f}%")
    print(f"PhysioNet Modified Accuracy (MAcc): {macc * 100:.2f}%")
    print(f"ROC-AUC Score: {roc_auc:.4f}")
    print("\nDetailed Classification Report:")
    print(classification_report(all_targets, all_preds, target_names=["Normal", "Abnormal"]))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_path", type=str, default="heart_sound_model.pt")
    parser.add_argument("--data_dir", type=str, default="./data/physionet2016_test")
    parser.add_argument("--device", type=str, default="cpu")
    args = parser.parse_args()
    evaluate(args.model_path, args.data_dir, device_str=args.device)
