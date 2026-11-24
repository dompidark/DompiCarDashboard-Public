// Geolocation state is kept in memory. Only the user's enabled preference is persisted by app.js.
export const FIX_MAX_AGE = 15000;
export function normalizeFix(position, now = Date.now()) {
  const c = position?.coords;
  if (
    !c ||
    !Number.isFinite(c.latitude) ||
    !Number.isFinite(c.longitude) ||
    Math.abs(c.latitude) > 90 ||
    Math.abs(c.longitude) > 180
  )
    return null;
  if (
    !Number.isFinite(position.timestamp) ||
    position.timestamp > now + 1000 ||
    now - position.timestamp > FIX_MAX_AGE
  )
    return null;
  // Read each property explicitly: GeolocationCoordinates properties can be prototype getters on Safari.
  return {
    latitude: c.latitude,
    longitude: c.longitude,
    accuracy:
      Number.isFinite(c.accuracy) && c.accuracy >= 0 ? c.accuracy : null,
    speed: Number.isFinite(c.speed) && c.speed >= 0 ? c.speed : null,
    timestamp: position.timestamp,
  };
}
export function createGpsController({
  geolocation,
  secure = true,
  now = Date.now,
  onChange = () => {},
  onFix = () => {},
  onClear = () => {},
}) {
  const state = {
    enabled: false,
    active: false,
    suspended: false,
    denied: false,
    status: "GPS non attivo",
    fix: null,
    error: null,
    live: false,
  };
  let watchId = null,
    generation = 0;
  const emit = () => onChange({ ...state });
  function clearLive() {
    state.live = false;
    onClear();
  }
  function stopWatch() {
    generation++;
    if (watchId !== null) geolocation?.clearWatch(watchId);
    watchId = null;
    state.active = false;
    clearLive();
  }
  function fail(code, message, detail = "") {
    state.error = { code, message, detail, timestamp: now() };
    state.status = message;
    clearLive();
    emit();
  }
  function start() {
    if (!state.enabled || state.suspended || state.active || state.denied)
      return;
    if (!secure || !geolocation) {
      fail("UNAVAILABLE", "GPS richiede HTTPS e un browser compatibile");
      return;
    }
    const token = ++generation;
    state.active = true;
    state.status = "In attesa del segnale…";
    emit();
    try {
      const id = geolocation.watchPosition(
        (position) => {
          if (token !== generation) return;
          const fix = normalizeFix(position, now());
          if (!fix) {
            fail(
              "INVALID_FIX",
              "Coordinate non valide o aggiornamento GPS scaduto",
            );
            return;
          }
          state.fix = fix;
          state.error = null;
          try {
            onFix(fix);
            state.live = true;
            state.status =
              fix.speed === null
                ? "Posizione disponibile · velocità non disponibile"
                : "Segnale GPS disponibile";
          } catch {
            state.error = {
              code: "MAP",
              message:
                "Posizione ricevuta, errore di visualizzazione sulla mappa",
              timestamp: now(),
            };
            state.status = state.error.message;
            clearLive();
          }
          emit();
        },
        (error) => {
          if (token !== generation) return;
          if (error.code === 1) {
            state.denied = true;
            stopWatch();
          }
          fail(
            error.code,
            error.code === 1
              ? "Permesso GPS negato"
              : error.code === 3
                ? "Tempo di attesa GPS scaduto"
                : "Posizione GPS non disponibile",
            typeof error.message === "string" ? error.message : "",
          );
          // Transient errors leave the watch alive so a later valid fix can recover without another tap.
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
      );
      if (token === generation && state.active) watchId = id;
      else geolocation.clearWatch(id);
    } catch {
      stopWatch();
      fail("START", "Impossibile avviare il GPS. Riprova.");
    }
  }
  return {
    getState: () => ({ ...state }),
    setEnabled(enabled) {
      state.enabled = enabled;
      if (enabled) {
        state.denied = false;
        start();
      } else {
        stopWatch();
        state.denied = false;
        state.status = "GPS non attivo";
      }
      emit();
    },
    retry() {
      stopWatch();
      state.denied = false;
      state.error = null;
      start();
    },
    suspend() {
      state.suspended = true;
      stopWatch();
      state.status = state.enabled
        ? "GPS sospeso in background"
        : "GPS non attivo";
      emit();
    },
    resume() {
      state.suspended = false;
      if (state.denied) {
        state.status = "Permesso GPS negato";
        emit();
      } else start();
    },
    tick() {
      if (state.live && now() - state.fix.timestamp > FIX_MAX_AGE) {
        clearLive();
        state.status = "Segnale GPS scaduto · in attesa";
      }
      emit();
    },
  };
}
