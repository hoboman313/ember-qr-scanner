import Ember from 'ember';
import QRCode from 'jsqrcode';

import { getUserMedia, _setStream, ScanError } from 'ember-qr-scanner';

export default Ember.Component.extend({
  tagName: 'canvas',
  attributeBindings: ['width', 'height'],

  frameRate: 60,

  init() {
    this._super(...arguments);

    let qr = new QRCode();
    this.set('qr', qr);
  },

  didInsertElement() {
    this._super(...arguments);
    Ember.run.scheduleOnce('afterRender', this, '_start');
  },

  willRemoveElement() {
    this._cancelRun();
  },

  _start() {
    // Request camera access via getUserMedia()
    this.requestCameraAccess()
      .then(stream => {
        // Create <video> element
        let video = document.createElement('video');

        // Attach media stream to the <video> element
        _setStream(video, stream);
        video.play();

        // Schedule a _run() execution
        this._scheduleRun(video);
      })
      .catch(error => {
        this.getWithDefault('onError', () => this)(error);
      });
  },

  requestCameraAccess() {
    let constraints = { audio: false, video: { facingMode: 'environment' } };
    if (getUserMedia) {
      return getUserMedia(constraints);
    } else {
      return Ember.RSVP.Promise.reject(new Error('getUserMedia() is not available in this browser'));
    }
  },

  _scheduleRun(video) {
    let frameRate = this.get('frameRate');
    if (!this.get('isDestroyed')) {
      this.set('timerId', Ember.run.later(this, '_run', video, 1e3 / frameRate));
    } else {
      this._cancelRun();
    }
  },

  _cancelRun() {
    let timerId = this.get('timerId');
    if (timerId) {
      Ember.run.cancel(timerId);
    }
  },

  _run(video) {
    if (!video.paused && !video.ended && this.element) {
      let context = this.element.getContext('2d');

      // Transfer image from <video> element to the <canvas>
      context.drawImage(video, 0, 0, this.element.width, this.element.height);

      // Read image data from <canvas>
      let imageData = context.getImageData(0, 0, this.element.width, this.element.height);

      // Detect QR code on <canvas> image
      try {
        let result = this.get('qr').process(imageData);
        this.get('onSuccess')(result);
      } catch (error) {
        this.getWithDefault('onError', () => this)(new ScanError(error));
      }
    }

    // Schedule next _run() execution
    this._scheduleRun(video);
  }
});
