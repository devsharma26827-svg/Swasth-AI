import os
import argparse
import time
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from .model import HeartSoundCNN
from .dataset import HeartSoundDataset

def train(
    data_dir: str,
    epochs: int = 30,
    batch_size: int = 32,
    lr: float = 1e-3,
    save_path: str = "heart_sound_model.pt",
    device_str: str = "cpu"
):
    print(f"=== Starting HeartSoundCNN Training Pipeline ===")
    print(f"Data Directory: {data_dir}")
    print(f"Epochs: {epochs}, Batch Size: {batch_size}, Learning Rate: {lr}")

    device = torch.device(device_str if torch.cuda.is_available() and device_str == "cuda" else "cpu")
    print(f"Using compute device: {device}")

    if not os.path.exists(data_dir):
        raise FileNotFoundError(f"Training data directory not found: {data_dir}")

    # Dataset loading
    full_dataset = HeartSoundDataset(data_dir=data_dir)
    total_samples = len(full_dataset)
    if total_samples == 0:
        raise ValueError(f"No WAV files found in {data_dir}. Ensure PhysioNet 2016 recordings or normal/abnormal folders exist.")

    val_size = max(1, int(0.2 * total_samples))
    train_size = total_samples - val_size
    train_set, val_set = random_split(full_dataset, [train_size, val_size])

    train_loader = DataLoader(train_set, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_set, batch_size=batch_size, shuffle=False, num_workers=0)

    print(f"Dataset split: {train_size} training samples, {val_size} validation samples.")

    # Instantiate model
    model = HeartSoundCNN(num_classes=2, dropout_rate=0.3).to(device)

    # Loss & Optimizer
    # Class weights to handle class imbalance
    class_weights = torch.tensor([1.0, 1.8], device=device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', factor=0.5, patience=3)

    best_val_acc = 0.0

    for epoch in range(1, epochs + 1):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        start_time = time.time()

        for inputs, targets in train_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * inputs.size(0)
            _, predicted = outputs.max(1)
            total += targets.size(0)
            correct += predicted.eq(targets).sum().item()

        epoch_loss = running_loss / total
        epoch_acc = (correct / total) * 100.0

        # Validation
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for inputs, targets in val_loader:
                inputs, targets = inputs.to(device), targets.to(device)
                outputs = model(inputs)
                loss = criterion(outputs, targets)
                val_loss += loss.item() * inputs.size(0)
                _, predicted = outputs.max(1)
                val_total += targets.size(0)
                val_correct += predicted.eq(targets).sum().item()

        val_epoch_loss = val_loss / val_total
        val_epoch_acc = (val_correct / val_total) * 100.0
        elapsed = time.time() - start_time

        print(f"Epoch [{epoch:02d}/{epochs:02d}] ({elapsed:.1f}s) - Train Loss: {epoch_loss:.4f}, Train Acc: {epoch_acc:.1f}% | Val Loss: {val_epoch_loss:.4f}, Val Acc: {val_epoch_acc:.1f}%")

        scheduler.step(val_epoch_acc)

        if val_epoch_acc > best_val_acc:
            best_val_acc = val_epoch_acc
            print(f"  --> Saving new best checkpoint to {save_path} (Val Acc: {val_epoch_acc:.1f}%)")
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_acc': val_epoch_acc,
                'model_version': 'heart_sound_cnn_v1'
            }, save_path)

    print(f"\nTraining completed. Best validation accuracy: {best_val_acc:.1f}%")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train HeartSoundCNN on PhysioNet CinC 2016 PCG dataset")
    parser.add_argument("--data_dir", type=str, default="./data/physionet2016", help="Path to heart sound WAV data")
    parser.add_argument("--epochs", type=int, default=25, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--save_path", type=str, default="heart_sound_model.pt", help="Checkpoint save destination")
    parser.add_argument("--device", type=str, default="cpu", help="Compute device: cpu or cuda")
    args = parser.parse_args()

    train(args.data_dir, args.epochs, args.batch_size, args.lr, args.save_path, args.device)
