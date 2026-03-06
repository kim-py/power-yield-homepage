/* =============================================================
   POWER YIELD — main.js
   Shared JavaScript for all pages
   ============================================================= */

(function () {
  'use strict';

  /* ── 1. Nav scroll shadow ─────────────────────────────────── */
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => {
      if (window.scrollY > 40) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // run on load
  }

  /* ── 2. Mobile hamburger menu ─────────────────────────────── */
  const hamburger = document.querySelector('.nav__hamburger');
  const overlay   = document.querySelector('.nav__overlay');
  const closeBtn  = document.querySelector('.nav__overlay-close');

  function openMenu() {
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    hamburger && hamburger.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    hamburger && hamburger.setAttribute('aria-expanded', 'false');
  }

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      overlay && overlay.classList.contains('open') ? closeMenu() : openMenu();
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // Close on overlay link click
  if (overlay) {
    overlay.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });
  }

  /* ── 3. Active nav link ───────────────────────────────────── */
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__link, .nav__overlay .nav__link').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const linkFile = href.split('/').pop();
    if (
      linkFile === currentFile ||
      (currentFile === '' && linkFile === 'index.html') ||
      (currentFile === 'index.html' && linkFile === 'index.html')
    ) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });

  /* ── 4. Waitlist form handler ─────────────────────────────── */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setupWaitlistForms() {
    document.querySelectorAll('[data-form="waitlist"]').forEach(form => {
      const emailInput = form.querySelector('input[type="email"]');
      const successEl  = form.querySelector('.waitlist-form__success');
      const submitBtn  = form.querySelector('button[type="submit"]');
      const formRow    = form.querySelector('.waitlist-form__row');

      // If email already stored, show a gentle hint
      const stored = localStorage.getItem('py_waitlist_email');
      if (stored && emailInput) {
        emailInput.value = stored;
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const email = emailInput ? emailInput.value.trim() : '';

        if (!EMAIL_RE.test(email)) {
          if (emailInput) {
            emailInput.style.borderColor = '#C0392B';
            emailInput.focus();
          }
          return;
        }

        // Store in localStorage
        localStorage.setItem('py_waitlist_email', email);

        // Disable button during request
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Registering\u2026';
        }

        const source = form.dataset.source || 'unknown';

        fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, source }),
        })
          .then(function () {
            // Determine success message based on data attribute
            const msgType = form.dataset.successMsg || 'default';
            const messages = {
              confirm: "Thank you \u2014 check your inbox for a confirmation.",
              default: "You\u2019re on the list. We\u2019ll be in touch."
            };
            const msg = messages[msgType] || messages.default;

            // Update DOM
            if (successEl) {
              successEl.textContent = msg;
              successEl.classList.add('visible');
            }
            if (formRow) formRow.style.display = 'none';
            const noteEl = form.querySelector('.waitlist-form__note');
            if (noteEl) noteEl.style.display = 'none';
          })
          .catch(function () {
            // Re-enable button on network error
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Join the Waitlist \u2192';
            }
          });
      });
    });
  }

  setupWaitlistForms();

  /* ── 5. Project submission form handler ───────────────────── */
  const projectForm = document.querySelector('[data-form="project"]');
  if (projectForm) {
    projectForm.addEventListener('submit', function (e) {
      e.preventDefault();
      let valid = true;

      // Validate all required fields
      projectForm.querySelectorAll('[required]').forEach(field => {
        const wrapper = field.closest('.form-field');
        const val = field.value.trim();
        const isEmpty = val === '' || (field.tagName === 'SELECT' && val === '');
        const isEmailField = field.type === 'email';
        const emailInvalid = isEmailField && !EMAIL_RE.test(val);

        if (isEmpty || emailInvalid) {
          valid = false;
          if (wrapper) wrapper.classList.add('has-error');
          field.classList.add('error');
        } else {
          if (wrapper) wrapper.classList.remove('has-error');
          field.classList.remove('error');
        }
      });

      if (!valid) return;

      // Disable submit button during request
      const projSubmitBtn = projectForm.querySelector('button[type="submit"]');
      if (projSubmitBtn) {
        projSubmitBtn.disabled = true;
        projSubmitBtn.textContent = 'Sending\u2026';
      }

      // Collect form data
      var val = function (sel) { return (projectForm.querySelector(sel) || {}).value || ''; };
      const payload = {
        company_name:   val('#company-name'),
        contact_name:   val('#contact-name'),
        contact_email:  val('#contact-email'),
        project_name:   val('#project-name'),
        technology:     val('#tech-type'),
        volume_eur:     val('#project-volume'),
        target_irr:     val('#target-irr'),
        capacity_mw:    val('#capacity-mw'),
        duration_years: val('#duration-years'),
        revenue_type:   val('#revenue-type'),
        location:       val('#location'),
        region_code:    val('#region-code'),
        stage:          val('#project-stage'),
        description:    val('#description'),
      };

      fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function () {
          // Show success
          const successEl = projectForm.querySelector('.form-success');
          if (successEl) successEl.classList.add('visible');

          // Hide form fields (keep the grid, just hide inputs + submit)
          projectForm.querySelectorAll('.form-field, .form-submit-row').forEach(el => {
            el.style.display = 'none';
          });
        })
        .catch(function () {
          if (projSubmitBtn) {
            projSubmitBtn.disabled = false;
            projSubmitBtn.textContent = 'Send Project Overview \u2192';
          }
        });
    });

    // Live validation: clear error on input
    projectForm.querySelectorAll('[required]').forEach(field => {
      field.addEventListener('input', function () {
        const wrapper = field.closest('.form-field');
        if (field.value.trim()) {
          if (wrapper) wrapper.classList.remove('has-error');
          field.classList.remove('error');
        }
      });
    });
  }

  /* ── 6. Accordion ─────────────────────────────────────────── */
  document.querySelectorAll('.accordion-item').forEach(item => {
    const header = item.querySelector('.accordion-header');
    const panel  = item.querySelector('.accordion-panel');
    const inner  = item.querySelector('.accordion-panel__inner');

    if (!header || !panel) return;

    header.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      // Close all other items
      document.querySelectorAll('.accordion-item.open').forEach(openItem => {
        if (openItem !== item) {
          openItem.classList.remove('open');
          const p = openItem.querySelector('.accordion-panel');
          if (p) p.style.maxHeight = '0';
        }
      });

      if (isOpen) {
        item.classList.remove('open');
        panel.style.maxHeight = '0';
      } else {
        item.classList.add('open');
        panel.style.maxHeight = inner
          ? inner.scrollHeight + 'px'
          : panel.scrollHeight + 'px';
      }
    });
  });

  /* ── 7. Animated counters (IntersectionObserver) ─────────── */
  function animateCounter(el, target, suffix, duration) {
    const start     = performance.now();
    const isDecimal = target % 1 !== 0;

    function step(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = eased * target;

      el.textContent = (isDecimal ? value.toFixed(1) : Math.round(value)) + suffix;

      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const counterEls = document.querySelectorAll('.impact-metric__number[data-target]');
  if (counterEls.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.dataset.animated) {
          entry.target.dataset.animated = 'true';
          const raw    = entry.target.dataset.target;
          const suffix = entry.target.dataset.suffix || '';
          const target = parseFloat(raw);
          animateCounter(entry.target, target, suffix, 1500);
        }
      });
    }, { threshold: 0.3 });

    counterEls.forEach(el => observer.observe(el));
  }

  /* ── 8. Project listings filter (listings.html) ──────────── */
  const filterBar      = document.querySelector('.filter-bar');
  const listingsGrid   = document.getElementById('project-listings');
  const resultsCountEl = document.getElementById('results-count');

  if (filterBar && listingsGrid) {
    let activeTech   = 'all';
    let activeStatus = 'all';

    function applyFilters() {
      const cards   = listingsGrid.querySelectorAll('.project-card');
      let   visible = 0;

      cards.forEach(card => {
        const tech   = card.dataset.tech   || '';
        const status = card.dataset.status || '';
        const show   =
          (activeTech   === 'all' || tech   === activeTech) &&
          (activeStatus === 'all' || status === activeStatus);

        card.classList.toggle('project-card--hidden', !show);
        if (show) visible++;
      });

      if (resultsCountEl) {
        resultsCountEl.innerHTML =
          '<strong>' + visible + '</strong> project' + (visible !== 1 ? 's' : '');
      }

      // Show no-results message if needed
      let noResults = listingsGrid.querySelector('.no-results');
      if (visible === 0) {
        if (!noResults) {
          noResults = document.createElement('p');
          noResults.className = 'no-results';
          noResults.textContent = 'No projects match the selected filters.';
          listingsGrid.appendChild(noResults);
        }
      } else {
        if (noResults) noResults.remove();
      }
    }

    filterBar.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type  = btn.dataset.filterType;
        const value = btn.dataset.filterValue;

        // Update active button within the same group
        filterBar.querySelectorAll(`.filter-btn[data-filter-type="${type}"]`).forEach(b => {
          b.classList.remove('active');
        });
        btn.classList.add('active');

        if (type === 'tech')   activeTech   = value;
        if (type === 'status') activeStatus = value;

        applyFilters();
      });
    });

    // Init progress bars (animate on load)
    listingsGrid.querySelectorAll('.progress-bar__fill[data-pct]').forEach(bar => {
      const pct = parseFloat(bar.dataset.pct) || 0;
      requestAnimationFrame(() => { bar.style.width = pct + '%'; });
    });
  }

})();
