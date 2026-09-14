/**
 * XPLOITX // Dedicated Instance Worker - Image Management (instance-worker/docker/images.js)
 */

const runtime = require('./runtime');

class ImageManager {
  /**
   * Ensure image is present locally, pulling from approved registry if necessary
   */
  async ensureImage(image) {
    if (!image) throw new Error('IMAGE_NAME_REQUIRED');

    try {
      await runtime.request('GET', `/images/${encodeURIComponent(image)}/json`);
      return true;
    } catch (e) {
      if (e.statusCode === 404) {
        console.log(`[WORKER] Image '${image}' not found locally. Pulling from registry...`);
        await runtime.request('POST', `/images/create?fromImage=${encodeURIComponent(image)}`);
        console.log(`[WORKER] Successfully pulled image '${image}'`);
        return true;
      }
      throw e;
    }
  }
}

module.exports = new ImageManager();
