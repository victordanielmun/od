package webrtc

import (
	"math"
)

const (
	AudioRange         = 800.0
	MaxPeerConnections = 8
)

func CalculateDistance(x1, y1, x2, y2 float64) float64 {
	return math.Sqrt(math.Pow(x2-x1, 2) + math.Pow(y2-y1, 2))
}

func IsInAudioRange(distance float64) bool {
	return distance <= AudioRange
}

func CalculateAudioVolume(distance float64) float64 {
	// Linear attenuation: 1.0 at 0 distance, 0.0 at AudioRange
	if distance >= AudioRange {
		return 0.0
	}
	return 1.0 - (distance / AudioRange)
}
