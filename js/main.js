/* ============================================
   ÉDITIONS KILETON — Scripts principaux
   ============================================ */

(function () {
    'use strict';

    /* --- Header scroll effect --- */
    const header = document.querySelector('.site-header');
    let lastScroll = 0;

    function handleHeaderScroll() {
        const scrollY = window.scrollY;
        if (scrollY > 60) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        lastScroll = scrollY;
    }

    window.addEventListener('scroll', handleHeaderScroll, { passive: true });
    handleHeaderScroll();

    /* --- Menu latéral (drawer) ---
       Déclencheur unique « Menu » -> panneau glissant Mode Nuit.
       Accessibilité : focus déplacé dans le panneau, focus trap,
       fermeture Échap / overlay / bouton, retour du focus au déclencheur,
       scroll du body verrouillé. */
    const menuToggle    = document.querySelector('.menu-toggle');
    const drawer        = document.getElementById('site-drawer');
    const drawerOverlay = document.querySelector('.drawer-overlay');
    const drawerClose   = drawer ? drawer.querySelector('.drawer-close') : null;

    if (menuToggle && drawer && drawerOverlay) {
        const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
        let lastFocused = null;

        function getFocusable() {
            return Array.prototype.slice.call(drawer.querySelectorAll(FOCUSABLE));
        }

        function openDrawer() {
            lastFocused = document.activeElement;
            drawer.classList.add('is-open');
            drawerOverlay.classList.add('is-open');
            drawer.setAttribute('aria-hidden', 'false');
            menuToggle.setAttribute('aria-expanded', 'true');
            document.body.classList.add('drawer-open');

            // Déplacer le focus dans le panneau (bouton fermer en priorité)
            const focusables = getFocusable();
            (drawerClose || focusables[0] || drawer).focus();

            document.addEventListener('keydown', onKeydown);
        }

        function closeDrawer(returnFocus) {
            drawer.classList.remove('is-open');
            drawerOverlay.classList.remove('is-open');
            drawer.setAttribute('aria-hidden', 'true');
            menuToggle.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('drawer-open');

            document.removeEventListener('keydown', onKeydown);

            // Retour du focus sur le déclencheur (sauf si on navigue via un lien)
            if (returnFocus !== false && lastFocused &&
                typeof lastFocused.focus === 'function') {
                lastFocused.focus();
            }
        }

        function onKeydown(e) {
            if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                closeDrawer();
                return;
            }

            // Focus trap : maintenir la tabulation dans le panneau
            if (e.key === 'Tab') {
                const focusables = getFocusable();
                if (focusables.length === 0) { return; }
                const first = focusables[0];
                const last = focusables[focusables.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }

        menuToggle.addEventListener('click', openDrawer);
        drawerOverlay.addEventListener('click', function () { closeDrawer(); });

        if (drawerClose) {
            drawerClose.addEventListener('click', function () { closeDrawer(); });
        }

        // Fermer en cliquant un lien du drawer ; la navigation prend le relais
        drawer.querySelectorAll('a[href]').forEach(function (link) {
            link.addEventListener('click', function () {
                closeDrawer(false);
            });
        });

        // Sous-menu extensible « La France des Talents » (tap / clic).
        // Le survol desktop est géré en CSS ; ici on gère le clic/tap.
        var workParent = drawer.querySelector('.work-card--parent');
        if (workParent) {
            var workGroup = workParent.closest('.work-group');
            workParent.addEventListener('click', function () {
                var isOpen = workGroup.classList.toggle('open');
                workParent.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            });
            // Replier le sous-menu quand on referme le drawer
            drawer.addEventListener('transitionend', function () {
                if (!drawer.classList.contains('is-open')) {
                    workGroup.classList.remove('open');
                    workParent.setAttribute('aria-expanded', 'false');
                }
            });
        }
    }

    /* --- Fade-in on scroll (Intersection Observer) --- */
    const fadeElements = document.querySelectorAll('.fade-in');

    if (fadeElements.length > 0 && 'IntersectionObserver' in window) {
        const fadeObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    fadeObserver.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px'
        });

        fadeElements.forEach(function (el) {
            fadeObserver.observe(el);
        });
    } else {
        // Fallback: show all elements
        fadeElements.forEach(function (el) {
            el.classList.add('visible');
        });
    }

    /* --- Particles (home page only) --- */
    const canvas = document.getElementById('particles-canvas');

    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        let animationId;

        function resizeCanvas() {
            canvas.width = canvas.parentElement.offsetWidth;
            canvas.height = canvas.parentElement.offsetHeight;
        }

        function createParticles() {
            particles = [];
            const count = Math.min(40, Math.floor(canvas.width * canvas.height / 25000));
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    size: Math.random() * 2 + 0.5,
                    speedY: -(Math.random() * 0.3 + 0.1),
                    speedX: (Math.random() - 0.5) * 0.2,
                    opacity: Math.random() * 0.5 + 0.2,
                    opacityDir: (Math.random() - 0.5) * 0.005
                });
            }
        }

        function animateParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach(function (p) {
                // Update position
                p.y += p.speedY;
                p.x += p.speedX;

                // Flicker opacity
                p.opacity += p.opacityDir;
                if (p.opacity > 0.7 || p.opacity < 0.1) {
                    p.opacityDir *= -1;
                }

                // Reset if out of bounds
                if (p.y < -10) {
                    p.y = canvas.height + 10;
                    p.x = Math.random() * canvas.width;
                }

                // Draw
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(212, 175, 55, ' + p.opacity + ')';
                ctx.fill();
            });

            animationId = requestAnimationFrame(animateParticles);
        }

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

        function initParticles() {
            if (prefersReducedMotion.matches) {
                return;
            }
            resizeCanvas();
            createParticles();
            animateParticles();
        }

        initParticles();

        window.addEventListener('resize', function () {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            resizeCanvas();
            createParticles();
            if (!prefersReducedMotion.matches) {
                animateParticles();
            }
        });

        prefersReducedMotion.addEventListener('change', function () {
            if (prefersReducedMotion.matches) {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            } else {
                initParticles();
            }
        });
    }

})();

// ── Ambient Audio — livre.html only ──────────────────────────────────────
if (document.body.classList.contains('page-book')) {
  const audio   = document.getElementById('ambient-audio');
  const btn     = document.getElementById('audio-toggle');
  const iconOn  = document.getElementById('icon-sound-on');
  const iconOff = document.getElementById('icon-sound-off');

  if (audio && btn) {
    audio.volume = 0.35;

    function setMuted(muted) {
      audio.muted = muted;
      btn.classList.toggle('is-muted', muted);
      iconOn.style.display  = muted ? 'none' : '';
      iconOff.style.display = muted ? ''     : 'none';
      btn.setAttribute('aria-label', muted
        ? "Activer la musique d'ambiance"
        : "Couper la musique d'ambiance");
      try { localStorage.setItem('kileton-ambient-muted', muted ? '1' : '0'); } catch(e) {}
    }

    // Respecter la préférence précédente de l'utilisateur
    const savedMuted = (() => {
      try { return localStorage.getItem('kileton-ambient-muted') === '1'; } catch(e) { return false; }
    })();

    // Tenter l'autoplay avec son activé
    audio.muted = false;
    audio.play().then(() => {
      // Autoplay autorisé : respecter la préférence utilisateur
      setMuted(savedMuted);
    }).catch(() => {
      // Autoplay bloqué : afficher muet, lancer à la première interaction
      setMuted(true);
      function resumeOnInteraction() {
        audio.play().then(() => {
          setMuted(savedMuted);
        }).catch(() => {});
        document.removeEventListener('click', resumeOnInteraction);
        document.removeEventListener('scroll', resumeOnInteraction);
        document.removeEventListener('keydown', resumeOnInteraction);
        document.removeEventListener('touchstart', resumeOnInteraction);
      }
      document.addEventListener('click', resumeOnInteraction, { once: false });
      document.addEventListener('scroll', resumeOnInteraction, { once: false, passive: true });
      document.addEventListener('keydown', resumeOnInteraction, { once: false });
      document.addEventListener('touchstart', resumeOnInteraction, { once: false, passive: true });
    });

    btn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play().then(() => setMuted(false)).catch(() => {});
      } else {
        setMuted(!audio.muted);
      }
    });

    // ── Clip YouTube — gestion audio croisée via IFrame API ─────────────
    const clipIframe = document.getElementById('clip-player');

    if (clipIframe && audio) {
      let ambientWasPlaying = false;
      let ytPlayer = null;
      const FADE_OUT_MS = 600;
      const FADE_IN_MS  = 800;
      const FADE_STEPS  = 20;

      function fadeAudio(audioEl, fromVol, toVol, durationMs, callback) {
        const steps = FADE_STEPS;
        const stepTime = durationMs / steps;
        const volStep = (toVol - fromVol) / steps;
        let currentStep = 0;

        const interval = setInterval(() => {
          currentStep++;
          audioEl.volume = Math.max(0, Math.min(1, fromVol + volStep * currentStep));
          if (currentStep >= steps) {
            clearInterval(interval);
            audioEl.volume = toVol;
            if (callback) callback();
          }
        }, stepTime);
      }

      function resumeAmbientIfNeeded() {
        if (ambientWasPlaying) {
          audio.volume = 0;
          audio.play().then(() => {
            fadeAudio(audio, 0, 0.35, FADE_IN_MS);
          }).catch(() => {});
        }
      }

      function initYTPlayer() {
        ytPlayer = new YT.Player('clip-player', {
          events: {
            onStateChange: function (event) {
              if (event.data === YT.PlayerState.PLAYING) {
                ambientWasPlaying = !audio.paused && !audio.muted;
                if (ambientWasPlaying) {
                  fadeAudio(audio, audio.volume, 0, FADE_OUT_MS, () => {
                    audio.pause();
                    audio.volume = 0.35;
                  });
                }
              }
              if (event.data === YT.PlayerState.PAUSED ||
                  event.data === YT.PlayerState.ENDED) {
                resumeAmbientIfNeeded();
              }
            }
          }
        });
      }

      // Charger l'API YouTube IFrame
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);

      // L'API peut être prête avant ou après notre callback
      if (window.YT && window.YT.Player) {
        initYTPlayer();
      } else {
        window.onYouTubeIframeAPIReady = initYTPlayer;
      }
    }
  }
}
