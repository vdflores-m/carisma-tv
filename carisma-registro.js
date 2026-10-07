/**
 * CARISMA TV — módulo de registro para la web.
 * Incluir antes del script principal:  <script src="carisma-registro.js"></script>
 *
 * Uso:
 *   CarismaRegistro.isRegistered()                 → true/false
 *   await CarismaRegistro.register({...})          → { ok, nuevo, error }
 *   await CarismaRegistro.verify('correo o +52...') → { ok, existe, error }
 *   window.addEventListener('carisma:unlocked', fn) → se dispara al registrarse o verificarse
 */
(function () {
  // Pega aquí la URL de la Aplicación web de Apps Script (termina en /exec)
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwwXOnWrTVJjF8mDoRP3VNGznJjaj-sIIMVUhMP8OXI6FgYoziu8UI0teLzVF94tEPI/exec';

  var STORAGE_KEY = 'carisma_tv_registrado';
  var COOKIE_DAYS = 365;

  // Guarda los UTM de la primera visita para saber de dónde vienen los registros
  (function captureUtm() {
    try {
      var p = new URLSearchParams(location.search);
      ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) {
        if (p.get(k) && !sessionStorage.getItem(k)) sessionStorage.setItem(k, p.get(k));
      });
    } catch (e) {}
  })();

  function getUtm(k) {
    try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; }
  }

  function setCookie(name, value, days) {
    var d = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + d + '; path=/; SameSite=Lax' +
      (location.protocol === 'https:' ? '; Secure' : '');
  }

  function getCookie(name) {
    var m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : '';
  }

  function saveSession() {
    var v = String(Date.now());
    try { localStorage.setItem(STORAGE_KEY, v); } catch (e) {}
    setCookie(STORAGE_KEY, v, COOKIE_DAYS);
  }

  function isRegistered() {
    var ls = '';
    try { ls = localStorage.getItem(STORAGE_KEY) || ''; } catch (e) {}
    var ck = getCookie(STORAGE_KEY);
    // Si solo uno de los dos sobrevivió, restaura el otro
    if (ls && !ck) setCookie(STORAGE_KEY, ls, COOKIE_DAYS);
    if (ck && !ls) { try { localStorage.setItem(STORAGE_KEY, ck); } catch (e) {} }
    return !!(ls || ck);
  }

  function unlock(source) {
    saveSession();
    window.dispatchEvent(new CustomEvent('carisma:unlocked', { detail: { source: source } }));
  }

  function post(payload) {
    // text/plain evita el "preflight" CORS que Apps Script no soporta
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    }).then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, error: 'network' }; });
  }

  /**
   * data: { nombre, correo, telefono (+código de país y número, ej. +525512345678),
   *         idioma: 'ES'|'EN', consentimiento: true, canal: '7', website: '' (honeypot) }
   */
  function register(data) {
    var payload = {
      action: 'register',
      nombre: data.nombre || '',
      correo: data.correo || '',
      telefono: data.telefono || '',
      instagram: data.instagram || '',
      pais: data.pais || '',
      estado: data.estado || '',
      idioma: data.idioma || 'ES',
      consentimiento: !!data.consentimiento,
      canal: data.canal || '',
      website: data.website || '',
      utm_source: getUtm('utm_source'),
      utm_medium: getUtm('utm_medium'),
      utm_campaign: getUtm('utm_campaign')
    };
    return post(payload).then(function (res) {
      if (res && res.ok) {
        if (res.nuevo && typeof window.fbq === 'function') {
          window.fbq('track', 'CompleteRegistration');
        }
        unlock(res.nuevo ? 'register' : 'register_existing');
      }
      return res;
    });
  }

  function verify(identificador) {
    return post({ action: 'verify', identificador: identificador }).then(function (res) {
      if (res && res.ok && res.existe) unlock('verify');
      return res;
    });
  }

  // Mensajes de error listos en ES/EN
  var ERRORS = {
    ES: {
      missing_contact: 'Escribe tu correo o tu teléfono.',
      invalid_email: 'Revisa tu correo.',
      invalid_phone: 'Revisa tu teléfono (incluye la clave de país).',
      consent_required: 'Necesitamos tu autorización para enviarte mensajes.',
      not_found: 'No encontramos ese registro. Regístrate para desbloquear.',
      rate_limited: 'Demasiados intentos. Prueba en un rato.',
      network: 'Sin señal. Revisa tu conexión e inténtalo de nuevo.',
      default: 'Algo falló. Inténtalo de nuevo.'
    },
    EN: {
      missing_contact: 'Enter your email or phone number.',
      invalid_email: 'Check your email.',
      invalid_phone: 'Check your phone number (include country code).',
      consent_required: 'We need your permission to send you messages.',
      not_found: "We couldn't find that sign-up. Register to unlock.",
      rate_limited: 'Too many attempts. Try again later.',
      network: 'No signal. Check your connection and try again.',
      default: 'Something went wrong. Please try again.'
    }
  };

  function errorText(code, idioma) {
    var t = ERRORS[idioma === 'EN' ? 'EN' : 'ES'];
    return t[code] || t.default;
  }

  window.CarismaRegistro = {
    isRegistered: isRegistered,
    register: register,
    verify: verify,
    errorText: errorText
  };
})();
