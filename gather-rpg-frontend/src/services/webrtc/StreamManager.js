export class StreamManager {
  constructor() {
    this.localStream = null;
  }

  async initializeMedia(constraints = {
    video: { width: 320, height: 240, frameRate: 15 },
    audio: { echoCancellation: true, noiseSuppression: true }
  }) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
      return enabled;
    }
    return false;
  }

  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
      return enabled;
    }
    return false;
  }

  stopAllTracks() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  getStream() {
    return this.localStream;
  }
}

export const streamManager = new StreamManager();
