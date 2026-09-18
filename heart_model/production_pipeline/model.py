import torch
import torch.nn as nn
import torch.nn.functional as F

class HeartSoundCNN(nn.Module):
    """
    HeartSoundCNN: Deep Convolutional Neural Network for Heart Sound Classification
    (Phonocardiogram / PCG screening for normal vs abnormal acoustic patterns).

    Input: Mel-spectrogram representation of heart sounds.
    Expected Input Shape: (batch_size, 1, n_mels=64, time_frames=128)
    Output: Logits for 2 classes [Class 0: Normal, Class 1: Abnormal Pattern]
    """
    def __init__(self, num_classes: int = 2, dropout_rate: float = 0.3):
        super(HeartSoundCNN, self).__init__()

        # Conv Block 1: Feature extraction for low-level acoustic transients (S1 / S2 clicks)
        self.conv1 = nn.Conv2d(in_channels=1, out_channels=32, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(32)
        self.pool1 = nn.MaxPool2d(kernel_size=2, stride=2)  # (32, 32, 64)
        self.drop1 = nn.Dropout2d(p=dropout_rate * 0.7)

        # Conv Block 2: Captures murmur frequency modulations across Mel bands
        self.conv2 = nn.Conv2d(in_channels=32, out_channels=64, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(64)
        self.pool2 = nn.MaxPool2d(kernel_size=2, stride=2)  # (64, 16, 32)
        self.drop2 = nn.Dropout2d(p=dropout_rate)

        # Conv Block 3: High-level cardiac cycle rhythm and temporal regularity
        self.conv3 = nn.Conv2d(in_channels=64, out_channels=128, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm2d(128)
        self.pool3 = nn.MaxPool2d(kernel_size=2, stride=2)  # (128, 8, 16)
        self.drop3 = nn.Dropout2d(p=dropout_rate)

        # Adaptive pooling to fixed spatial representation
        self.adaptive_pool = nn.AdaptiveAvgPool2d((4, 4))   # (128, 4, 4)

        # Fully Connected Classification Head
        self.fc1 = nn.Linear(128 * 4 * 4, 128)
        self.fc_bn = nn.BatchNorm1d(128)
        self.drop_fc = nn.Dropout(p=dropout_rate * 1.3)
        self.fc2 = nn.Linear(128, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: [B, 1, 64, 128] or [B, 64, 128]
        if x.dim() == 3:
            x = x.unsqueeze(1)

        # Block 1
        x = self.conv1(x)
        x = self.bn1(x)
        x = F.relu(x)
        x = self.pool1(x)
        x = self.drop1(x)

        # Block 2
        x = self.conv2(x)
        x = self.bn2(x)
        x = F.relu(x)
        x = self.pool2(x)
        x = self.drop2(x)

        # Block 3
        x = self.conv3(x)
        x = self.bn3(x)
        x = F.relu(x)
        x = self.pool3(x)
        x = self.drop3(x)

        # Pooling & Flatten
        x = self.adaptive_pool(x)
        x = x.view(x.size(0), -1)

        # Dense classification
        x = self.fc1(x)
        x = self.fc_bn(x)
        x = F.relu(x)
        x = self.drop_fc(x)
        logits = self.fc2(x)

        return logits

    def predict_proba(self, x: torch.Tensor) -> torch.Tensor:
        """Returns softmax probabilities: [P(Normal), P(Abnormal)]"""
        logits = self.forward(x)
        return F.softmax(logits, dim=-1)
