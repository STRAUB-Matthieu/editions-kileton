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

    /* --- Mobile hamburger menu --- */
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function () {
            const isOpen = navLinks.classList.toggle('open');
            hamburger.classList.toggle('active');
            hamburger.setAttribute('aria-expanded', isOpen);
            document.body.style.overflow = isOpen ? 'hidden' : '';
        });

        // Close menu on link click
        navLinks.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', function () {
                navLinks.classList.remove('open');
                hamburger.classList.remove('active');
                hamburger.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
            });
        });

        // Close menu on outside click
        document.addEventListener('click', function (e) {
            if (navLinks.classList.contains('open') &&
                !navLinks.contains(e.target) &&
                !hamburger.contains(e.target)) {
                navLinks.classList.remove('open');
                hamburger.classList.remove('active');
                hamburger.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
            }
        });
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

    audio.muted = savedMuted;
    audio.play().then(() => {
      setMuted(savedMuted);
    }).catch(() => {
      // Autoplay bloqué par le navigateur : état muet par défaut
      setMuted(true);
    });

    btn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play().then(() => setMuted(false)).catch(() => {});
      } else {
        setMuted(!audio.muted);
      }
    });
  }
}
