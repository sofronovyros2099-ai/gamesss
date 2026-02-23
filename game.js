(function () {
  "use strict";

  /* ========= Helpers ========= */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => Date.now();
  const rand = (a, b) => a + Math.random() * (b - a);

  function formatIntRU(n) {
    const safe = Math.floor(Math.max(0, n));
    return safe.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  function formatTimeMMSS(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function humanPriceRU(n) {
    const v = Math.max(0, n);
    if (v >= 1e9) return (v / 1e9).toFixed(v >= 1e10 ? 0 : 1).replace(".", ",") + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(".", ",") + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(".", ",") + "K";
    return String(Math.floor(v));
  }

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  /* ========= Audio ========= */
  class AudioManager {
    constructor() {
      this.enabled = true;
      this.musicEnabled = false;
      this.ctx = null;
      this._mutedBySystem = false;
      this._musicOsc = null;
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
    playUpgrade() { this._beep(760, 0.09, "square", 0.045); }

    startMusic() {
      if (!this.musicEnabled || this._mutedBySystem) return;
      const ctx = this._ensureCtx();
      if (!ctx) return;
      if (this._musicOsc) return;

      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 196;
      g.gain.value = 0.014;

      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.22;
      lfoG.gain.value = 14;
      lfo.connect(lfoG);
      lfoG.connect(o.frequency);

      o.connect(g);
      g.connect(ctx.destination);

      o.start();
      lfo.start();

      this._musicOsc = { o, lfo, g };
    }
    stopMusic() {
      if (!this._musicOsc) return;
      try { this._musicOsc.o.stop(); } catch (_) {}
      try { this._musicOsc.lfo.stop(); } catch (_) {}
      this._musicOsc = null;
    }
  }

  /* ========= Save ========= */
  class SaveManager {
    constructor(game) {
      this.game = game;
      this.key = "be_idle_save_v2_ru";
      this._debounceTimer = null;
    }
    loadLocal() {
      try {
        const s = localStorage.getItem(this.key);
        if (!s) return null;
        return JSON.parse(s);
      } catch (_) { return null; }
    }
    saveLocal(stateObj) {
      try { localStorage.setItem(this.key, JSON.stringify(stateObj)); return true; }
      catch (_) { return false; }
    }
    async cloudLoad() { try { return await window.YGSDK.cloudLoad(); } catch (_) { return null; } }
    async cloudSave(stateObj) { try { return await window.YGSDK.cloudSave(stateObj); } catch (_) { return false; } }
    requestSave() {
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this.saveNow(), 250);
    }
    async saveNow() {
      const data = this.game.exportState();
      this.saveLocal(data);
      if (window.YGSDK && window.YGSDK.isAuthenticated && window.YGSDK.isAuthenticated()) {
        await this.cloudSave(data);
      }
    }
  }

  /* ========= Ads ========= */
  class AdsManager {
    constructor(game) {
      this.game = game;
      this.lastInterstitialAt = 0;
      this.cooldownMs = 90_000;
    }
    async showInterstitial() {
      const t = now();
      if (t - this.lastInterstitialAt < this.cooldownMs) return false;
      this.lastInterstitialAt = t;

      await this._withAdPause(async () => { await window.YGSDK.showInterstitial(); });
      return true;
    }
    async showRewarded(onReward) {
      let rewarded = false;
      await this._withAdPause(async () => {
        const res = await window.YGSDK.showRewarded();
        rewarded = !!(res && res.rewarded);
      });
      if (rewarded && typeof onReward === "function") onReward();
      return rewarded;
    }
    async _withAdPause(fn) {
      this.game.pause("ad");
      this.game.audio.stopAllOnPause();
      try { await fn(); }
      finally {
        this.game.audio.resumeAllOnFocus();
        this.game.resume("ad");
      }
    }
  }

  /* ========= FX (живые монеты) ========= */
  class FXSystem {
    constructor(stage, fxLayer, getMoneyTarget) {
      this.stage = stage;
      this.layer = fxLayer;
      this.getMoneyTarget = getMoneyTarget;

      this.coins = []; // {el, t, life, x,y, vx,vy, rot, vr, mode, ax,ay, targetX,targetY, c1x,c1y,c2x,c2y}
      this.pops = [];  // {el, t, life, x,y}
      this.maxCoins = 60;
    }

    stagePointFromClient(clientX, clientY) {
      const rect = this.stage.getBoundingClientRect();
      const sx = 470, sy = 930;
      const x = (clientX - rect.left) / (rect.width / sx);
      const y = (clientY - rect.top) / (rect.height / sy);
      return { x, y };
    }

    spawnPop(x, y, text) {
      const el = document.createElement("div");
      el.className = "fxPop";
      el.textContent = text;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      this.layer.appendChild(el);
      this.pops.push({ el, t: 0, life: 0.85, x, y });
      if (this.pops.length > 16) {
        const p = this.pops.shift();
        p.el.remove();
      }
    }

    // “дугой” в moneybar + вращение
    spawnCoinArcToMoney(x, y, count) {
      const target = this.getMoneyTarget(); // stage coords
      for (let i = 0; i < count; i++) {
        if (this.coins.length >= this.maxCoins) {
          const c = this.coins.shift();
          c.el.remove();
        }
        const el = document.createElement("div");
        el.className = "fxCoin";
        this.layer.appendChild(el);

        const startX = x + rand(-14, 14);
        const startY = y + rand(-10, 10);

        // bezier control points to create nice arc
        const c1x = startX + rand(-80, 80);
        const c1y = startY + rand(-160, -60);
        const c2x = (target.x + startX) / 2 + rand(-90, 90);
        const c2y = (target.y + startY) / 2 + rand(-120, -40);

        const life = rand(0.55, 0.75);

        this.coins.push({
          el, t: 0, life,
          mode: "bezier",
          x: startX, y: startY,
          rot: rand(0, Math.PI * 2),
          vr: rand(-10, 10),
          targetX: target.x + rand(-10, 10),
          targetY: target.y + rand(-6, 6),
          c1x, c1y, c2x, c2y
        });
      }
    }

    // монеты “в воздухе” (параболы) для business screen
    spawnAmbientCoin() {
      if (this.coins.length >= this.maxCoins) return;
      const el = document.createElement("div");
      el.className = "fxCoin";
      el.style.width = "36px";
      el.style.height = "36px";
      this.layer.appendChild(el);

      const x = rand(-20, 490);
      const y = rand(120, 360);
      const vx = rand(-35, 35);
      const vy = rand(-110, -60);
      const life = rand(1.2, 1.6);

      this.coins.push({
        el, t: 0, life,
        mode: "physics",
        x, y, vx, vy,
        ax: 0,
        ay: 220, // gravity
        rot: rand(0, Math.PI * 2),
        vr: rand(-6, 6)
      });
    }

    update(dt) {
      // pops
      for (let i = this.pops.length - 1; i >= 0; i--) {
        const p = this.pops[i];
        p.t += dt;
        const k = clamp(p.t / p.life, 0, 1);
        const y = p.y - 70 * k;
        const s = 0.92 + 0.12 * Math.sin(k * Math.PI);
        const a = 1 - k;
        p.el.style.transform = `translate(${0}px, ${y - p.y}px) scale(${s})`;
        p.el.style.opacity = `${a}`;
        if (p.t >= p.life) {
          p.el.remove();
          this.pops.splice(i, 1);
        }
      }

      // coins
      for (let i = this.coins.length - 1; i >= 0; i--) {
        const c = this.coins[i];
        c.t += dt;
        const k = clamp(c.t / c.life, 0, 1);

        if (c.mode === "bezier") {
          // cubic bezier
          const x = cubicBezier(c.x, c.c1x, c.c2x, c.targetX, k);
          const y = cubicBezier(c.y, c.c1y, c.c2y, c.targetY, k);
          c.rot += c.vr * dt;

          const scale = 0.85 + 0.35 * (1 - Math.abs(0.5 - k) * 2); // slightly bigger mid
          const alpha = 1 - k;
          c.el.style.left = `${x}px`;
          c.el.style.top = `${y}px`;
          c.el.style.transform = `rotate(${c.rot}rad) scale(${scale})`;
          c.el.style.opacity = `${alpha}`;
        } else {
          // physics
          c.vx += (c.ax || 0) * dt;
          c.vy += (c.ay || 0) * dt;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          c.rot += c.vr * dt;

          const alpha = 1 - k;
          const scale = 0.95 + 0.05 * Math.sin(k * Math.PI);
          c.el.style.left = `${c.x}px`;
          c.el.style.top = `${c.y}px`;
          c.el.style.transform = `rotate(${c.rot}rad) scale(${scale})`;
          c.el.style.opacity = `${alpha}`;
        }

        if (c.t >= c.life) {
          c.el.remove();
          this.coins.splice(i, 1);
        }
      }
    }
  }

  function cubicBezier(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return (u*u*u)*p0 + 3*(u*u)*t*p1 + 3*u*(t*t)*p2 + (t*t*t)*p3;
  }

  /* ========= UI ========= */
  class UIManager {
    constructor(game) {
      this.game = game;

      this.stage = document.getElementById("stage");
      this.fxLayer = document.getElementById("fxLayer");

      this.moneyValue = document.getElementById("moneyValue");
      this.bigCoinBtn = document.getElementById("bigCoinBtn");

      // screens
      this.screens = {
        click: document.getElementById("screen-click"),
        business: document.getElementById("screen-business"),
        shop: document.getElementById("screen-shop"),
        rewards: document.getElementById("screen-rewards"),
        settings: document.getElementById("screen-settings")
      };

      this.tabs = Array.from(document.querySelectorAll(".tabbar .tab"));

      // upgrade
      this.lvlIncome = document.getElementById("lvl-income");
      this.lvlBoost = document.getElementById("lvl-boost");
      this.lvlAuto = document.getElementById("lvl-auto");
      this.costIncome = document.getElementById("cost-income");
      this.costBoost = document.getElementById("cost-boost");
      this.costAuto = document.getElementById("cost-auto");

      this.btnIncome = document.getElementById("btn-income");
      this.btnBoost = document.getElementById("btn-boost");
      this.btnAuto = document.getElementById("btn-auto");

      // business
      this.progressFill = document.getElementById("progressFill");
      this.progressLabel = document.getElementById("progressLabel");
      this.bizUpgradeBtn = document.getElementById("bizUpgradeBtn");
      this.pill1 = document.getElementById("pill1");
      this.pill2 = document.getElementById("pill2");
      this.pill3 = document.getElementById("pill3");

      // stats
      this.statClicks = document.getElementById("statClicks");
      this.statIPS = document.getElementById("statIPS");
      this.statCV = document.getElementById("statCV");
      this.statPT = document.getElementById("statPT");
      this.statBL = document.getElementById("statBL");

      // rewards
      this.btnRewardBoost = document.getElementById("btnRewardBoost");
      this.rewardSub = document.getElementById("rewardSub");
      this.btnShowOfflineInfo = document.getElementById("btnShowOfflineInfo");

      // daily
      this.btnDaily = document.getElementById("btnDaily");
      this.dailySub = document.getElementById("dailySub");

      // settings
      this.toggleSound = document.getElementById("toggleSound");
      this.toggleMusic = document.getElementById("toggleMusic");
      this.btnAuth = document.getElementById("btnAuth");
      this.authStatus = document.getElementById("authStatus");

      // modal
      this.modalRoot = document.getElementById("modalRoot");
      this.modalTitle = document.getElementById("modalTitle");
      this.modalBody = document.getElementById("modalBody");
      this.modalClose = document.getElementById("modalClose");
      this.modalAction = document.getElementById("modalAction");

      // shop
      this.buyBtns = [
        document.getElementById("buy1"),
        document.getElementById("buy2"),
        document.getElementById("buy3"),
        document.getElementById("buy4"),
        document.getElementById("buy5")
      ];
      this.shopPrices = [
        document.getElementById("shopPrice1"),
        document.getElementById("shopPrice2"),
        document.getElementById("shopPrice3"),
        document.getElementById("shopPrice4"),
        document.getElementById("shopPrice5")
      ];

      // FX system (target is coin badge in moneybar)
      this.fx = new FXSystem(this.stage, this.fxLayer, () => this.getMoneyTargetPoint());

      this._bind();
    }

    getMoneyTargetPoint() {
      const stageRect = this.stage.getBoundingClientRect();
      const badge = document.querySelector(".coinBadge");
      const b = badge.getBoundingClientRect();

      // convert to stage coords
      const sx = 470, sy = 930;
      const x = ((b.left + b.width * 0.55) - stageRect.left) / (stageRect.width / sx);
      const y = ((b.top + b.height * 0.50) - stageRect.top) / (stageRect.height / sy);
      return { x, y };
    }

    _bind() {
      // tabs
      this.tabs.forEach(btn => {
        btn.addEventListener("click", () => {
          const screen = btn.getAttribute("data-screen");
          this.game.setScreen(screen);
        });
      });

      // disable context menu
      document.addEventListener("contextmenu", e => e.preventDefault());

      // big coin press anim
      const press = () => this.bigCoinBtn.classList.add("pressed");
      const release = () => this.bigCoinBtn.classList.remove("pressed");
      this.bigCoinBtn.addEventListener("pointerdown", press);
      this.bigCoinBtn.addEventListener("pointerup", release);
      this.bigCoinBtn.addEventListener("pointercancel", release);

      this.bigCoinBtn.addEventListener("click", (e) => {
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
          "Офлайн доход",
          "Офлайн доход начисляется при входе, максимум за 2 часа.",
          { actionText: "OK", onAction: () => this.hideModal() }
        );
      });

      // daily
      this.btnDaily.addEventListener("click", () => this.game.claimDailyReward());

      // settings
      this.toggleSound.addEventListener("click", () => this.game.toggleSound());
      this.toggleMusic.addEventListener("click", () => this.game.toggleMusic());
      this.btnAuth.addEventListener("click", () => this.game.requestAuth());

      // modal
      this.modalClose.addEventListener("click", () => this.hideModal());
      this.modalAction.addEventListener("click", () => {
        const fn = this.modalAction._onAction;
        if (typeof fn === "function") fn();
      });
    }

    switchScreen(screen) {
      Object.keys(this.screens).forEach(k => {
        this.screens[k].classList.toggle("active", k === screen);
      });
      this.tabs.forEach(t => t.classList.remove("active"));
      const btn = this.tabs.find(b => b.getAttribute("data-screen") === screen);
      if (btn) btn.classList.add("active");
    }

    updateMoneyBar() {
      this.moneyValue.textContent = formatIntRU(this.game.state.money);
    }

    updateUpgradeCards() {
      const s = this.game.state;

      const ci = this.game.getUpgradeCost("income");
      const cb = this.game.getUpgradeCost("boost");
      const ca = this.game.getUpgradeCost("auto");

      this.lvlIncome.textContent = `Ур. ${s.upgradeLevels.income}`;
      this.lvlBoost.textContent = `Ур. ${s.upgradeLevels.boost}`;
      this.lvlAuto.textContent = `Ур. ${s.upgradeLevels.auto}`;

      this.costIncome.textContent = `Цена: ${humanPriceRU(ci)}`;
      this.costBoost.textContent = `Цена: ${humanPriceRU(cb)}`;
      this.costAuto.textContent = `Цена: ${humanPriceRU(ca)}`;

      this.btnIncome.disabled = s.money < ci;
      this.btnBoost.disabled = s.money < cb;
      this.btnAuto.disabled = s.money < ca;
    }

    updateBusinessProgress() {
      const s = this.game.state;
      const pct = s.businessProgressGoal > 0 ? (s.businessProgress / s.businessProgressGoal) : 0;
      this.progressFill.style.width = `${clamp(pct, 0, 1) * 100}%`;
      this.progressLabel.textContent = `${formatIntRU(s.businessProgress)}/${formatIntRU(s.businessProgressGoal)}`;

      const bl = s.businessLevel;
      this.pill1.classList.toggle("active", bl < 5);
      this.pill2.classList.toggle("active", bl >= 5 && bl < 10);
      this.pill3.classList.toggle("active", bl >= 10);

      const shop = document.getElementById("bldShop");
      const inc = document.getElementById("bldInc");
      const corp = document.getElementById("bldCorp");
      shop.style.opacity = (bl < 5) ? "1" : "0.78";
      inc.style.opacity = (bl >= 5 && bl < 10) ? "1" : "0.78";
      corp.style.opacity = (bl >= 10) ? "1" : "0.78";
    }

    updateStats() {
      const s = this.game.state;
      this.statClicks.textContent = formatIntRU(s.totalClicks);
      this.statIPS.textContent = formatIntRU(this.game.getIncomePerSecondEffective());
      this.statCV.textContent = formatIntRU(this.game.getClickValueEffective());
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

      const canDaily = this.game.isDailyAvailable();
      this.dailySub.textContent = canDaily ? "Доступно: да" : "Доступно: завтра";
      this.btnDaily.disabled = !canDaily;
    }

    updateSettings() {
      const s = this.game.state;

      this.toggleSound.textContent = s.audioEnabled ? "ON" : "OFF";
      this.toggleSound.classList.toggle("off", !s.audioEnabled);

      this.toggleMusic.textContent = s.musicEnabled ? "ON" : "OFF";
      this.toggleMusic.classList.toggle("off", !s.musicEnabled);

      if (window.YGSDK && window.YGSDK.isAuthenticated && window.YGSDK.isAuthenticated()) {
        this.authStatus.textContent = "Вход выполнен";
      } else {
        this.authStatus.textContent = "Гость";
      }
    }

    updateShop() {
      const costs = this.game.getShopCosts();
      for (let i = 0; i < 5; i++) {
        this.shopPrices[i].textContent = humanPriceRU(costs[i]);
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

    showModal(title, body, opts = {}) {
      this.modalRoot.classList.remove("hidden");
      this.modalRoot.setAttribute("aria-hidden", "false");
      this.modalTitle.textContent = title;
      this.modalBody.textContent = body;

      const actionText = opts.actionText || "OK";
      this.modalAction.textContent = actionText;
      this.modalAction._onAction = (opts.onAction || (() => this.hideModal()));

      this.modalAction.style.display = opts.hideAction ? "none" : "inline-flex";
    }

    hideModal() {
      this.modalRoot.classList.add("hidden");
      this.modalRoot.setAttribute("aria-hidden", "true");
      this.modalAction._onAction = null;
    }
  }

  /* ========= Game ========= */
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

      this._businessMaxLevel = 20;
      this._interstitialEveryLevels = 3;

      this._enteredBusinessAt = 0;

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
        businessProgressGoal: 180, // чуть быстрее старт, как реф

        activeScreen: "click",

        audioEnabled: true,
        musicEnabled: false,

        rewardBoostActive: false,
        rewardBoostEndTime: 0,

        lastExitTimestamp: now(),

        shopBuys: [0, 0, 0, 0, 0],

        // Daily reward
        dailyLastClaim: "",   // "YYYY-MM-DD"
        dailyStreak: 0
      };
    }

    async init() {
      // no scroll / no swipe refresh
      document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
      document.addEventListener("contextmenu", (e) => e.preventDefault());

      await window.YGSDK.initSDK();

      // load guest save
      const local = this.save.loadLocal();
      if (local) this.importState(local);

      this.audio.setEnabled(this.state.audioEnabled);
      this.audio.setMusicEnabled(this.state.musicEnabled);

      this.ui = new UIManager(this);

      // SDK pause/resume
      window.YGSDK.onPause(() => this.pause("sdk"));
      window.YGSDK.onResume(() => this.resume("sdk"));

      // browser pause/resume
      document.addEventListener("visibilitychange", this._onVisibility);
      window.addEventListener("blur", this._onBlur);
      window.addEventListener("focus", this._onFocus);

      // resize & scale
      window.addEventListener("resize", this._onResize);
      this._onResize();

      // bind shop buy buttons
      const buyIds = ["buy1", "buy2", "buy3", "buy4", "buy5"];
      buyIds.forEach((id, i) => document.getElementById(id).addEventListener("click", () => this.buyShopItem(i)));

      // offline income
      this._applyOfflineIncome();

      // ready
      window.YGSDK.ready();
      window.YGSDK.gameplayStart();

      // initial
      this.ui.switchScreen(this.state.activeScreen);
      this.ui.updateAll();

      // loop
      this._lastFrameAt = now();
      requestAnimationFrame(this._tick);

      // before unload
      window.addEventListener("beforeunload", () => {
        this.state.lastExitTimestamp = now();
        try { localStorage.setItem(this.save.key, JSON.stringify(this.exportState())); } catch (_) {}
        try { window.YGSDK.gameplayStop(); } catch (_) {}
      });
    }

    exportState() {
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
        rewardBoostActive: this.state.rewardBoostActive,
        rewardBoostEndTime: this.state.rewardBoostEndTime,
        lastExitTimestamp: now(),
        shopBuys: [...this.state.shopBuys],
        dailyLastClaim: this.state.dailyLastClaim,
        dailyStreak: this.state.dailyStreak
      };
    }

    importState(d) {
      try {
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

        s.businessLevel = clamp(Number(d.businessLevel || 1), 1, this._businessMaxLevel);
        s.businessProgress = Number(d.businessProgress || 0);
        s.businessProgressGoal = Number(d.businessProgressGoal || 180);

        s.activeScreen = (d.activeScreen || "click");
        s.audioEnabled = (d.audioEnabled !== false);
        s.musicEnabled = !!d.musicEnabled;

        s.rewardBoostActive = !!d.rewardBoostActive;
        s.rewardBoostEndTime = Number(d.rewardBoostEndTime || 0);

        s.lastExitTimestamp = Number(d.lastExitTimestamp || now());

        s.shopBuys = Array.isArray(d.shopBuys) ? d.shopBuys.slice(0,5).map(x => Number(x || 0)) : [0,0,0,0,0];

        s.dailyLastClaim = String(d.dailyLastClaim || "");
        s.dailyStreak = Number(d.dailyStreak || 0);

        s.money = Math.max(0, s.money);
      } catch (_) {}
    }

    /* Pause/Resume */
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
        this._applyOfflineIncome();
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

    /* Mobile scale-to-fit */
    _onResize() {
      const stage = document.getElementById("stage");
      const wrap = document.getElementById("wrap");
      const vw = wrap.clientWidth;
      const vh = wrap.clientHeight;

      const sw = 470, sh = 930;
      const scale = Math.min(vw / sw, vh / sh);

      stage.style.transform = `scale(${scale})`;
    }

    /* Economy */
    getIncomePerSecondEffective() {
      const s = this.state;
      let ips = s.incomePerSecond;

      const boostMul = 1 + (s.upgradeLevels.boost - 1) * 0.08;
      ips *= boostMul;

      ips += (s.upgradeLevels.auto - 1) * 0.6;

      ips *= this._shopIncomeMultiplier();

      if (s.rewardBoostActive && now() < s.rewardBoostEndTime) ips *= 2;

      return Math.max(0, ips);
    }

    getClickValueEffective() {
      const s = this.state;
      let cv = s.clickValue;
      cv *= 1 + (s.upgradeLevels.boost - 1) * 0.06;
      cv *= this._shopClickMultiplier();
      if (s.rewardBoostActive && now() < s.rewardBoostEndTime) cv *= 2;
      return Math.max(1, cv);
    }

    _shopIncomeMultiplier() {
      const b = this.state.shopBuys;
      return (1 + b[0]*0.10) * (1 + b[1]*0.18) * (1 + b[3]*0.30) * (1 + b[4]*0.45);
    }
    _shopClickMultiplier() {
      const b = this.state.shopBuys;
      return (1 + b[2]*0.20) * (1 + b[3]*0.12);
    }

    /* Costs */
    getUpgradeCost(type) {
      const lvl = this.state.upgradeLevels[type] || 1;
      const base = (type === "income") ? 55 : (type === "boost") ? 95 : 125;
      const k = (type === "income") ? 1.45 : (type === "boost") ? 1.55 : 1.62;
      return Math.floor(base * Math.pow(k, lvl - 1));
    }

    getShopCosts() {
      const buys = this.state.shopBuys;
      const bases = [100_000, 500_000, 1_500_000, 8_500_000, 35_000_000];
      const mults = [1.55, 1.65, 1.7, 1.75, 1.8];
      return bases.map((b, i) => Math.floor(b * Math.pow(mults[i], buys[i])));
    }

    _businessUpgradeCost() {
      const bl = this.state.businessLevel;
      const base = 140;
      const k = 1.52;
      return Math.floor(base * Math.pow(k, bl - 1));
    }

    /* Screens */
    setScreen(screen) {
      if (!this.ui || !this.ui.screens[screen]) return;

      this.state.activeScreen = screen;
      this.ui.switchScreen(screen);
      this.ui.updateAll();
      this.save.requestSave();

      // interstitial: entering business screen not more often than 90 sec
      if (screen === "business") {
        const t = now();
        if (t - this._enteredBusinessAt > 90_000) {
          this._enteredBusinessAt = t;
          this.ads.showInterstitial().catch(()=>{});
        }
      }
    }

    /* Tap coin */
    onTapCoin(ev) {
      if (this._paused) return;

      const cv = this.getClickValueEffective();
      this.state.money += cv;
      this.state.totalClicks += 1;

      // progress from clicks
      const progAdd = 1 + Math.floor(cv * 0.08);
      this._addBusinessProgress(progAdd);

      // FX (better)
      const p = this.ui.fx.stagePointFromClient(ev.clientX, ev.clientY);
      this.ui.fx.spawnCoinArcToMoney(p.x, p.y, 6);
      this.ui.fx.spawnPop(p.x + 12, p.y - 10, `+${formatIntRU(cv)}`);

      this.audio.playClick();
      this.ui.updateAll();
      this.save.requestSave();
    }

    /* Upgrades */
    buyUpgrade(type) {
      if (this._paused) return;
      const cost = this.getUpgradeCost(type);
      if (this.state.money < cost) return;

      this.state.money -= cost;
      this.state.upgradeLevels[type] = (this.state.upgradeLevels[type] || 1) + 1;

      if (type === "income") {
        this.state.incomePerSecond += 1 + Math.floor(this.state.upgradeLevels.income * 0.15);
      } else if (type === "boost") {
        this.state.clickValue += 1 + Math.floor(this.state.upgradeLevels.boost * 0.10);
      } else if (type === "auto") {
        this.state.incomePerSecond += 1 + Math.floor(this.state.upgradeLevels.auto * 0.08);
      }

      this.audio.playUpgrade();
      this.ui.updateAll();
      this.save.requestSave();
    }

    upgradeBusiness() {
      if (this._paused) return;
      const cost = this._businessUpgradeCost();
      if (this.state.money < cost) return;

      this.state.money -= cost;
      const push = Math.floor(55 + this.getIncomePerSecondEffective() * 0.55);
      this._addBusinessProgress(push);

      this.audio.playUpgrade();
      this.ui.updateAll();
      this.save.requestSave();
    }

    /* Rewards */
    async rewardBoost() {
      if (this._paused) return;
      await this.ads.showRewarded(() => {
        this.state.rewardBoostActive = true;
        this.state.rewardBoostEndTime = now() + 180_000;
        this.ui.updateAll();
        this.save.requestSave();
      });
    }

    isDailyAvailable() {
      return this.state.dailyLastClaim !== todayKey();
    }

    _dailyRewardAmount() {
      // scales with business and economy (balanced)
      const bl = this.state.businessLevel;
      const ips = this.getIncomePerSecondEffective();
      const base = 250 + bl * 120;
      const scaled = base + Math.floor(ips * 35);
      return Math.max(200, scaled);
    }

    async claimDailyReward() {
      if (this._paused) return;
      if (!this.isDailyAvailable()) return;

      const amount = this._dailyRewardAmount();

      // streak handling: if claimed yesterday, streak++ else reset to 1
      const last = this.state.dailyLastClaim;
      const t = new Date();
      const yesterday = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
      const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,"0")}-${String(yesterday.getDate()).padStart(2,"0")}`;
      if (last === yKey) this.state.dailyStreak = Math.min(30, (this.state.dailyStreak || 0) + 1);
      else this.state.dailyStreak = 1;

      const streakBonusMul = 1 + Math.min(0.40, (this.state.dailyStreak - 1) * 0.03); // up to +40%
      const total = Math.floor(amount * streakBonusMul);

      // give base and offer double by ad
      this.state.money += total;
      this.state.dailyLastClaim = todayKey();
      this.save.requestSave();
      this.ui.updateAll();

      this.ui.showModal(
        "Ежедневная награда",
        `Вы получили: ${formatIntRU(total)}\nСерия: ${this.state.dailyStreak} дн.`,
        {
          actionText: "УДВОИТЬ ЗА РЕКЛАМУ",
          onAction: async () => {
            this.ui.hideModal();
            await this.ads.showRewarded(() => {
              this.state.money += total;
              this.ui.updateAll();
              this.save.requestSave();
            });
          }
        }
      );
    }

    /* Shop */
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

    /* Auth explicit */
    async requestAuth() {
      const ok = await window.YGSDK.authRequest();
      if (ok) {
        const cloud = await this.save.cloudLoad();
        if (cloud) this._mergeCloud(cloud);
        await this.save.saveNow();
      }
      this.ui.updateAll();
    }

    _mergeCloud(cloud) {
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
        s.businessProgressGoal = Math.max(s.businessProgressGoal, Number(cloud.businessProgressGoal || 180));

        if (Array.isArray(cloud.shopBuys)) {
          for (let i = 0; i < 5; i++) s.shopBuys[i] = Math.max(s.shopBuys[i] || 0, Number(cloud.shopBuys[i] || 0));
        }

        s.dailyLastClaim = (cloud.dailyLastClaim || s.dailyLastClaim || "");
        s.dailyStreak = Math.max(Number(cloud.dailyStreak || 0), s.dailyStreak || 0);
      } catch (_) {}
    }

    toggleSound() {
      this.state.audioEnabled = !this.state.audioEnabled;
      this.audio.setEnabled(this.state.audioEnabled);
      this.ui.updateAll();
      this.save.requestSave();
    }

    toggleMusic() {
      this.state.musicEnabled = !this.state.musicEnabled;
      this.audio.setMusicEnabled(this.state.musicEnabled);
      this.ui.updateAll();
      this.save.requestSave();
    }

    /* Business progress */
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
        s.businessProgress = Math.min(s.businessProgress, s.businessProgressGoal);
        return;
      }
      s.businessLevel += 1;

      const bl = s.businessLevel;
      const growth = (bl < 6) ? 1.34 : (bl < 12) ? 1.52 : 1.70;
      s.businessProgressGoal = Math.floor(s.businessProgressGoal * growth + bl * 85);

      // small scaling
      s.incomePerSecond += Math.floor(1 + bl * 0.6);
      s.clickValue += Math.floor(1 + bl * 0.2);

      // interstitial each N levels
      if (bl % this._interstitialEveryLevels === 0) {
        this.ads.showInterstitial().catch(()=>{});
      }
    }

    /* Offline income */
    _applyOfflineIncome() {
      const s = this.state;
      const last = Number(s.lastExitTimestamp || now());
      const diffMs = Math.max(0, now() - last);
      if (diffMs < 8_000) return;

      const capMs = 2 * 60 * 60 * 1000;
      const used = Math.min(diffMs, capMs);
      const seconds = used / 1000;

      const earned = Math.floor(this.getIncomePerSecondEffective() * seconds);
      if (earned <= 0) return;

      s.money += earned;

      this.ui.showModal(
        "Офлайн доход",
        `Пока вас не было, вы заработали: ${formatIntRU(earned)}`,
        {
          actionText: "УДВОИТЬ ЗА РЕКЛАМУ",
          onAction: async () => {
            this.ui.hideModal();
            await this.ads.showRewarded(() => {
              s.money += earned;
              this.ui.updateAll();
              this.save.requestSave();
            });
          }
        }
      );

      s.lastExitTimestamp = now();
      this.save.requestSave();
      this.ui.updateAll();
    }

    /* Loop */
    _tick() {
      const t = now();
      const dt = (t - this._lastFrameAt) / 1000;
      this._lastFrameAt = t;

      if (!this._paused) {
        this.state.playTimeSeconds += dt;

        // expire boost
        if (this.state.rewardBoostActive && t >= this.state.rewardBoostEndTime) {
          this.state.rewardBoostActive = false;
          this.state.rewardBoostEndTime = 0;
        }

        // passive
        const ips = this.getIncomePerSecondEffective();
        this.state.money += ips * dt;

        // business progress from passive
        const prog = Math.floor((ips * dt) * 0.22);
        if (prog > 0) this._addBusinessProgress(prog);

        // ambient coins on business screen (живее)
        if (this.state.activeScreen === "business") {
          if (Math.random() < 0.05) this.ui.fx.spawnAmbientCoin();
        }

        // update FX
        this.ui.fx.update(dt);

        // autosave
        this._accumSaveTime += dt;
        if (this._accumSaveTime >= 10) {
          this._accumSaveTime = 0;
          this.save.requestSave();
        }

        this.ui.updateAll();
      } else {
        // still animate FX slowly when paused? no — stop for compliance
      }

      requestAnimationFrame(this._tick);
    }
  }

  /* ========= Boot ========= */
  const game = new Game();
  window.__GAME__ = game;

  async function start() {
    await game.init();
  }

  start().catch(e => console.error("Game init failed:", e));
})();