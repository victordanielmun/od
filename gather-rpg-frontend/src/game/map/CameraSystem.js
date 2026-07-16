import * as Phaser from 'phaser';

export class CameraSystem {
  constructor(scene) {
    this.scene = scene;
    this.zoom = window.innerWidth < 768 ? 0.8 : 1;
    this.zoomMin = 0.5;
    this.zoomMax = 2;
    this.zoomStep = 0.1;
  }

  adjustZoom(delta) {
    const cam = this.scene.cameras?.main;
    if (!cam) return;
    const next = Phaser.Math.Clamp(cam.zoom + delta, this.zoomMin, this.zoomMax);
    this.setZoom(next);
  }

  setZoom(zoom) {
    const cam = this.scene.cameras?.main;
    if (!cam) return;
    const next = Phaser.Math.Clamp(zoom, this.zoomMin, this.zoomMax);
    if (next === cam.zoom) return;
    cam.setZoom(next);
    
    // Recalculate bounds to avoid seeing out of map
    this.configureCamera();
  }

  configureCamera(gameSize) {
    const cam = this.scene.cameras?.main;
    if (!cam) return;

    const width = Number(gameSize?.width ?? this.scene.scale?.width ?? cam.width);
    const height = Number(gameSize?.height ?? this.scene.scale?.height ?? cam.height);

    if (Number.isFinite(width) && Number.isFinite(height)) {
      cam.setBounds(0, 0, this.scene.mapWidth, this.scene.mapHeight);
    }

    cam.setFollowOffset(0, 0);
    cam.setDeadzone();
    
    // Wait for player to exist before following
    if (this.scene.player) {
      cam.startFollow(this.scene.player, true, 0.1, 0.1);
      cam.centerOn(this.scene.player.x, this.scene.player.y);
    }

    if (this.scene.mapManager) {
      this.scene.mapManager.cameraBoundsDirty = true;
    }
  }
}
