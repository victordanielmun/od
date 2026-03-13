import { peerManager } from './PeerManager';

export class ProximityDetector {
  constructor(radius = 150, buffer = 30) {
    this.radius = radius;
    this.buffer = buffer; // Hysteresis buffer
    this.nearbyUsers = new Set();
  }

  update(myPos, remotePlayers, myUserId) {
    if (!myPos) return;
    const myId = myUserId == null ? null : String(myUserId);

    remotePlayers.forEach((player, userId) => {
      if (!player.x || !player.y) return;
      const targetId = String(userId);
      if (myId && targetId === myId) return;

      const dist = Math.sqrt(
        Math.pow(myPos.x - player.x, 2) + 
        Math.pow(myPos.y - player.y, 2)
      );

      const isNearby = this.nearbyUsers.has(targetId);

      if (!isNearby && dist < this.radius) {
        const isInitiator = myId ? myId < targetId : true;
        peerManager.createPeer(targetId, isInitiator);
        if (peerManager.peers.has(targetId)) {
          this.nearbyUsers.add(targetId);
        }
      } else if (isNearby && dist > (this.radius + this.buffer)) {
        this.nearbyUsers.delete(targetId);
        peerManager.removePeer(targetId);
      }
    });
  }
  
  reset() {
    this.nearbyUsers.clear();
  }
}

export const proximityDetector = new ProximityDetector();
