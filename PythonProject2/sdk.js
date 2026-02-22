/* sdk.js — Yandex Games SDK wrapper with safe mock mode.
   Важно: для локального запуска YaGames обычно недоступен — используем заглушки.
   На платформе Yandex Games глобальный YaGames должен быть предоставлен окружением.
*/
(function () {
  "use strict";

  const SDK = {
    ysdk: null,
    initialized: false,
    _isAuth: false,
    _lang: "ru",
    _player: null,

    _pauseHandlers: [],
    _resumeHandlers: [],

    async initSDK() {
      // Detect SDK
      if (typeof window.YaGames !== "undefined" && window.YaGames && typeof window.YaGames.init === "function") {
        try {
          this.ysdk = await window.YaGames.init();
          this.initialized = true;

          // language
          try {
            const env = this.ysdk.environment || {};
            const loc = (env.i18n && env.i18n.lang) ? env.i18n.lang : null;
            if (loc) this._lang = loc;
          } catch (_) {}

          // game_api pause/resume
          try {
            this.ysdk.on && this.ysdk.on("game_api_pause", () => this._emitPause("sdk"));
            this.ysdk.on && this.ysdk.on("game_api_resume", () => this._emitResume("sdk"));
          } catch (_) {}

          return true;
        } catch (e) {
          console.warn("[SDK] YaGames.init failed, fallback to mock:", e);
          this._initMock();
          return false;
        }
      } else {
        this._initMock();
        return false;
      }
    },

    _initMock() {
      this.ysdk = null;
      this.initialized = false;
      // basic lang detection from browser
      const nav = (navigator.language || "en").toLowerCase();
      this._lang = nav.startsWith("ru") ? "ru" : "en";
      console.info("[SDK] Mock mode enabled (YaGames not found).");
    },

    onPause(cb) { this._pauseHandlers.push(cb); },
    onResume(cb) { this._resumeHandlers.push(cb); },

    _emitPause(src) { this._pauseHandlers.forEach(fn => { try { fn(src); } catch (_) {} }); },
    _emitResume(src) { this._resumeHandlers.forEach(fn => { try { fn(src); } catch (_) {} }); },

    ready() {
      // LoadingAPI.ready() after assets are ready and player can start
      try {
        if (this.ysdk && this.ysdk.features && this.ysdk.features.LoadingAPI) {
          this.ysdk.features.LoadingAPI.ready();
        }
      } catch (e) {
        console.warn("[SDK] ready() failed:", e);
      }
    },

    gameplayStart() {
      try {
        if (this.ysdk && this.ysdk.features && this.ysdk.features.GameplayAPI) {
          this.ysdk.features.GameplayAPI.start();
        }
      } catch (_) {}
    },

    gameplayStop() {
      try {
        if (this.ysdk && this.ysdk.features && this.ysdk.features.GameplayAPI) {
          this.ysdk.features.GameplayAPI.stop();
        }
      } catch (_) {}
    },

    getLang() {
      return (this._lang || "en").startsWith("ru") ? "ru" : "en";
    },

    isAuthenticated() {
      return !!this._isAuth;
    },

    async authRequest() {
      // Must be called only by explicit user action.
      if (!this.ysdk) {
        // mock: emulate auth success
        this._isAuth = true;
        this._player = { getData: async () => ({}), setData: async () => true };
        return true;
      }

      try {
        // getPlayer with scopes = false first, then true on demand
        const player = await this.ysdk.getPlayer({ scopes: true });
        this._player = player;
        this._isAuth = true;
        return true;
      } catch (e) {
        console.warn("[SDK] authRequest failed:", e);
        this._isAuth = false;
        return false;
      }
    },

    async cloudSave(data) {
      // Cloud saves only when authenticated.
      if (!this.isAuthenticated()) return false;

      if (!this.ysdk || !this._player || typeof this._player.setData !== "function") {
        // mock
        try {
          localStorage.setItem("mockCloudSave", JSON.stringify(data));
          return true;
        } catch (_) { return false; }
      }

      try {
        await this._player.setData(data);
        return true;
      } catch (e) {
        console.warn("[SDK] cloudSave failed:", e);
        return false;
      }
    },

    async cloudLoad() {
      if (!this.isAuthenticated()) return null;

      if (!this.ysdk || !this._player || typeof this._player.getData !== "function") {
        // mock
        try {
          const s = localStorage.getItem("mockCloudSave");
          return s ? JSON.parse(s) : null;
        } catch (_) { return null; }
      }

      try {
        const d = await this._player.getData();
        return d || null;
      } catch (e) {
        console.warn("[SDK] cloudLoad failed:", e);
        return null;
      }
    },

    async showInterstitial() {
      // Interstitial only in logical breaks
      if (!this.ysdk || !this.ysdk.adv || !this.ysdk.adv.showFullscreenAdv) {
        // mock: resolve quickly
        return { shown: false, reason: "mock" };
      }

      return new Promise((resolve) => {
        try {
          this.ysdk.adv.showFullscreenAdv({
            callbacks: {
              onOpen: () => resolve({ shown: true, phase: "open" }),
              onClose: () => resolve({ shown: true, phase: "close" }),
              onError: (err) => resolve({ shown: false, reason: "error", err })
            }
          });
        } catch (e) {
          resolve({ shown: false, reason: "exception", err: e });
        }
      });
    },

    async showRewarded() {
      if (!this.ysdk || !this.ysdk.adv || !this.ysdk.adv.showRewardedVideo) {
        // mock: instantly "reward"
        return { shown: false, rewarded: true, reason: "mock" };
      }

      return new Promise((resolve) => {
        try {
          this.ysdk.adv.showRewardedVideo({
            callbacks: {
              onOpen: () => resolve({ shown: true, phase: "open" }),
              onRewarded: () => resolve({ shown: true, rewarded: true }),
              onClose: () => resolve({ shown: true, rewarded: false, phase: "close" }),
              onError: (err) => resolve({ shown: false, rewarded: false, reason: "error", err })
            }
          });
        } catch (e) {
          resolve({ shown: false, rewarded: false, reason: "exception", err: e });
        }
      });
    }
  };

  window.YGSDK = SDK;
})();