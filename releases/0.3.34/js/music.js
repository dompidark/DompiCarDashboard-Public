import { localStore, availableSpace, storageError } from "./local-store.js";
import { mediaText } from "./text.js";
import {
  readMedia,
  saveMedia,
  nextIndex,
  safeStream,
} from "./media-storage.js";
import { readMetadata } from "./metadata.js";
import { icon } from "./icons.js";
import { musicSources, radioStations } from "./core.js";

// Imported file bytes live in scoped IndexedDB; object URLs are tab-local.
export function createMusicPlayer({
  getPreferences,
  chooseSource,
  chooseRadio,
  notice,
}) {
  const $ = (id) => document.getElementById(id);
  let audio = new Audio();
  let remoteQueue = [],
    localFiles = [],
    localQueue = [],
    libraryReady = false,
    importRevision = 0,
    customRadio = null,
    catalog = [],
    catalogKnown = false;
  let shuffle = readMedia().shuffle === true,
    repeat = readMedia().repeat || "off";
  let visualization = readMedia().visualization === "vu" ? "vu" : "spectrum";
  let vuAnalysers = [];
  let outputGain = null;
  let context,
    analyser,
    frame,
    frameTimer,
    spectrumRevision = 0;
  let graphicsFocused = document.hasFocus();
  const graphicVisible = () =>
    !document.hidden &&
    !$("player").inert &&
    document.body.dataset.screen === "home";
  function stopGraphics() {
    cancelAnimationFrame(frame);
    clearTimeout(frameTimer);
  }
  function normalRate(element) {
    // Event-driven guard, never a timer and never a repeated write at 1x.
    if (element.defaultPlaybackRate !== 1) element.defaultPlaybackRate = 1;
    if (element.playbackRate !== 1) element.playbackRate = 1;
  }
  function resetAudio() {
    spectrumRevision++;
    if ($("spectrum")) $("spectrum").hidden = true;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    stopGraphics();
    spectrumResize?.disconnect();
    context?.close().catch(() => {});
    context = analyser = null;
    vuAnalysers = [];
    outputGain = null;
    audio = new Audio();
    audio.preload = "metadata";
    audio.volume = Number($("volume").value) / 100;
    listenAudio();
    registerMediaActions("nuovo elemento audio");
  }
  let spectrumResize;
  let playbackRequested = false;
  // Session-only fallback decisions; never persist authenticated stream URLs.
  const nativeStreams = new Set();
  function retryNativeAudio() {
    if (source !== "nas" || audio.crossOrigin !== "anonymous" || !files[index]?.url) return false;
    const url = files[index].url;
    const position = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const resume = playbackRequested;
    if (nativeStreams.size >= 32) nativeStreams.clear();
    nativeStreams.add(url);
    resetAudio(); // Detach any Web Audio graph before retrying without CORS.
    const fallback = audio;
    audio.addEventListener("loadedmetadata", () => {
      if (audio === fallback && position > 0 && Number.isFinite(audio.duration))
        audio.currentTime = Math.min(position, audio.duration);
    }, { once: true });
    audio.src = url;
    audio.load();
    spectrum(false);
    document.dispatchEvent(new CustomEvent("dompi-stream-analysis", {
      detail: "Analisi CORS non disponibile o stream in errore: tentativo audio nativo con VU demo. Il browser non distingue CORS, rete e rifiuto del server."
    }));
    if (resume) play();
    return true;
  }
  function meterMode(real) {
    const meter = $("vu-fallback");
    if (!meter) return;
    const mode = real ? "real" : "demo";
    if (meter.dataset.mode === mode) return;
    meter.dataset.mode = mode;
    meter.setAttribute("aria-label", real ? "VU stereo reale, livello RMS digitale" : "VU emulato, non misura audio");
    meter.querySelectorAll("b").forEach((label, i) => label.textContent = `${real ? "VU reale" : "VU demo"} · ${i ? "R" : "L"}`);
    meter.querySelectorAll("span").forEach(label => label.textContent = real ? "−40　−30　−20　−10　0" : "−20　−10　−5　0　+3");
    if (!real) meter.querySelectorAll("i").forEach(needle => needle.style.removeProperty("transform"));
  }
  function setSpectrumStatus(value) {
    const el = $("spectrum-status");
    if (el.textContent !== value) el.textContent = value;
  }
  async function spectrum(gesture = false) {
    const canvas = $("spectrum"),
      status = $("spectrum-status");
    if (!canvas) return;
    const revision = ++spectrumRevision;
    stopGraphics();
    spectrumResize?.disconnect();
    canvas.hidden = true;
    meterMode(false);
    if ($("vu-fallback")) $("vu-fallback").hidden = false;
    if (source !== "local" && !(source === "nas" && audio.crossOrigin === "anonymous")) {
      status.textContent =
        source === "radio" || source === "nas"
          ? "VU decorativo · flusso remoto senza analisi audio."
          : "VU decorativo · le app esterne non possono essere analizzate.";
      return;
    }
    if (!files.length) {
      status.textContent =
        "Carica un file locale e premi Riproduci per lo spettro.";
      return;
    }
    const activeAudio = audio;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw Error("unsupported");
      if (!context) {
        if (!gesture) {
          status.textContent =
            "Tocca Riproduci per attivare lo spettro reale.";
          return;
        }
        context = new Context();
      }
      const activeContext = context;
      if (gesture && activeContext.state !== "running")
        activeContext.resume().catch(() => {
          if (revision === spectrumRevision)
            status.textContent =
              "AudioContext sospeso. Tocca Riproduci per riprovare.";
        });
      // Do not await resume indefinitely: Safari can leave it pending without a gesture.
      if (activeContext.state !== "running") {
        status.textContent =
          "AudioContext sospeso: tocca Riproduci.";
        activeContext.onstatechange = () => {
          if (context === activeContext && activeContext.state === "running")
            spectrum(false);
        };
        return;
      }
      if (activeAudio !== audio || revision !== spectrumRevision) return;
      // A successful media load in anonymous mode means the browser accepted CORS,
      // including redirects and 206 responses. Never attach an opaque stream.
      if (source === "nas" && activeAudio.readyState < 2) {
        status.textContent = "VU demo · verifica stream CORS in corso.";
        return;
      }
      if (!analyser) {
        const node = activeContext.createMediaElementSource(activeAudio);
        try {
          const analysis = activeContext.createAnalyser();
          analysis.fftSize = 128;
          node.connect(analysis);
          outputGain = activeContext.createGain();
          analysis.connect(outputGain);
          outputGain.connect(activeContext.destination);
          audio.volume = 1;
          outputGain.gain.value = Number($("volume").value) / 100;
          analyser = analysis;
          controls();
          // Passive stereo measurement branch; the audible path stays unchanged.
          try {
            const stereo = activeContext.createGain();
            stereo.channelCount = 2;
            stereo.channelCountMode = "explicit";
            stereo.channelInterpretation = "speakers";
            const splitter = activeContext.createChannelSplitter(2);
            node.connect(stereo);
            stereo.connect(splitter);
            vuAnalysers = [0, 1].map(channel => {
              const meter = activeContext.createAnalyser();
              meter.fftSize = 256;
              splitter.connect(meter, channel);
              return meter;
            });
          } catch { vuAnalysers = []; }
        } catch (error) {
          node.connect(activeContext.destination);
          throw error;
        }
      }
      activeContext.onstatechange = () => {
        if (context === activeContext) spectrum(false);
      };
      const data = new Uint8Array(analyser.frequencyBinCount);
      const c = canvas.getContext("2d");
      const colors = Array.from(
        { length: 32 },
        (_, i) => `hsl(${190 - i * 4} 85% 55%)`,
      );
      const samples = vuAnalysers.map(meter => new Uint8Array(meter.fftSize));
      const needles = [...$("vu-fallback").querySelectorAll("i")];
      const levels = [0, 0];
      let lastMeterTime = performance.now();
      let sizeDirty = true;
      // Measurements happen only on resize or a hidden→visible canvas transition.
      spectrumResize?.disconnect();
      spectrumResize = new ResizeObserver(() => {
        sizeDirty = true;
      });
      spectrumResize.observe(canvas.parentElement);
      const draw = () => {
        if (revision !== spectrumRevision || !graphicVisible()) return;
        if (activeContext.state !== "running") {
          canvas.hidden = true;
          meterMode(false);
          if ($("vu-fallback")) $("vu-fallback").hidden = false;
          setSpectrumStatus(
            "AudioContext sospeso: tocca Riproduci per riattivarlo.",
          );
          return;
        }
        analyser.getByteFrequencyData(data);
        const signal = data.some((v) => v > 0) && !audio.paused;
        const realVU = visualization === "vu" && vuAnalysers.length === 2;
        const showSpectrum = visualization === "spectrum";
        if (canvas.hidden === showSpectrum) { canvas.hidden = !showSpectrum; sizeDirty = true; }
        $("vu-fallback").hidden = showSpectrum;
        meterMode(realVU);
        if (realVU) {
          const now = performance.now(), elapsed = Math.min(500, now - lastMeterTime);
          lastMeterTime = now;
          vuAnalysers.forEach((meter, channel) => {
            meter.getByteTimeDomainData(samples[channel]);
            const power = samples[channel].reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples[channel].length;
            const db = 20 * Math.log10(Math.max(Math.sqrt(power), 0.00001));
            const target = audio.paused ? 0 : Math.max(0, Math.min(1, (db + 40) / 40));
            const tau = target > levels[channel] ? 70 : 280;
            levels[channel] += (target - levels[channel]) * (1 - Math.exp(-elapsed / tau));
            if (audio.paused) levels[channel] = 0;
            needles[channel].style.transform = `rotate(${-45 + levels[channel] * 90}deg)`;
          });
        }
        setSpectrumStatus(realVU
          ? "VU reale · L/R · RMS digitale (dBFS)"
          : showSpectrum
            ? signal ? "Spettro audio reale · 32 bande" : "Spettro reale pronto · pausa o silenzio."
            : "VU emulato · misura stereo non disponibile.");
        if (showSpectrum) {
          if (sizeDirty) {
            const ratio = Math.min(devicePixelRatio || 1, 2);
            canvas.width = Math.max(
              1,
              Math.floor(canvas.parentElement.clientWidth * ratio),
            );
            canvas.height = Math.max(
              1,
              Math.floor(canvas.getBoundingClientRect().height * ratio),
            );
            sizeDirty = false;
          }
          const { width, height } = canvas;
          c.clearRect(0, 0, width, height);
          for (let i = 0; i < 32; i++) {
            const h = (data[i] * height) / 255;
            c.fillStyle = colors[i];
            c.fillRect((i * width) / 32, height - h, width / 32 - 2, h);
          }
        }
        if (!audio.paused)
          frameTimer = setTimeout(
            () => {
              frame = requestAnimationFrame(draw);
            },
            graphicsFocused ? 50 : 200,
          );
      };
      draw();
    } catch {
      canvas.hidden = true;
      meterMode(false);
      $("vu-fallback").hidden = false;
      status.textContent =
        "VU decorativo · analizzatore non disponibile.";
    }
  }
  function refreshGraphics() {
    document.body.dataset.graphicsPaused = String(
      document.hidden || !graphicsFocused,
    );
    stopGraphics();
    if (!document.hidden) {
      progress();
      spectrum(false);
    }
  }
  document.addEventListener("dompi-render", () => {
    controls();
    progress();
    queueUI();
    renderLocal();
    refreshGraphics();
  });
  document.addEventListener("visibilitychange", refreshGraphics);
  window.addEventListener("blur", () => {
    graphicsFocused = false;
    refreshGraphics();
  });
  window.addEventListener("focus", () => {
    graphicsFocused = true;
    refreshGraphics();
  });
  window.addEventListener("pagehide", stopGraphics);
  window.addEventListener("pageshow", refreshGraphics);
  window.addEventListener("hashchange", () =>
    requestAnimationFrame(refreshGraphics),
  );
  document.addEventListener("dompi-panelchange", () =>
    requestAnimationFrame(refreshGraphics),
  );
  const album = document.querySelector("#player .album");
  let coverRevision = 0;
  function cover(url) {
    const revision = ++coverRevision;
    album.style.backgroundImage = url
      ? `url("${url.replaceAll('"', "%22")}")`
      : "";
    if (url) {
      const probe = new Image();
      probe.referrerPolicy = "no-referrer";
      probe.onerror = () => {
        if (revision === coverRevision) album.style.backgroundImage = "";
      };
      probe.src = url;
    }
  }
  function queueUI() {
    if (source === "local" && libraryReady)
      localStore
        .put("meta", { id: "queue", ids: localQueue.map((f) => f.id), index })
        .catch((e) => notice(storageError(e)));
    if (source === "nas")
      saveMedia({ jellyfinQueue: { ids: files.map((f) => f.id), index } });
    document.dispatchEvent(
      new CustomEvent("dompi-queue", {
        detail: {
          source,
          index,
          tracks: files.map((f) => ({
            name: f.title || f.file.name,
            artist: f.artist || "",
            sessionPosition: f.sessionPosition || null,
            sessionTotal: f.sessionTotal || null,
          })),
          shuffle,
          repeat,
        },
      }),
    );
  }

  let mediaPlaying = false;
  let shuffleRemaining = [],
    shuffleHistory = [],
    shuffleStarted = false;
  function resetShuffle() {
    shuffleRemaining = [];
    shuffleHistory = [];
    shuffleStarted = false;
  }
  audio.preload = "metadata";
  let source,
    files = [],
    index = 0,
    sourceKey = "",
    radioURL = "";
  const radio = () => source === "radio";
  const playable = () => local() || radio();
  const local = () => source === "local" || source === "nas";
  const time = (value) =>
    Number.isFinite(value)
      ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`
      : "—";
  const trackPositionText = (track, fallbackIndex = index, length = files.length) =>
    track?.sessionPosition && track?.sessionTotal
      ? `${track.sessionPosition} di ${track.sessionTotal}`
      : `${fallbackIndex + 1} di ${length}`;
  function controls() {
    const playing = playable() && mediaPlaying;
    updateSystemMedia();
    document.dispatchEvent(
      new CustomEvent("dompi-selection", {
        detail: {
          source,
          radioURL,
          id: files[index]?.id,
          index,
          sessionPosition: files[index]?.sessionPosition || null,
          sessionTotal: files[index]?.sessionTotal || null,
        },
      }),
    );
    document.body.dataset.audioActive = String(
      playable() && !audio.paused && !audio.ended,
    );
    document.dispatchEvent(
      new CustomEvent("dompi-playback", { detail: { playing } }),
    );
    const requested = playable() && !audio.paused && !audio.ended;
    $("play").innerHTML = icon(requested ? "pause" : "play");
    $("play").setAttribute(
      "aria-label",
      playable() ? (requested ? "Pausa" : "Riproduci") : "Apri app musicale",
    );
    $("play").disabled = local()
      ? !files.length
      : radio()
        ? !radioURL
        : $("music-link").hidden;
    $("previous").disabled = $("next").disabled =
      !playable() || (local() && !files.length);
    $("previous").setAttribute(
      "aria-label",
      radio() ? "Radio precedente" : "Brano precedente",
    );
    $("next").setAttribute(
      "aria-label",
      radio() ? "Radio successiva" : "Brano successivo",
    );
    $("progress").disabled =
      !local() || !files.length || !Number.isFinite(audio.duration);
    const appleTouch = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const nativeVolumeOnly = playable() && appleTouch && !outputGain;
    $("volume").disabled = !playable() || nativeVolumeOnly;
    $("volume").title = nativeVolumeOnly ? "Usa i tasti volume del dispositivo: questo flusso non è analizzabile." : "Volume del lettore";
    $("volume-value").textContent = nativeVolumeOnly ? "iPad" : `${$("volume").value}%`;
    if (source === "nas")
      $("player-mode").textContent = files.length
        ? "JELLYFIN"
        : "ACCESSO RICHIESTO";
    if (radio())
      $("player-mode").textContent = playing ? "IN DIRETTA" : "RADIO";
  }
  function progress() {
    if (!graphicVisible()) return;
    if (local()) {
      $("progress").disabled =
        !files.length || !Number.isFinite(audio.duration);
      $("progress").max = Number.isFinite(audio.duration) ? audio.duration : 0;
      $("progress").value = audio.currentTime || 0;
      $("duration").textContent = time(audio.duration);
    }
    $("elapsed").textContent = time(Number($("progress").value));
  }
  function pause() {
    playbackRequested = false;
    mediaPlaying = false;
    audio.pause();
    if (radio()) {
      audio.removeAttribute("src");
      audio.load();
    }
    controls();
  }
  async function play() {
    const requestedSource = sourceKey;
    const requestedAudio = audio;
    playbackRequested = true;
    if (source === "local" || source === "nas") spectrum(true);
    try {
      await audio.play();
    } catch (error) {
      if (requestedSource !== sourceKey || requestedAudio !== audio) return;
      const message = error.name === "NotAllowedError"
        ? "Safari richiede un tocco: brano pronto, premi Riproduci nella Home."
        : error.name === "NotSupportedError"
          ? "Formato o flusso non supportato dal browser."
          : "Riproduzione interrotta o non disponibile: premi Riproduci per riprovare.";
      $("player-note").textContent = message;
      if (source === "nas") document.dispatchEvent(new CustomEvent("dompi-stream-error", { detail: { message, code: error.name || "PLAY_FAILED" } }));
      notice(message);
    }
    controls();
  }
  function loadTrack() {
    playbackRequested = false;
    const cors = source === "nas" && files.length && !nativeStreams.has(files[index].url);
    // A graph cannot safely consume an opaque fallback. Use a fresh media element.
    if (!cors && source === "nas" && context) resetAudio();
    audio.pause();
    audio.removeAttribute("src");
    if (cors) audio.crossOrigin = "anonymous";
    else audio.removeAttribute("crossorigin");
    if (files.length) audio.src = files[index].url;
    audio.load();
    $("track").textContent = files.length
      ? files[index].title || files[index].file.name
      : source === "nas"
        ? "Accedi a Jellyfin"
        : "Nessun brano selezionato";
    $("artist").textContent = files.length
      ? files[index].artist || (source === "nas" ? "Jellyfin" : "File locale")
      : source === "nas"
        ? "Scegli la libreria nella scheda Jellyfin"
        : "Apri Musica per caricare i tuoi brani";
    $("album-name").textContent = files.length ? files[index].album || "" : "";
    $("track-position").hidden = !files.length;
    $("track-position").textContent = files.length
      ? trackPositionText(files[index])
      : "";
    cover(files[index]?.cover);
    queueUI();
    $("progress").value = 0;
    progress();
    controls();
    document
      .querySelectorAll("#local-tracks [data-local-id]")
      .forEach((b) =>
        b.setAttribute(
          "aria-current",
          String(source === "local" && b.dataset.localId === files[index]?.id),
        ),
      );
  }
  function select(next) {
    $("player").dataset.source = next;
    const prefs = getPreferences();
    const service =
      musicSources[next] ||
      prefs.customApps.find((app) => app.id === next) ||
      musicSources.spotify;
    const station = customRadio ||
      radioStations[prefs.radioStation] || {
        name: "Radio personalizzata",
        url: prefs.radioURL,
      };
    const key = next === "radio" ? next + station.url : next;
    $("current-source").textContent =
      next === "radio" ? station.name : service.name;
    $("music-link").hidden = !(service.app || service.url);
    if (service.app || service.url) {
      $("music-link").href = service.app || service.url;
      $("music-link").target = "_blank";
      $("music-link").rel = "noopener noreferrer";
      $("music-link").textContent = service.app
        ? `Apri app ${service.name}`
        : `Apri collegamento ${service.name}`;
    }
    $("music-store").hidden = !service.ios;
    if (service.ios)
      $("music-store").href =
        prefs.platform === "android" ? service.android : service.ios;
    $("music-web").hidden = !service.app;
    if (service.url) $("music-web").href = service.url;
    $("nas-note").hidden = true;
    $("library-title").textContent =
      next === "radio" ? station.name : service.name;
    $("library-description").textContent =
      next === "radio"
        ? "Diretta nel lettore della Home. Seleziona la radio nelle Impostazioni."
        : next === "local"
          ? "Seleziona file dal dispositivo. Nessun invio al server."
          : next === "nas"
            ? "Accedi a Jellyfin nella libreria della Home."
            : "Si apre l’app esterna. Se non è installata, usa il collegamento allo store; nessun sito si apre automaticamente.";
    $("player-mode").textContent =
      next === "local"
        ? "AUDIO LOCALE"
        : next === "radio"
          ? "RADIO"
          : next === "nas"
            ? "NON COLLEGATO"
            : "APP ESTERNA";
    $("player-note").textContent =
      next === "local"
        ? "Volume del lettore; i tasti del tablet regolano il volume di sistema."
        : next === "radio"
          ? "Tocca Riproduci per la diretta. Serve Internet."
          : next === "nas"
            ? "Scegli Jellyfin nella Home e accedi al server."
            : "L’app suona esternamente; Dompi non ne controlla i brani.";
    $("progress").setAttribute("aria-label", "Avanzamento brano locale");
    $("volume").setAttribute("aria-label", "Volume audio (se supportato)");
    document.querySelector(".library-list").hidden = true;
    if (sourceKey === key) {
      controls();
      if (radio() && mediaPlaying)
        $("player-note").textContent =
          "Diretta radio · su iPad usa il volume del dispositivo.";
      return;
    }
    pause();
    resetAudio();
    source = next;
    registerMediaActions("cambio sorgente");
    resetShuffle();
    files = next === "nas" ? remoteQueue : next === "local" ? localQueue : [];
    document.dispatchEvent(new CustomEvent("dompi-source-change"));
    index = Math.min(index, Math.max(0, files.length - 1));
    cover(null);
    sourceKey = key;
    radioURL = next === "radio" ? station.url : "";
    if (local()) loadTrack();
    else {
      $("track-position").hidden = true;
      $("track-position").textContent = "";
      if (radio())
        cover(
          station.logo || new URL("../assets/radio.svg", import.meta.url).href,
        );
      $("track").textContent = radio() ? station.name : service.name;
      $("artist").textContent = radio()
        ? "Radio italiana · diretta"
        : next === "nas"
          ? "Servizio non collegato"
          : "Ascolta nella tua app";
      $("album-name").textContent = radio() ? "Diretta radio" : "";
      $("progress").value = 0;
      $("elapsed").textContent = radio() ? "LIVE" : "—";
      $("duration").textContent = "";
      controls();
    }
    spectrum(false);
  }
  $("play").addEventListener("click", () => {
    if (radio()) {
      if (!radioURL) return;
      if (!audio.paused) {
        pause();
        return;
      }
      if (audio.src !== radioURL || audio.error) {
        audio.src = radioURL;
        audio.load();
      }
      $("player-note").textContent = "Connessione alla radio…";
      play();
    } else if (local()) {
      if (files.length) audio.paused ? play() : pause();
    } else if (!$("music-link").hidden) $("music-link").click();
  });
  function next(delta, autoplay = false) {
    if (local()) {
      if (!files.length) return;
      const resume = autoplay || !audio.paused;
      if (shuffle) {
        if (delta < 0) {
          if (!shuffleHistory.length) return;
          shuffleRemaining.unshift(index);
          index = shuffleHistory.pop();
        } else {
          if (!shuffleRemaining.length) {
            if (shuffleStarted && repeat !== "all") return;
            shuffleRemaining = files
              .map((_, i) => i)
              .filter((i) => i !== index);
            for (let i = shuffleRemaining.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffleRemaining[i], shuffleRemaining[j]] = [
                shuffleRemaining[j],
                shuffleRemaining[i],
              ];
            }
            shuffleStarted = true;
          }
          if (!shuffleRemaining.length) return;
          shuffleHistory.push(index);
          index = shuffleRemaining.shift();
        }
      } else {
        const target = index + delta;
        if (target < 0 || target >= files.length) {
          if (repeat !== "all") return;
          index = (target + files.length) % files.length;
        } else index = target;
      }
      loadTrack();
      if (resume) play();
    } else if (radio()) {
      if (catalogKnown) {
        if (!catalog.length) return;
        const current = catalog.findIndex((s) => s.url === radioURL);
        station(
          catalog[
            (Math.max(0, current) + delta + catalog.length) % catalog.length
          ],
          catalog,
          true,
        );
        return;
      }
      const keys = Object.keys(radioStations),
        current = keys.indexOf(getPreferences().radioStation);
      chooseRadio(
        keys[(Math.max(0, current) + delta + keys.length) % keys.length],
      );
      audio.src = radioURL;
      audio.load();
      play();
    }
  }
  // iPadOS/Bluetooth media controls: reuse the same transport as the UI.
  // Safari may associate the session again when the audio element changes or
  // the PWA returns to the foreground, so registration is intentionally
  // repeatable. No second player is created here.
  const mediaSession = navigator.mediaSession;
  let lastMediaIdentity = "";
  let lastMediaSessionAction = "Nessuna";
  let lastMediaSessionError = "";
  const mediaSessionActions = Object.create(null);
  const mediaActionLabels = {
    play: "Play",
    pause: "Pausa",
    nexttrack: "Successivo",
    previoustrack: "Precedente",
  };
  function mediaSessionErrorText(error) {
    const name = String(error?.name || "Errore").slice(0, 60);
    const message = String(error?.message || "operazione non riuscita")
      .replace(/[\r\n]+/g, " ")
      .slice(0, 180);
    return `${name}: ${message}`;
  }
  function reportMediaSession(reason, error = null) {
    if (error) lastMediaSessionError = mediaSessionErrorText(error);
    const supported = Boolean(mediaSession?.setActionHandler);
    const registered = Object.entries(mediaSessionActions)
      .filter(([, value]) => value === "attivo")
      .map(([action]) => mediaActionLabels[action] || action);
    const detail = {
      supported,
      reason,
      actions: { ...mediaSessionActions },
      lastAction: lastMediaSessionAction,
      error: lastMediaSessionError,
    };
    if ($("media-session-support"))
      $("media-session-support").textContent = supported
        ? "Disponibile nel browser"
        : "Non disponibile nel browser";
    if ($("media-session-actions"))
      $("media-session-actions").textContent = registered.length
        ? registered.join(", ")
        : "Nessuna";
    if ($("media-session-last-action"))
      $("media-session-last-action").textContent = lastMediaSessionAction;
    if ($("media-session-error"))
      $("media-session-error").textContent = lastMediaSessionError || "Nessuno";
    if ($("media-session-status"))
      $("media-session-status").textContent = supported
        ? `${registered.length} azioni attive · ${reason}.`
        : "MediaSession non disponibile: restano utilizzabili i comandi della Dashboard.";
    document.dispatchEvent(
      new CustomEvent("dompi-media-session", { detail }),
    );
  }
  function invokeMediaAction(action, callback) {
    const actionLabel = mediaActionLabels[action] || action;
    lastMediaSessionAction = actionLabel;
    reportMediaSession(`comando ${actionLabel}`);
    try {
      const result = callback();
      if (result?.catch)
        result.catch((error) =>
          reportMediaSession(`errore comando ${actionLabel}`, error),
        );
    } catch (error) {
      reportMediaSession(`errore comando ${actionLabel}`, error);
    }
  }
  const mediaActionHandlers = {
    play: () => {
      if (playable() && audio.paused) return play();
    },
    pause: () => {
      if (playable() && !audio.paused) pause();
    },
    nexttrack: () => {
      if (playable()) next(1);
    },
    previoustrack: () => {
      if (playable()) next(-1);
    },
  };
  function registerMediaActions(reason = "avvio") {
    if (!mediaSession?.setActionHandler) {
      reportMediaSession(reason);
      return;
    }
    // Do not install time-seek actions: they are different from track changes.
    // Clearing stale handlers also prevents this app from leaving its own
    // ±10-second callbacks registered after a source/audio transition.
    for (const action of ["seekbackward", "seekforward", "seekto"]) {
      try {
        mediaSession.setActionHandler(action, null);
      } catch {
        // Unsupported optional actions do not disable the four core controls.
        mediaSessionActions[action] = "non supportato";
      }
    }
    for (const [action, callback] of Object.entries(mediaActionHandlers)) {
      try {
        mediaSession.setActionHandler(action, () =>
          invokeMediaAction(action, callback),
        );
        mediaSessionActions[action] = "attivo";
      } catch (error) {
        mediaSessionActions[action] = "errore";
        reportMediaSession(`registrazione ${action}`, error);
      }
    }
    reportMediaSession(reason);
  }
  function updateSystemMedia() {
    if (!mediaSession) return;
    const active = playable() && (radio() ? Boolean(radioURL) : files.length > 0);
    if (!active) {
      try {
        if (lastMediaIdentity) {
          mediaSession.metadata = null;
          lastMediaIdentity = "";
        }
        mediaSession.playbackState = "none";
      } catch (error) {
        reportMediaSession("azzeramento stato", error);
      }
      return;
    }
    const track = local() ? files[index] : null;
    const title = radio() ? $("track").textContent || "Radio" : track?.title || track?.file?.name || "Brano";
    const artist = radio() ? "Radio Internet" : track?.artist || (source === "nas" ? "Jellyfin" : "File locale");
    const album = radio() ? "Diretta radio" : track?.album || "";
    const coverURL = radio() ? (customRadio?.logo || radioStations[getPreferences().radioStation]?.logo || "") : track?.cover || "";
    const identity = JSON.stringify([source, radioURL, track?.id, index, title, artist, album, coverURL]);
    if (identity !== lastMediaIdentity && typeof MediaMetadata === "function") {
      try {
        mediaSession.metadata = new MediaMetadata({
          title, artist, album,
          artwork: coverURL ? [{ src: coverURL }] : [],
        });
        lastMediaIdentity = identity;
      } catch (error) {
        reportMediaSession("aggiornamento metadati", error);
      }
    }
    try {
      mediaSession.playbackState = !audio.paused && !audio.ended
        ? "playing"
        : "paused";
    } catch (error) {
      reportMediaSession("aggiornamento stato", error);
    }
  }
  registerMediaActions("avvio player");
  const resumeMediaSession = () => {
    if (document.hidden) return;
    registerMediaActions("ritorno in primo piano");
    updateSystemMedia();
  };
  document.addEventListener("visibilitychange", resumeMediaSession);
  window.addEventListener("pageshow", resumeMediaSession);
  window.addEventListener("focus", resumeMediaSession);
  $("previous").addEventListener("click", () => next(-1));
  $("next").addEventListener("click", () => next(1));
  $("progress").addEventListener("input", () => {
    if (local() && Number.isFinite(audio.duration))
      audio.currentTime = Number($("progress").value);
    progress();
  });
  if (Number.isFinite(readMedia().volume)) $("volume").value = Math.max(0, Math.min(100, readMedia().volume));
  function applyVolume() {
    const value = Number($("volume").value) / 100;
    if (outputGain && context) {
      audio.volume = 1;
      outputGain.gain.setTargetAtTime(value, context.currentTime, 0.015);
    } else audio.volume = value;
    $("volume-value").textContent = `${$("volume").value}%`;
  }
  $("volume").addEventListener("input", () => {
    applyVolume();
    saveMedia({ volume: Number($("volume").value) });
  });
  applyVolume();
  function listenAudio() {
    const observed = audio;
    const onAudio = (event, handler) =>
      observed.addEventListener(event, () => {
        if (observed === audio) handler();
      });
    normalRate(observed);
    onAudio("ratechange", () => normalRate(observed));
    for (const event of ["pause", "ended"])
      onAudio(event, () => {
        mediaPlaying = false;
        controls();
        stopGraphics();
        if (graphicVisible()) spectrum(false);
      });
    for (const event of ["timeupdate", "loadedmetadata", "durationchange"])
      onAudio(event, () => {
        if (local()) progress();
      });
    onAudio("loadeddata", () => { if (source === "nas") spectrum(false); });
    onAudio("ended", () => {
      if (local()) {
        if (repeat === "one") {
          audio.currentTime = 0;
          play();
        } else if (index < files.length - 1 || repeat === "all" || shuffle)
          next(1, true);
      }
    });
    onAudio("playing", () => {
      mediaPlaying = true;
      registerMediaActions("riproduzione avviata");
      controls();
      spectrum();
      $("player-note").textContent = radio()
        ? "Diretta radio · su iPad usa il volume del dispositivo."
        : "Audio in riproduzione · velocità 1×.";
    });
    onAudio("waiting", () => {
      mediaPlaying = false;
      controls();
      stopGraphics();
      $("player-note").textContent =
        "Buffering audio · attendo dati, velocità 1×.";
    });
    onAudio("stalled", () => {
      // Network stall need not mean buffered playback has stopped: do not pause/reload.
      $("player-note").textContent =
        "Flusso in attesa di dati dalla rete. La riproduzione può continuare dal buffer.";
    });
    onAudio("error", () => {
      if (retryNativeAudio()) return;
      mediaPlaying = false;
      audio.pause();
      controls();
      if (radio()) {
        $("player-note").textContent =
          "Radio non disponibile. Verifica Internet o scegli un’altra stazione.";
        document.dispatchEvent(
          new CustomEvent("dompi-radio-error", { detail: { url: radioURL } }),
        );
        controls();
      }
      if (source === "nas") {
        const code = audio.error?.code || 0;
        const reason = { 1: "richiesta interrotta", 2: "errore di rete", 3: "decodifica audio", 4: "sorgente o formato non supportato" }[code] || "errore sconosciuto";
        const message = `Audio Jellyfin: ${reason} (MediaError ${code}).`;
        $("player-note").textContent = message;
        document.dispatchEvent(new CustomEvent("dompi-stream-error", { detail: { message, code: `MEDIA_${code}` } }));
      }
      if (local() && files.length)
        notice(
          "Questo file non è leggibile dal browser. Prova MP3, AAC o WAV.",
        );
    });
  }
  listenAudio();
  function entryFromRecord(record) {
    const file = new File([record.blob], record.name, {
      type: record.type,
      lastModified: record.modified,
    });
    return {
      id: record.id,
      file,
      url: URL.createObjectURL(file),
      title: record.title,
      artist: record.artist,
      album: record.album,
      cover: record.coverBlob ? URL.createObjectURL(record.coverBlob) : null,
    };
  }
  function renderLocal() {
    $("local-tracks").replaceChildren();
    for (const entry of localFiles) {
      const row = document.createElement("div");
      row.className = "station-row";
      const button = document.createElement("button");
      button.textContent =
        (entry.title || entry.file.name) +
        (entry.artist ? " · " + entry.artist : "");
      button.dataset.localId = entry.id;
      button.setAttribute(
        "aria-current",
        String(source === "local" && files[index]?.id === entry.id),
      );
      button.onclick = () => {
        localQueue = [...localFiles];
        chooseSource("local");
        files = localQueue;
        index = files.findIndex((f) => f.id === entry.id);
        resetShuffle();
        loadTrack();
        play();
        document.dispatchEvent(new Event("dompi-media-chosen"));
      };
      const add = document.createElement("button");
      add.textContent = "＋";
      add.setAttribute(
        "aria-label",
        `Aggiungi alla coda locale: ${entry.title || entry.file.name}`,
      );
      add.onclick = () => {
        localQueue.push(entry);
        if (source === "local") files = localQueue;
        saveLocalQueue();
        document.dispatchEvent(
          new CustomEvent("dompi-queue", { detail: getQueueState("local") }),
        );
      };
      const remove = document.createElement("button");
      remove.textContent = "×";
      remove.setAttribute(
        "aria-label",
        `Rimuovi dalla libreria: ${entry.file.name}`,
      );
      remove.onclick = async () => {
        if (
          !confirm(
            "Rimuovere questo brano importato? Il file originale nel dispositivo non cambia.",
          )
        )
          return;
        try {
          await localStore.remove("tracks", entry.id);
          const current = source === "local" ? files[index] : null;
          const wasPlaying = source === "local" && !audio.paused;
          localFiles = localFiles.filter((f) => f.id !== entry.id);
          localQueue = localQueue.filter((f) => f.id !== entry.id);
          if (source === "local") {
            files = localQueue;
            index = Math.max(0, files.indexOf(current));
            if (current === entry) {
              loadTrack();
              if (wasPlaying && files.length) play();
            }
          }
          URL.revokeObjectURL(entry.url);
          if (entry.cover) URL.revokeObjectURL(entry.cover);
          resetShuffle();
          saveLocalQueue();
          renderLocal();
          queueUI();
        } catch (e) {
          notice(storageError(e));
        }
      };
      row.append(button, add, remove);
      $("local-tracks").append(row);
    }
  }
  function saveLocalQueue() {
    if (libraryReady)
      localStore
        .put("meta", {
          id: "queue",
          ids: localQueue.map((f) => f.id),
          index: source === "local" ? index : 0,
        })
        .catch((e) => notice(storageError(e)));
  }
  const libraryInit = (async () => {
    try {
      const [records, saved] = await Promise.all([
        localStore.all(),
        localStore.get("meta", "queue"),
      ]);
      localFiles = records.map(entryFromRecord);
      localQueue = saved?.ids
        ? saved.ids
            .map((id) => localFiles.find((f) => f.id === id))
            .filter(Boolean)
        : [...localFiles];
      libraryReady = true;
      renderLocal();
      if (source === "local") {
        files = localQueue;
        index = Math.min(saved?.index || 0, Math.max(0, files.length - 1));
        loadTrack();
      }
      $("local-status").textContent = localFiles.length
        ? `${localFiles.length} brani ripristinati dall’archivio del browser.`
        : "Importa file o una cartella. Verranno copiati nell’archivio di questo browser.";
      document.dispatchEvent(new Event("dompi-local-ready"));
    } catch (e) {
      $("local-status").textContent = storageError(e);
    }
  })();
  async function importLocal(selected) {
    await libraryInit;
    const candidates = selected.filter(
      (file) =>
        file.type.startsWith("audio/") ||
        /\.(mp3|m4a|wav|aac|ogg|flac)$/i.test(file.name),
    );
    if (!candidates.length) {
      $("local-status").textContent =
        "Nessun file audio compatibile trovato nella selezione.";
      return;
    }
    const revision = ++importRevision;
    const progressState = $("local-import-state");
    const progress = $("local-import-progress");
    const progressLabel = $("local-import-label");
    const library = document.querySelector(".local-library");
    progressState.hidden = false;
    progress.max = candidates.length;
    progress.value = 0;
    progressLabel.textContent = `0 di ${candidates.length}`;
    library.setAttribute("aria-busy", "true");
    $("local-status").textContent =
      `Preparazione di ${candidates.length} file audio…`;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    let added = 0,
      processed = 0,
      warning = false,
      interrupted = false;
    for (const file of candidates) {
      const id = `${file.webkitRelativePath || file.name}:${file.size}:${file.lastModified}`;
      if (localFiles.some((f) => f.id === id)) {
        processed++;
        progress.value = processed;
        progressLabel.textContent = `${processed} di ${candidates.length}`;
        continue;
      }
      let meta;
      try {
        await availableSpace(file.size);
        meta = await readMetadata(file).catch(() => ({}));
        const record = {
          id,
          blob: file,
          name: file.name,
          type: file.type,
          modified: file.lastModified,
          title: mediaText(meta.title),
          artist: mediaText(meta.artist),
          album: mediaText(meta.album),
          coverBlob: meta.coverBlob || null,
        };
        await localStore.put("tracks", record);
        const entry = entryFromRecord(record);
        localFiles.push(entry);
        localQueue.push(entry);
        added++;
        warning ||= [record.title, record.artist, record.album, file.name].some(
          (v) => v.includes("�"),
        );
      } catch (e) {
        notice(storageError(e));
        interrupted = true;
        break;
      } finally {
        if (meta?.cover) URL.revokeObjectURL(meta.cover);
        processed++;
        progress.value = processed;
        progressLabel.textContent = `${processed} di ${candidates.length}`;
        $("local-status").textContent =
          `Importazione: ${processed} di ${candidates.length} file elaborati…`;
      }
    }
    libraryReady = true;
    saveLocalQueue();
    renderLocal();
    if (source === "local") {
      files = localQueue;
      queueUI();
      if (!audio.src) loadTrack();
    }
    $("local-status").textContent =
      `${added} brani aggiunti, ${localFiles.length} in archivio.${warning ? " Alcuni metadati contengono caratteri non decodificabili: verifica i tag originali." : ""} Safari può cancellare i dati del sito; conserva gli originali.`;
    library.removeAttribute("aria-busy");
    progressLabel.textContent = interrupted
      ? `Interrotta: ${processed} di ${candidates.length}`
      : `Completata: ${processed} di ${candidates.length}`;
    setTimeout(() => {
      if (revision === importRevision) progressState.hidden = true;
    }, 1800);
    navigator.storage?.persist?.().catch(() => {});
  }
  $("local-files").addEventListener("change", async () => {
    const input = $("local-files");
    input.disabled = true;
    try {
      await importLocal([...input.files]);
    } finally {
      input.value = "";
      input.disabled = false;
    }
  });
  function station(item, stations = [], autoplay = true) {
    customRadio = item;
    catalog = stations;
    catalogKnown = true;
    saveMedia({ lastStation: { ...item, logo: safeStream(item.logo) } });
    chooseSource("radio");
    select("radio");
    if (autoplay) {
      audio.src = radioURL;
      audio.load();
      play();
    }
  }
  function getQueueState(type = source) {
    const entries =
      type === "nas" ? remoteQueue : type === "local" ? localQueue : [];
    return {
      source: type,
      index: source === type ? index : -1,
      tracks: entries.map((f) => ({
        name: f.title || f.file.name,
        artist: f.artist || "",
        sessionPosition: f.sessionPosition || null,
        sessionTotal: f.sessionTotal || null,
      })),
      shuffle,
      repeat,
    };
  }
  function queue(entries, start = 0, append = false, autoplay = true) {
    const oldLength = remoteQueue.length;
    remoteQueue = append ? [...remoteQueue, ...entries] : entries;
    if (append) {
      if (source === "nas" && shuffleStarted)
        shuffleRemaining.push(...entries.map((_, i) => oldLength + i));
      if (source === "nas") {
        files = remoteQueue;
        if (oldLength === 0 && files.length) {
          index = 0;
          loadTrack();
        }
      }
      saveMedia({
        jellyfinQueue: {
          ids: remoteQueue.map((f) => f.id),
          index: source === "nas" ? index : 0,
        },
      });
      document.dispatchEvent(
        new CustomEvent("dompi-queue", { detail: getQueueState("nas") }),
      );
      return; // '+' never changes source, src, time or playback state.
    }
    chooseSource("nas");
    files = remoteQueue;
    index = Math.max(0, Math.min(start, files.length - 1));
    resetShuffle();
    loadTrack();
    if (autoplay && files.length) play();
    queueUI();
  }
  function appendRemoteWindow(entries, historySize = 100) {
    if (!Array.isArray(entries) || !entries.length) return getQueueState("nas");
    const active = source === "nas";
    const drop = active
      ? Math.max(0, index - Math.max(0, Number(historySize) || 0))
      : 0;
    if (drop) {
      remoteQueue.splice(0, drop);
      index -= drop;
    }
    remoteQueue.push(...entries);
    if (active) files = remoteQueue;
    saveMedia({
      jellyfinQueue: {
        ids: remoteQueue.map((f) => f.id),
        index: active ? index : 0,
      },
    });
    document.dispatchEvent(
      new CustomEvent("dompi-queue", { detail: getQueueState("nas") }),
    );
    return getQueueState("nas");
  }
  function selectTrack(i, type = source) {
    const entries = type === "nas" ? remoteQueue : localQueue;
    if (i < 0 || i >= entries.length) return;
    if (type !== source) chooseSource(type);
    files = entries;
    index = i;
    resetShuffle();
    loadTrack();
    play();
  }
  function editQueue(type, i, delta) {
    const entries = type === "nas" ? remoteQueue : localQueue;
    if (i < 0 || i >= entries.length) return;
    const active = type === source,
      oldIndex = index,
      wasPlaying = active && !audio.paused;
    if (delta === null) {
      entries.splice(i, 1);
      if (active)
        index =
          i < oldIndex
            ? oldIndex - 1
            : Math.min(oldIndex, Math.max(0, entries.length - 1));
    } else {
      const target = i + delta;
      if (target < 0 || target >= entries.length) return;
      [entries[i], entries[target]] = [entries[target], entries[i]];
      if (active)
        index = oldIndex === i ? target : oldIndex === target ? i : oldIndex;
    }
    if (active) {
      files = entries;
      if (delta === null && i === oldIndex) {
        loadTrack();
        if (wasPlaying && files.length) play();
      }
    }
    resetShuffle();
    saveLocalQueue();
    if (type === "nas")
      saveMedia({
        jellyfinQueue: {
          ids: remoteQueue.map((f) => f.id),
          index: active ? index : 0,
        },
      });
    if (type === "nas")
      document.dispatchEvent(new Event("dompi-remote-queue-edited"));
    document.dispatchEvent(
      new CustomEvent("dompi-queue", { detail: getQueueState(type) }),
    );
  }
  function enqueueCurrent() {
    if (!local() || !files.length || !files[index]) return false;
    const entries = source === "nas" ? remoteQueue : localQueue;
    entries.push(files[index]);
    files = entries;
    $("track-position").hidden = false;
    $("track-position").textContent = trackPositionText(files[index]);
    if (source === "nas")
      saveMedia({ jellyfinQueue: { ids: remoteQueue.map((f) => f.id), index } });
    else saveLocalQueue();
    document.dispatchEvent(
      new CustomEvent("dompi-queue", { detail: getQueueState(source) }),
    );
    return true;
  }
  function modes(s, r) {
    if (shuffle !== s) resetShuffle();
    shuffle = s;
    repeat = r;
    saveMedia({ shuffle, repeat });
    queueUI();
  }
  customRadio = readMedia().lastStation;
  if (!customRadio || !safeStream(customRadio.url)) customRadio = null;
  return {
    setVisualization(value) {
      visualization = value === "vu" ? "vu" : "spectrum";
      saveMedia({ visualization });
      spectrum(true); // Explicit gesture; never restart or seek the track.
    },
    async diagnoseStream() {
      if (source !== "nas" || !files[index]?.url) return "Seleziona prima un brano Jellyfin.";
      const url = files[index].url;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(url, {
          mode: "cors", credentials: "omit", redirect: "follow", cache: "no-store",
          headers: { Range: "bytes=0-1" }, signal: controller.signal,
        });
        // Cancel even when the server ignores Range: never buffer/download the song.
        await response.body?.cancel();
        if (source !== "nas" || files[index]?.url !== url) return "Selezione cambiata: verifica annullata.";
        const type = (response.headers.get("Content-Type") || "non esposto").split(";")[0].slice(0, 80);
        const range = response.headers.has("Content-Range") ? "Content-Range leggibile" : "Content-Range assente o non esposto";
        return `CORS accettato dal browser · HTTP ${response.status} · ${type} · ${response.redirected ? "con reindirizzamento" : "senza reindirizzamento"} · ${range}. ${response.ok ? "Verifica Range eseguita; lo spettro richiede anche un codec supportato e AudioContext attivo." : "Il server ha rifiutato lo stream; CORS da solo non autorizza la riproduzione."}`;
      } catch (error) {
        return error.name === "AbortError"
          ? "Verifica stream scaduta: nessuna modifica alla riproduzione."
          : "Stream non accessibile via fetch CORS: possibile CORS, rete, certificato o autenticazione. Il browser non espone lo stato HTTP.";
      } finally { clearTimeout(timer); }
    },
    select,
    pause,
    station,
    queue,
    appendRemoteWindow,
    enqueueCurrent,
    selectTrack,
    editQueue,
    getQueueState,
    importLocal,
    async savePlaylist(name) {
      await localStore.put("meta", {
        id: "playlist:" + name,
        name,
        ids: localQueue.map((f) => f.id),
      });
    },
    async playlists() {
      return (await localStore.all("meta")).filter((p) =>
        p.id.startsWith("playlist:"),
      );
    },
    async loadPlaylist(id) {
      const saved = await localStore.get("meta", id);
      if (!saved) return;
      localQueue = saved.ids
        .map((id) => localFiles.find((f) => f.id === id))
        .filter(Boolean);
      saveLocalQueue();
      if (source === "local") {
        pause();
        files = localQueue;
        index = 0;
        loadTrack();
      }
      document.dispatchEvent(
        new CustomEvent("dompi-queue", { detail: getQueueState("local") }),
      );
    },
    async deletePlaylist(id) {
      await localStore.remove("meta", id);
    },
    modes,
    spectrum,
    setStationArtwork(id, url) {
      if (customRadio?.id === id) {
        customRadio.logo = url;
        if (source === "radio") cover(url);
      } else if (
        !customRadio &&
        source === "radio" &&
        getPreferences().radioStation === id
      )
        cover(url);
    },
    setRadioCatalog(stations) {
      catalog = stations;
      catalogKnown = true;
    },
    clearStation() {
      customRadio = null;
      saveMedia({ lastStation: null });
    },
    clearRemote() {
      nativeStreams.clear();
      if (source === "nas") pause();
      remoteQueue = [];
      if (source === "nas") {
        files = [];
        loadTrack();
      }
      if (source === "nas") cover(null);
    },
    activate(next) {
      const targetFiles = next === "nas" ? remoteQueue : localQueue;
      if ((next === "nas" || next === "local") && !targetFiles.length) {
        return false;
      }
      select(next);
      if (radio()) {
        if (!radioURL) {
          notice("Scegli una radio disponibile.");
          return false;
        }
        if (audio.src !== radioURL || audio.error) {
          audio.src = radioURL;
          audio.load();
        }
        $("player-note").textContent = "Connessione alla radio…";
        play();
        return true;
      }
      if (local() && files.length) {
        if (!audio.src) loadTrack();
        play();
        return true;
      }
      return false;
    },
    getState: () => ({
      source,
      radioURL,
      id: files[index]?.id,
      index,
      tracks: files.map((f) => ({
        name: f.title || f.file.name,
        artist: f.artist || "",
      })),
      remaining: Math.max(0, files.length - index - 1),
      sessionPosition: files[index]?.sessionPosition || null,
      sessionTotal: files[index]?.sessionTotal || null,
      shuffle,
      repeat,
    }),
  };
}
