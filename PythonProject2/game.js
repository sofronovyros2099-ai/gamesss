/* game.js — Business Empire Idle (DOM+CSS), no external libs */

(function () {
  "use strict";

  /* =========================
     Helpers
  ========================= */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => Date.now();
  const rand = (a, b) => a + Math.random() * (b - a);

  function formatInt(n, lang) {
    const safe = Math.floor(Math.max(0, n));
    // requirement: "12,345,678" or locale — we keep comma for en, space for ru
    if (lang === "ru") {
      return safe.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }
    return safe.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function formatTimeMMSS(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function humanPrice(n) {
    // 1000->1K, 1e6->1.2M etc (simple)
    const v = Math.max(0, n);
    if (v >= 1e9) return (v / 1e9).toFixed(v >= 1e10 ? 0 : 1) + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + "K";
    return String(Math.floor(v));
  }

  /* =========================
     Localization (RU/EN)
  ========================= */
  const I18N = {
    ru: {
      tab_home: "Home",
      tab_shop: "Shop",
      tab_stats: "Stats",
      tab_rewards: "Rewards",
      tab_settings: "Settings",

      upgrade_income_title: "Increase Income",
      upgrade_boost_title: "Business Boost",
      upgrade_auto_title: "Auto Collect",
      upgrade_btn: "UPGRADE",

      shop_title: "UPGRADE SHOP",
      shop_item_1: "Invest Funds",
      shop_item_2: "Expand Business",
      shop_item_3: "Hire Manager",
      shop_item_4: "Business Summit",
      shop_item_5: "Global Expansion",
      buy_btn: "BUY",
      shop_hint: "Покупки ускоряют рост вашей империи.",

      rewards_title: "Rewards",
      reward_boost_title: "Смотреть рекламу → x2 доход на 3 минуты",
      reward_watch_btn: "СМОТРЕТЬ",
      reward_offline_title: "Офлайн доход",
      reward_offline_sub: "Заработок пока вас не было (до 2 часов).",
      reward_info_btn: "ИНФО",
      ads_note: "Реклама необязательна и даёт только внутриигровые бонусы.",

      settings_title: "Settings",
      settings_sound: "Звук",
      settings_sound_sub: "Клики и апгрейды",
      settings_music: "Музыка",
      settings_music_sub: "Фоновая музыка",
      settings_lang: "Язык",
      settings_lang_sub: "Переключить язык UI",
      settings_note: "Игра ставится на паузу и выключает звук при скрытии вкладки и во время рекламы.",

      auth_title: "Облачный прогресс",
      auth_text: "Войдите, чтобы синхронизировать прогресс на разных устройствах. Гостевой режим работает без входа.",
      auth_btn: "ВОЙТИ",

      stats_title: "Stats",
      stat_total_clicks: "Кликов всего",
      stat_income_ps: "Доход / сек",
      stat_click_value: "Доход за клик",
      stat_play_time: "Время в игре",
      stat_business_level: "Уровень бизнеса",

      biz_upgrade_btn: "UPGRADE",

      close_btn: "ЗАКРЫТЬ",

      modal_offline_title: "Офлайн доход",
      modal_offline_body: "Пока вас не было, вы заработали: {x}",
      modal_offline_action: "УДВОИТЬ ЗА РЕКЛАМУ",

      modal_info_title: "Офлайн доход",
      modal_info_body: "Офлайн доход начисляется при входе, максимум за 2 часа.",
      modal_ok: "OK",

      guest: "Гость",
      signed: "Вход выполнен"
    },
    en: {
      tab_home: "Home",
      tab_shop: "Shop",
      tab_stats: "Stats",
      tab_rewards: "Rewards",
      tab_settings: "Settings",

      upgrade_income_title: "Increase Income",
      upgrade_boost_title: "Business Boost",
      upgrade_auto_title: "Auto Collect",
      upgrade_btn: "UPGRADE",

      shop_title: "UPGRADE SHOP",
      shop_item_1: "Invest Funds",
      shop_item_2: "Expand Business",
      shop_item_3: "Hire Manager",
      shop_item_4: "Business Summit",
      shop_item_5: "Global Expansion",
      buy_btn: "BUY",
      shop_hint: "Buy upgrades to speed up your empire growth.",

      rewards_title: "Rewards",
      reward_boost_title: "Watch Ad → x2 income for 3 minutes",
      reward_watch_btn: "WATCH",
      reward_offline_title: "Offline income",
      reward_offline_sub: "Earn while you were away (up to 2 hours).",
      reward_info_btn: "INFO",
      ads_note: "Ads are optional and only give in-game bonuses.",

      settings_title: "Settings",
      settings_sound: "Sound",
      settings_sound_sub: "Clicks & upgrades",
      settings_music: "Music",
      settings_music_sub: "Background music",
      settings_lang: "Language",
      settings_lang_sub: "Switch UI language",
      settings_note: "Game pauses and mutes when tab is hidden and during ads.",

      auth_title: "Cloud Save",
      auth_text: "Sign in to sync progress across devices. Guest mode works without sign-in.",
      auth_btn: "SIGN IN",

      stats_title: "Stats",
      stat_total_clicks: "Total Clicks",
      stat_income_ps: "Income / sec",
      stat_click_value: "Click Value",
      stat_play_time: "Play Time",
      stat_business_level: "Business Level",

      biz_upgrade_btn: "UPGRADE",

      close_btn: "CLOSE",

      modal_offline_title: "Offline Income",
      modal_offline_body: "While you were away, you earned: {x}",
      modal_offline_action: "DOUBLE FOR AD",

      modal_info_title: "Offline Income",
      modal_info_body: "Offline income is granted on launch, up to 2 hours maximum.",
      modal_ok: "OK",

      guest: "Guest",
      signed: "Signed in"
    }
  };

  /* =========================
     Audio (simple WebAudio)
  ========================= */
  class AudioManager {
    constructor() {
      this.enabled = true;
      this.musicEnabled = false;
      this.ctx = null;
      this._mutedBySystem = false;
      this._musicOsc = null;
      this._musicGain = null;
    }

    _ensureCtx() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      return this.ctx;
    }

    setEnabled(v) { this.enabled = !!v; }
    setMusicEnabled(v) {
      this.musicEnabled = !!v;
      if (!this.musicEnabled) this.stopMusic();
      else this.startMusic();
    }

    async resumeIfNeeded() {
      const ctx = this._ensureCtx();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        try { await ctx.resume(); } catch (_) {}
      }
    }

    stopAllOnPause() {
      this._mutedBySystem = true;
      this.stopMusic();
    }

    resumeAllOnFocus() {
      this._mutedBySystem = false;
      if (this.musicEnabled) this.startMusic();
    }

    _beep(freq, dur, type = "sine", vol = 0.05) {
      if (!this.enabled || this._mutedBySystem) return;
      const ctx = this._ensureCtx();
      if (!ctx) return;

      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = vol;

      o.connect(g);
      g.connect(ctx.destination);

      const t = ctx.currentTime;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);

      o.start();
      o.stop(t + dur + 0.02);
    }

    playClick() { this._beep(520, 0.06, "triangle", 0.06); }
    playUpgrade() { this._beep(740, 0.09, "square", 0.045); }

    startMusic() {
      if (!this.musicEnabled || this._mutedBySystem) return;
      const ctx = this._ensureCtx();
      if (!ctx) return;
      if (this._musicOsc) return;

      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 196; // mellow
      g.gain.value = 0.015;

      // tiny LFO for vibe
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.25;
      lfoG.gain.value = 18;
      lfo.connect(lfoG);
      lfoG.connect(o.frequency);

      o.connect(g);
      g.connect(ctx.destination);

      o.start();
      lfo.start();

      this._musicOsc = { o, lfo };
      this._musicGain = g;
    }

    stopMusic() {
      if (!this._musicOsc) return;
      try { this._musicOsc.o.stop(); } catch (_) {}
      try { this._musicOsc.lfo.stop(); } catch (_) {}
      this._musicOsc = null;
      this._musicGain = null;
    }
  }

  /* =========================
     Save Manager
  ========================= */
  class SaveManager {
    constructor(game) {
      this.game = game;
      this.key = "be_idle_save_v1";
      this._debounceTimer = null;
    }

    loadLocal() {
      try {
        const s = localStorage.getItem(this.key);
        if (!s) return null;
        return JSON.parse(s);
      } catch (_) {
        return null;
      }
    }

    saveLocal(stateObj) {
      try {
        localStorage.setItem(this.key, JSON.stringify(stateObj));
        return true;
      } catch (_) {
        return false;
      }
    }

    async cloudLoad() {
      try { return await window.YGSDK.cloudLoad(); }
      catch (_) { return null; }
    }

    async cloudSave(stateObj) {
      try { return await window.YGSDK.cloudSave(stateObj); }
      catch (_) { return false; }
    }

    requestSave() {
      // debounce
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this.saveNow(), 250);
    }

    async saveNow() {
      const data = this.game.exportState();
      this.saveLocal(data);

      // cloud if auth
      if (window.YGSDK && window.YGSDK.isAuthenticated && window.YGSDK.isAuthenticated()) {
        await this.cloudSave(data);
      }
    }
  }

  /* =========================
     Ads Manager
  ========================= */
  class AdsManager {
    constructor(game) {
      this.game = game;
      this.lastInterstitialAt = 0;
      this.cooldownMs = 90_000;
    }

    async showInterstitial(reason) {
      const t = now();
      if (t - this.lastInterstitialAt < this.cooldownMs) return false;

      this.lastInterstitialAt = t;
      await this._withAdPause(async () => {
        await window.YGSDK.showInterstitial();
      });
      return true;
    }

    async showRewarded(onReward) {
      let rewarded = false;
      await this._withAdPause(async () => {
        const res = await window.YGSDK.showRewarded();
        rewarded = !!(res && res.rewarded);
      });

      if (rewarded && typeof onReward === "function") {
        onReward();
      }
      return rewarded;
    }

    async _withAdPause(fn) {
      this.game.pause("ad");
      this.game.audio.stopAllOnPause();
      try {
        await fn();
      } finally {
        this.game.audio.resumeAllOnFocus();
        this.game.resume("ad");
      }
    }
  }

  /* =========================
     UI Manager
  ========================= */
  class UIManager {
    constructor(game) {
      this.game = game;

      this.moneyValue = document.getElementById("moneyValue");
      this.fx = document.getElementById("fxLayer");

      this.screens = {
        click: document.getElementById("screen-click"),
        business: document.getElementById("screen-business"),
        shop: document.getElementById("screen-shop"),
        rewards: document.getElementById("screen-rewards"),
        settings: document.getElementById("screen-settings")
      };

      this.tabs = Array.from(document.querySelectorAll(".tabbar .tab"));

      this.bigCoinBtn = document.getElementById("bigCoinBtn");

      // upgrades UI
      this.lvlIncome = document.getElementById("lvl-income");
      this.lvlBoost = document.getElementById("lvl-boost");
      this.lvlAuto = document.getElementById("lvl-auto");

      this.btnIncome = document.getElementById("btn-income");
      this.btnBoost = document.getElementById("btn-boost");
      this.btnAuto = document.getElementById("btn-auto");

      // business UI
      this.progressFill = document.getElementById("progressFill");
      this.progressLabel = document.getElementById("progressLabel");
      this.bizUpgradeBtn = document.getElementById("bizUpgradeBtn");
      this.pill1 = document.getElementById("pill1");
      this.pill2 = document.getElementById("pill2");
      this.pill3 = document.getElementById("pill3");
      this.skyCoins = document.getElementById("bizSkyCoins");

      // stats UI
      this.statClicks = document.getElementById("statClicks");
      this.statIPS = document.getElementById("statIPS");
      this.statCV = document.getElementById("statCV");
      this.statPT = document.getElementById("statPT");
      this.statBL = document.getElementById("statBL");

      // rewards
      this.btnRewardBoost = document.getElementById("btnRewardBoost");
      this.rewardSub = document.getElementById("rewardSub");
      this.btnShowOfflineInfo = document.getElementById("btnShowOfflineInfo");

      // settings
      this.toggleSound = document.getElementById("toggleSound");
      this.toggleMusic = document.getElementById("toggleMusic");
      this.toggleLang = document.getElementById("toggleLang");
      this.btnAuth = document.getElementById("btnAuth");
      this.authStatus = document.getElementById("authStatus");

      // modal
      this.modalRoot = document.getElementById("modalRoot");
      this.modalTitle = document.getElementById("modalTitle");
      this.modalBody = document.getElementById("modalBody");
      this.modalClose = document.getElementById("modalClose");
      this.modalAction = document.getElementById("modalAction");

      // shop buy buttons
      this.buyBtns = [
        document.getElementById("buy1"),
        document.getElementById("buy2"),
        document.getElementById("buy3"),
        document.getElementById("buy4"),
        document.getElementById("buy5"),
      ];
      this.shopPrices = [
        document.getElementById("shopPrice1"),
        document.getElementById("shopPrice2"),
        document.getElementById("shopPrice3"),
        document.getElementById("shopPrice4"),
        document.getElementById("shopPrice5"),
      ];

      this._bind();
    }

    _bind() {
      // tabs
      this.tabs.forEach(btn => {
        btn.addEventListener("click", () => {
          const screen = btn.getAttribute("data-screen");
          this.game.setScreen(screen);
        });
      });

      // big coin
      const press = () => this.bigCoinBtn.classList.add("pressed");
      const release = () => this.bigCoinBtn.classList.remove("pressed");

      this.bigCoinBtn.addEventListener("pointerdown", () => { press(); });
      this.bigCoinBtn.addEventListener("pointerup", () => { release(); });
      this.bigCoinBtn.addEventListener("pointercancel", () => { release(); });
      this.bigCoinBtn.addEventListener("click", (e) => {
        // ensure audio can start on first user gesture
        this.game.audio.resumeIfNeeded();
        this.game.onTapCoin(e);
      });

      // upgrades
      this.btnIncome.addEventListener("click", () => this.game.buyUpgrade("income"));
      this.btnBoost.addEventListener("click", () => this.game.buyUpgrade("boost"));
      this.btnAuto.addEventListener("click", () => this.game.buyUpgrade("auto"));

      // business upgrade
      this.bizUpgradeBtn.addEventListener("click", () => this.game.upgradeBusiness());

      // rewards
      this.btnRewardBoost.addEventListener("click", () => this.game.rewardBoost());
      this.btnShowOfflineInfo.addEventListener("click", () => {
        this.showModal(
          this.game.t("modal_info_title"),
          this.game.t("modal_info_body"),
          { actionText: this.game.t("modal_ok"), onAction: () => this.hideModal() }
        );
      });

      // settings toggles
      this.toggleSound.addEventListener("click", () => this.game.toggleSound());
      this.toggleMusic.addEventListener("click", () => this.game.toggleMusic());
      this.toggleLang.addEventListener("click", () => this.game.toggleLang());

      // auth
      this.btnAuth.addEventListener("click", () => this.game.requestAuth());

      // modal buttons
      this.modalClose.addEventListener("click", () => this.hideModal());
      this.modalAction.addEventListener("click", () => {
        const fn = this.modalAction._onAction;
        if (typeof fn === "function") fn();
      });
    }

    applyI18n(lang) {
      document.documentElement.lang = (lang === "ru" ? "ru" : "en");
      document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        const text = this.game.t(key);
        if (text != null) el.textContent = text;
      });
    }

    setActiveTab(screen) {
      this.tabs.forEach(t => t.classList.remove("active"));
      const btn = this.tabs.find(b => (b.getAttribute("data-screen") === screen));
      if (btn) btn.classList.add("active");
    }

    switchScreen(screen) {
      Object.keys(this.screens).forEach(k => {
        this.screens[k].classList.toggle("active", k === screen);
      });
      this.setActiveTab(screen);
    }

    updateMoneyBar() {
      this.moneyValue.textContent = formatInt(this.game.state.money, this.game.state.lang);
    }

    updateUpgradeCards() {
      const s = this.game.state;
      this.lvlIncome.textContent = `Lv. ${s.upgradeLevels.income}`;
      this.lvlBoost.textContent = `Lv. ${s.upgradeLevels.boost}`;
      this.lvlAuto.textContent = `Lv. ${s.upgradeLevels.auto}`;

      this.btnIncome.disabled = s.money < this.game.getUpgradeCost("income");
      this.btnBoost.disabled = s.money < this.game.getUpgradeCost("boost");
      this.btnAuto.disabled = s.money < this.game.getUpgradeCost("auto");

      // show costs subtly in title attribute
      this.btnIncome.title = `${humanPrice(this.game.getUpgradeCost("income"))}`;
      this.btnBoost.title = `${humanPrice(this.game.getUpgradeCost("boost"))}`;
      this.btnAuto.title = `${humanPrice(this.game.getUpgradeCost("auto"))}`;
    }

    updateBusinessProgress() {
      const s = this.game.state;
      const pct = (s.businessProgressGoal > 0) ? (s.businessProgress / s.businessProgressGoal) : 0;
      this.progressFill.style.width = `${clamp(pct, 0, 1) * 100}%`;
      this.progressLabel.textContent = `${formatInt(s.businessProgress, s.lang)}/${formatInt(s.businessProgressGoal, s.lang)}`;

      // stage pills like reference (Lv1->Lv5->Lv10)
      const bl = s.businessLevel;
      this.pill1.classList.toggle("active", bl < 5);
      this.pill2.classList.toggle("active", bl >= 5 && bl < 10);
      this.pill3.classList.toggle("active", bl >= 10);

      // buildings: simple emphasis by opacity per level
      const shop = document.getElementById("bldShop");
      const inc = document.getElementById("bldInc");
      const corp = document.getElementById("bldCorp");
      shop.style.opacity = (bl < 5) ? "1" : "0.75";
      inc.style.opacity = (bl >= 5 && bl < 10) ? "1" : "0.75";
      corp.style.opacity = (bl >= 10) ? "1" : "0.75";
    }

    updateStats() {
      const s = this.game.state;
      this.statClicks.textContent = formatInt(s.totalClicks, s.lang);
      this.statIPS.textContent = formatInt(this.game.getIncomePerSecondEffective(), s.lang);
      this.statCV.textContent = formatInt(this.game.getClickValueEffective(), s.lang);
      this.statPT.textContent = formatTimeMMSS(s.playTimeSeconds);
      this.statBL.textContent = String(s.businessLevel);
    }

    updateRewards() {
      const s = this.game.state;
      if (s.rewardBoostActive) {
        const left = Math.max(0, Math.floor((s.rewardBoostEndTime - now()) / 1000));
        this.rewardSub.textContent = `x2: ${formatTimeMMSS(left)}`;
        this.btnRewardBoost.disabled = true;
      } else {
        this.rewardSub.textContent = `x2: 0:00`;
        this.btnRewardBoost.disabled = false;
      }
    }

    updateSettings() {
      const s = this.game.state;
      // sound
      this.toggleSound.textContent = s.audioEnabled ? "ON" : "OFF";
      this.toggleSound.classList.toggle("off", !s.audioEnabled);

      // music
      this.toggleMusic.textContent = s.musicEnabled ? "ON" : "OFF";
      this.toggleMusic.classList.toggle("off", !s.musicEnabled);

      // lang
      this.toggleLang.textContent = (s.lang || "en").toUpperCase();

      // auth status
      if (window.YGSDK && window.YGSDK.isAuthenticated && window.YGSDK.isAuthenticated()) {
        this.authStatus.textContent = this.game.t("signed");
      } else {
        this.authStatus.textContent = this.game.t("guest");
      }
    }

    updateShop() {
      const costs = this.game.getShopCosts();
      for (let i = 0; i < 5; i++) {
        this.shopPrices[i].textContent = humanPrice(costs[i]);
        this.buyBtns[i].disabled = this.game.state.money < costs[i];
      }
    }

    updateAll() {
      this.updateMoneyBar();
      this.updateUpgradeCards();
      this.updateBusinessProgress();
      this.updateStats();
      this.updateRewards();
      this.updateSettings();
      this.updateShop();
    }

    spawnCoinBurst(x, y, amount = 6) {
      for (let i = 0; i < amount; i++) {
        const el = document.createElement("div");
        el.className = "fxCoin";
        const dx = rand(-120, 120);
        const dy = rand(-160, -40);
        el.style.setProperty("--dx", `${dx}px`);
        el.style.setProperty("--dy", `${dy}px`);
        el.style.left = `${x - 22 + rand(-12, 12)}px`;
        el.style.top = `${y - 22 + rand(-12, 12)}px`;
        this.fx.appendChild(el);
        setTimeout(() => el.remove(), 800);
      }
    }

    spawnPopText(x, y, text) {
      const el = document.createElement("div");
      el.className = "fxPop";
      el.textContent = text;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      this.fx.appendChild(el);
      setTimeout(() => el.remove(), 900);
    }

    // ambient coins on business screen
    spawnSkyCoin() {
      const coin = document.createElement("div");
      coin.className = "fxCoin";
      coin.style.width = "38px";
      coin.style.height = "38px";

      const startX = rand(-40, 470);
      const startY = rand(0, 140);

      coin.style.left = `${startX}px`;
      coin.style.top = `${startY}px`;

      const dx = rand(-60, 60);
      const dy = rand(40, 140);
      coin.style.setProperty("--dx", `${dx}px`);
      coin.style.setProperty("--dy", `${dy}px`);
      coin.style.animationDuration = "1200ms";
      this.skyCoins.appendChild(coin);
      setTimeout(() => coin.remove(), 1400);
    }

    showModal(title, body, opts = {}) {
      this.modalRoot.classList.remove("hidden");
      this.modalRoot.setAttribute("aria-hidden", "false");
      this.modalTitle.textContent = title;
      this.modalBody.textContent = body;

      // action button
      const actionText = opts.actionText || this.game.t("modal_ok") || "OK";
      this.modalAction.textContent = actionText;
      this.modalAction._onAction = (opts.onAction || (() => this.hideModal()));

      if (opts.hideAction) {
        this.modalAction.style.display = "none";
      } else {
        this.modalAction.style.display = "inline-flex";
      }
    }

    hideModal() {
      this.modalRoot.classList.add("hidden");
      this.modalRoot.setAttribute("aria-hidden", "true");
      this.modalAction._onAction = null;
    }
  }

  /* =========================
     Game
  ========================= */
  class Game {
    constructor() {
      this.state = this._defaultState();
      this.audio = new AudioManager();
      this.save = new SaveManager(this);
      this.ads = new AdsManager(this);
      this.ui = null;

      this._paused = false;
      this._pauseReasons = new Set();

      this._lastFrameAt = now();
      this._accumSaveTime = 0;

      // progression config
      this._businessMaxLevel = 20; // 15–20+ levels requirement
      this._interstitialEveryLevels = 3;

      // for interstitial when entering business screen
      this._enteredBusinessAt = 0;

      // bind
      this._onVisibility = this._onVisibility.bind(this);
      this._onBlur = this._onBlur.bind(this);
      this._onFocus = this._onFocus.bind(this);
      this._onResize = this._onResize.bind(this);
      this._tick = this._tick.bind(this);
    }

    _defaultState() {
      return {
        money: 0,
        clickValue: 1,
        incomePerSecond: 1,

        upgradeLevels: { income: 1, boost: 1, auto: 1 },

        totalClicks: 0,
        playTimeSeconds: 0,

        businessLevel: 1,
        businessProgress: 0,
        businessProgressGoal: 200, // fast first minute

        activeScreen: "click",

        audioEnabled: true,
        musicEnabled: false,
        lang: "en",

        rewardBoostActive: false,
        rewardBoostEndTime: 0,

        // save timestamps
        lastSaveTimestamp: 0,
        lastExitTimestamp: now(),

        // shop purchases count
        shopBuys: [0, 0, 0, 0, 0]
      };
    }

    t(key) {
      const lang = (this.state.lang === "ru") ? "ru" : "en";
      return (I18N[lang] && I18N[lang][key]) != null ? I18N[lang][key] : key;
    }

    async init() {
      // Prevent context menu
      document.addEventListener("contextmenu", (e) => e.preventDefault());

      // prevent scroll / swipe refresh
      document.addEventListener("touchmove", (e) => {
        // do not block inside inputs (none used)
        e.preventDefault();
      }, { passive: false });

      // SDK init
      await window.YGSDK.initSDK();

      // language auto from SDK
      const autoLang = window.YGSDK.getLang();
      this.state.lang = autoLang;

      // load local save first (guest)
      const local = this.save.loadLocal();
      if (local) this.importState(local);

      // if already auth (rare), try cloud override (we still follow explicit auth rule for login; so no auto auth)
      // -> no auto cloud load without auth.

      // apply audio flags
      this.audio.setEnabled(this.state.audioEnabled);
      this.audio.setMusicEnabled(this.state.musicEnabled);

      // UI
      this.ui = new UIManager(this);
      this.ui.applyI18n(this.state.lang);
      this.ui.switchScreen(this.state.activeScreen);
      this.ui.updateAll();

      // SDK pause/resume hooks (platform)
      window.YGSDK.onPause(() => this.pause("sdk"));
      window.YGSDK.onResume(() => this.resume("sdk"));

      // browser pause/resume
      document.addEventListener("visibilitychange", this._onVisibility);
      window.addEventListener("blur", this._onBlur);
      window.addEventListener("focus", this._onFocus);

      // resize & scale
      window.addEventListener("resize", this._onResize);
      this._onResize();

      // offline income
      this._applyOfflineIncome();

      // Start gameplay API once playable
      window.YGSDK.ready();
      window.YGSDK.gameplayStart();

      // start loop
      this._lastFrameAt = now();
      requestAnimationFrame(this._tick);
    }

    exportState() {
      // keep only safe JSON
      return {
        money: this.state.money,
        clickValue: this.state.clickValue,
        incomePerSecond: this.state.incomePerSecond,
        upgradeLevels: { ...this.state.upgradeLevels },
        totalClicks: this.state.totalClicks,
        playTimeSeconds: this.state.playTimeSeconds,
        businessLevel: this.state.businessLevel,
        businessProgress: this.state.businessProgress,
        businessProgressGoal: this.state.businessProgressGoal,
        activeScreen: this.state.activeScreen,
        audioEnabled: this.state.audioEnabled,
        musicEnabled: this.state.musicEnabled,
        lang: this.state.lang,
        rewardBoostActive: this.state.rewardBoostActive,
        rewardBoostEndTime: this.state.rewardBoostEndTime,
        lastSaveTimestamp: now(),
        lastExitTimestamp: now(),
        shopBuys: [...this.state.shopBuys]
      };
    }

    importState(d) {
      try {
        // minimal validation
        if (!d || typeof d !== "object") return;

        const s = this.state;
        s.money = Number(d.money || 0);
        s.clickValue = Number(d.clickValue || 1);
        s.incomePerSecond = Number(d.incomePerSecond || 1);

        if (d.upgradeLevels) {
          s.upgradeLevels.income = Number(d.upgradeLevels.income || 1);
          s.upgradeLevels.boost = Number(d.upgradeLevels.boost || 1);
          s.upgradeLevels.auto = Number(d.upgradeLevels.auto || 1);
        }

        s.totalClicks = Number(d.totalClicks || 0);
        s.playTimeSeconds = Number(d.playTimeSeconds || 0);

        s.businessLevel = Number(d.businessLevel || 1);
        s.businessProgress = Number(d.businessProgress || 0);
        s.businessProgressGoal = Number(d.businessProgressGoal || 200);

        s.activeScreen = (d.activeScreen || "click");
        s.audioEnabled = (d.audioEnabled !== false);
        s.musicEnabled = !!d.musicEnabled;
        s.lang = (d.lang === "ru") ? "ru" : "en";

        s.rewardBoostActive = !!d.rewardBoostActive;
        s.rewardBoostEndTime = Number(d.rewardBoostEndTime || 0);

        s.lastExitTimestamp = Number(d.lastExitTimestamp || now());
        s.shopBuys = Array.isArray(d.shopBuys) ? d.shopBuys.slice(0, 5).map(x => Number(x || 0)) : [0,0,0,0,0];

        // clamp
        s.businessLevel = clamp(s.businessLevel, 1, this._businessMaxLevel);
        s.money = Math.max(0, s.money);
      } catch (_) {}
    }

    /* =========================
       Pause / Resume
    ========================= */
    pause(reason) {
      this._pauseReasons.add(reason || "unknown");
      this._paused = true;
    }

    resume(reason) {
      if (reason) this._pauseReasons.delete(reason);
      if (this._pauseReasons.size === 0) this._paused = false;
    }

    _onVisibility() {
      if (document.hidden) {
        this.pause("hidden");
        this.audio.stopAllOnPause();
        this._markExit();
      } else {
        this.resume("hidden");
        this.audio.resumeAllOnFocus();
        this._applyOfflineIncome(); // if tab was hidden long
      }
    }

    _onBlur() {
      this.pause("blur");
      this.audio.stopAllOnPause();
      this._markExit();
    }

    _onFocus() {
      this.resume("blur");
      this.audio.resumeAllOnFocus();
      this._applyOfflineIncome();
    }

    _markExit() {
      this.state.lastExitTimestamp = now();
      this.save.requestSave();
    }

    /* =========================
       Layout scale-to-fit
    ========================= */
    _onResize() {
      const stage = document.getElementById("stage");
      const wrap = document.getElementById("wrap");

      const vw = wrap.clientWidth;
      const vh = wrap.clientHeight;

      const sw = 470;
      const sh = 930;

      // Keep ratio <= 1:2 active field (already portrait). Scale to fit.
      const scale = Math.min(vw / sw, vh / sh);
      stage.style.transform = `scale(${scale})`;
    }

    /* =========================
       Economy / Effective values
    ========================= */
    getIncomePerSecondEffective() {
      const s = this.state;
      let ips = s.incomePerSecond;

      // Business Boost acts as multiplier
      const boostMul = 1 + (s.upgradeLevels.boost - 1) * 0.08; // +8% each
      ips *= boostMul;

      // Auto Collect adds extra passive
      const autoBonus = (s.upgradeLevels.auto - 1) * 0.6;
      ips += autoBonus;

      // Shop items give multipliers
      ips *= this._shopIncomeMultiplier();

      // Reward boost x2
      if (s.rewardBoostActive && now() < s.rewardBoostEndTime) ips *= 2;

      return Math.max(0, ips);
    }

    getClickValueEffective() {
      const s = this.state;
      let cv = s.clickValue;

      // boost increases click too
      cv *= 1 + (s.upgradeLevels.boost - 1) * 0.06;

      // shop boosts click
      cv *= this._shopClickMultiplier();

      // reward boost x2 earnings (applies to click too for stronger feel)
      if (s.rewardBoostActive && now() < s.rewardBoostEndTime) cv *= 2;

      return Math.max(1, cv);
    }

    _shopIncomeMultiplier() {
      const b = this.state.shopBuys;
      // gentle stacking, non-crazy
      return (1 + b[0]*0.10) * (1 + b[1]*0.18) * (1 + b[3]*0.30) * (1 + b[4]*0.45);
    }

    _shopClickMultiplier() {
      const b = this.state.shopBuys;
      return (1 + b[2]*0.20) * (1 + b[3]*0.12);
    }

    /* =========================
       Costs
    ========================= */
    getUpgradeCost(type) {
      const lvl = this.state.upgradeLevels[type] || 1;
      const base = (type === "income") ? 50 : (type === "boost") ? 90 : 120;
      const k = (type === "income") ? 1.45 : (type === "boost") ? 1.55 : 1.62;
      return Math.floor(base * Math.pow(k, lvl - 1));
    }

    getShopCosts() {
      // costs increase per purchase
      const buys = this.state.shopBuys;
      const bases = [100_000, 500_000, 1_500_000, 8_500_000, 35_000_000];
      const mults = [1.55, 1.65, 1.7, 1.75, 1.8];
      return bases.map((b, i) => Math.floor(b * Math.pow(mults[i], buys[i])));
    }

    /* =========================
       Actions
    ========================= */
    setScreen(screen) {
      // map: click, shop, business, rewards, settings
      if (!this.ui || !this.ui.screens[screen]) return;

      this.state.activeScreen = screen;
      this.ui.switchScreen(screen);
      this.ui.updateAll();
      this.save.requestSave();

      // Interstitial: when entering business screen (not more often than 90 sec)
      if (screen === "business") {
        const t = now();
        if (t - this._enteredBusinessAt > 90_000) {
          this._enteredBusinessAt = t;
          this.ads.showInterstitial("enter_business").catch(()=>{});
        }
      }
    }

    onTapCoin(ev) {
      if (this._paused) return;

      const cv = this.getClickValueEffective();
      this.state.money += cv;
      this.state.totalClicks += 1;

      // progress also grows from clicks
      const progAdd = 1 + Math.floor(cv * 0.08); // scales gently
      this._addBusinessProgress(progAdd);

      // fx
      const rect = document.getElementById("stage").getBoundingClientRect();
      const x = (ev.clientX - rect.left) / (rect.width / 470);
      const y = (ev.clientY - rect.top) / (rect.height / 930);
      this.ui.spawnCoinBurst(x, y, 6);
      this.ui.spawnPopText(x + 10, y - 10, `+${formatInt(cv, this.state.lang)}`);

      // sound
      this.audio.playClick();

      this.ui.updateAll();
      this.save.requestSave();
    }

    buyUpgrade(type) {
      if (this._paused) return;
      const cost = this.getUpgradeCost(type);
      if (this.state.money < cost) return;

      this.state.money -= cost;
      this.state.upgradeLevels[type] = (this.state.upgradeLevels[type] || 1) + 1;

      // apply base growth
      if (type === "income") {
        // increases base IPS
        this.state.incomePerSecond += 1 + Math.floor(this.state.upgradeLevels.income * 0.15);
      } else if (type === "boost") {
        // increases base click slightly
        this.state.clickValue += 1 + Math.floor(this.state.upgradeLevels.boost * 0.10);
      } else if (type === "auto") {
        // increases base IPS a bit
        this.state.incomePerSecond += 1 + Math.floor(this.state.upgradeLevels.auto * 0.08);
      }

      this.audio.playUpgrade();

      // small interstitial occasionally on logical breaks (optional)
      // here: do nothing; we keep interstitial on business level ups and entering business.

      this.ui.updateAll();
      this.save.requestSave();
    }

    upgradeBusiness() {
      if (this._paused) return;

      // Spend money to push progress (logical "upgrade" like in reference)
      const cost = this._businessUpgradeCost();
      if (this.state.money < cost) return;

      this.state.money -= cost;
      const push = Math.floor(40 + this.getIncomePerSecondEffective() * 0.6);
      this._addBusinessProgress(push);

      this.audio.playUpgrade();
      this.ui.updateAll();
      this.save.requestSave();
    }

    _businessUpgradeCost() {
      const bl = this.state.businessLevel;
      // early cheap, later grows
      const base = 120;
      const k = 1.52;
      return Math.floor(base * Math.pow(k, bl - 1));
    }

    async rewardBoost() {
      if (this._paused) return;

      // Rewarded video -> x2 for 3 minutes
      await this.ads.showRewarded(() => {
        this.state.rewardBoostActive = true;
        this.state.rewardBoostEndTime = now() + 180_000; // 3 min
        this.ui.updateAll();
        this.save.requestSave();
      });
    }

    buyShopItem(index) {
      if (this._paused) return;
      const costs = this.getShopCosts();
      const cost = costs[index];
      if (this.state.money < cost) return;

      this.state.money -= cost;
      this.state.shopBuys[index] += 1;

      this.audio.playUpgrade();
      this.ui.updateAll();
      this.save.requestSave();
    }

    async requestAuth() {
      // explicit action only (button)
      const ok = await window.YGSDK.authRequest();
      if (ok) {
        // load cloud save; if exists, merge by taking max of key values (safe)
        const cloud = await this.save.cloudLoad();
        if (cloud) {
          this._mergeCloud(cloud);
        }
        await this.save.saveNow();
      }
      this.ui.updateAll();
    }

    _mergeCloud(cloud) {
      // Keep progress whichever is larger (simple).
      try {
        const s = this.state;
        if (typeof cloud.money === "number") s.money = Math.max(s.money, cloud.money);
        if (cloud.upgradeLevels) {
          s.upgradeLevels.income = Math.max(s.upgradeLevels.income, cloud.upgradeLevels.income || 1);
          s.upgradeLevels.boost = Math.max(s.upgradeLevels.boost, cloud.upgradeLevels.boost || 1);
          s.upgradeLevels.auto = Math.max(s.upgradeLevels.auto, cloud.upgradeLevels.auto || 1);
        }
        s.clickValue = Math.max(s.clickValue, Number(cloud.clickValue || 1));
        s.incomePerSecond = Math.max(s.incomePerSecond, Number(cloud.incomePerSecond || 1));
        s.totalClicks = Math.max(s.totalClicks, Number(cloud.totalClicks || 0));
        s.playTimeSeconds = Math.max(s.playTimeSeconds, Number(cloud.playTimeSeconds || 0));
        s.businessLevel = Math.max(s.businessLevel, Number(cloud.businessLevel || 1));
        s.businessProgress = Math.max(s.businessProgress, Number(cloud.businessProgress || 0));
        s.businessProgressGoal = Math.max(s.businessProgressGoal, Number(cloud.businessProgressGoal || 200));

        if (Array.isArray(cloud.shopBuys)) {
          for (let i = 0; i < 5; i++) s.shopBuys[i] = Math.max(s.shopBuys[i] || 0, Number(cloud.shopBuys[i] || 0));
        }
      } catch (_) {}
    }

    toggleSound() {
      this.state.audioEnabled = !this.state.audioEnabled;
      this.audio.setEnabled(this.state.audioEnabled);
      this.ui.updateSettings();
      this.save.requestSave();
    }

    toggleMusic() {
      this.state.musicEnabled = !this.state.musicEnabled;
      this.audio.setMusicEnabled(this.state.musicEnabled);
      this.ui.updateSettings();
      this.save.requestSave();
    }

    toggleLang() {
      this.state.lang = (this.state.lang === "ru") ? "en" : "ru";
      this.ui.applyI18n(this.state.lang);
      this.ui.updateAll();
      this.save.requestSave();
    }

    /* =========================
       Business progress
    ========================= */
    _addBusinessProgress(amount) {
      const s = this.state;
      s.businessProgress += Math.floor(Math.max(0, amount));

      while (s.businessProgress >= s.businessProgressGoal) {
        s.businessProgress -= s.businessProgressGoal;
        this._levelUpBusiness();
      }
    }

    _levelUpBusiness() {
      const s = this.state;
      if (s.businessLevel >= this._businessMaxLevel) {
        // cap
        s.businessProgress = Math.min(s.businessProgress, s.businessProgressGoal);
        return;
      }
      s.businessLevel += 1;

      // raise goal to keep 10+ minutes progression
      // early quick, later tougher
      const bl = s.businessLevel;
      const growth = (bl < 6) ? 1.35 : (bl < 12) ? 1.52 : 1.70;
      s.businessProgressGoal = Math.floor(s.businessProgressGoal * growth + bl * 80);

      // reward some base scaling
      s.incomePerSecond += Math.floor(1 + bl * 0.6);
      s.clickValue += Math.floor(1 + bl * 0.2);

      // interstitial every N levels (logical break)
      if (bl % this._interstitialEveryLevels === 0) {
        this.ads.showInterstitial("biz_level").catch(()=>{});
      }
    }

    /* =========================
       Offline income
    ========================= */
    _applyOfflineIncome() {
      const s = this.state;
      const last = Number(s.lastExitTimestamp || now());
      const diffMs = Math.max(0, now() - last);

      // ignore tiny gaps
      if (diffMs < 8_000) return;

      const capMs = 2 * 60 * 60 * 1000; // 2 hours
      const used = Math.min(diffMs, capMs);
      const seconds = used / 1000;

      const earned = Math.floor(this.getIncomePerSecondEffective() * seconds);
      if (earned <= 0) return;

      // apply base offline
      s.money += earned;

      // show modal with optional double rewarded
      const body = this.t("modal_offline_body").replace("{x}", formatInt(earned, s.lang));
      this.ui.showModal(
        this.t("modal_offline_title"),
        body,
        {
          actionText: this.t("modal_offline_action"),
          onAction: async () => {
            this.ui.hideModal();
            // double via rewarded
            await this.ads.showRewarded(() => {
              s.money += earned; // add same again
              this.ui.updateAll();
              this.save.requestSave();
            });
          }
        }
      );

      // reset last exit to now to avoid repeated grants
      s.lastExitTimestamp = now();
      this.save.requestSave();
      this.ui.updateAll();
    }

    /* =========================
       Main loop
    ========================= */
    _tick() {
      const t = now();
      const dt = (t - this._lastFrameAt) / 1000;
      this._lastFrameAt = t;

      if (!this._paused) {
        // time & passive
        this.state.playTimeSeconds += dt;

        // reward boost expire
        if (this.state.rewardBoostActive && t >= this.state.rewardBoostEndTime) {
          this.state.rewardBoostActive = false;
          this.state.rewardBoostEndTime = 0;
        }

        // passive money
        const ips = this.getIncomePerSecondEffective();
        this.state.money += ips * dt;

        // progress also from passive (tycoon feel)
        const prog = Math.floor((ips * dt) * 0.22);
        if (prog > 0) this._addBusinessProgress(prog);

        // ambient coins on business screen
        if (this.state.activeScreen === "business") {
          // spawn occasionally
          if (Math.random() < 0.04) this.ui.spawnSkyCoin();
        }

        // autosave every ~10s (plus explicit saves)
        this._accumSaveTime += dt;
        if (this._accumSaveTime >= 10) {
          this._accumSaveTime = 0;
          this.save.requestSave();
        }

        this.ui.updateAll();
      }

      requestAnimationFrame(this._tick);
    }
  }

  /* =========================
     Boot
  ========================= */
  const game = new Game();
  window.__GAME__ = game;

  // Bind shop buy buttons after UI is created
  async function start() {
    await game.init();

    // hook shop buttons
    const buyIds = ["buy1", "buy2", "buy3", "buy4", "buy5"];
    buyIds.forEach((id, i) => {
      const btn = document.getElementById(id);
      btn.addEventListener("click", () => game.buyShopItem(i));
    });

    // keep lastExitTimestamp updated on unload (best-effort)
    window.addEventListener("beforeunload", () => {
      game.state.lastExitTimestamp = now();
      try { localStorage.setItem(game.save.key, JSON.stringify(game.exportState())); } catch (_) {}
      try { window.YGSDK.gameplayStop(); } catch (_) {}
    });
  }

  start().catch((e) => {
    console.error("Game init failed:", e);
  });

})();