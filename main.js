/* Obligations & Contracts Learning Hub - application logic */
(() => {
    'use strict';

    const STORAGE_KEY = 'oblicon_saved_topics';
    const PASS_RATE = 0.75;
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const scrollBehavior = () =>
        matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ---------- Saved topics (localStorage, guarded) ---------- */
    function loadBookmarks() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
            return Array.isArray(data) ? data : [];
        } catch (e) {
            return [];
        }
    }
    let bookmarks = loadBookmarks();

    function persistBookmarks() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
        } catch (e) {
            showToast('Could not save: browser storage is unavailable.');
        }
    }

    /* ---------- Toast ---------- */
    let toastTimer;
    function showToast(message) {
        const toast = $('#toastNotification');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
    }

    /* ---------- Tabs ---------- */
    const tabs = $$('.nav-item[data-tab]');

    function switchTab(tabId) {
        tabs.forEach((t) => {
            const on = t.dataset.tab === tabId;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', String(on));
            t.tabIndex = on ? 0 : -1;
        });
        $$('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === tabId));
        if (tabId === 'bookmarks') renderSavedTopics();
    }

    $('.nav-container').addEventListener('keydown', (e) => {
        const i = tabs.indexOf(document.activeElement);
        if (i < 0) return;
        const next = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        tabs[next].focus();
        switchTab(tabs[next].dataset.tab);
    });

    /* ---------- Search & filter ---------- */
    const cards = $$('.topic-card');
    cards.forEach((c) => { c.dataset.search = c.textContent.toLowerCase(); });
    let filterTimer;

    function applyFilters() {
        const terms = $('#searchInput').value.toLowerCase().split(/\s+/).filter(Boolean);
        const category = $('#categoryFilter').value;
        let visible = 0;
        cards.forEach((c) => {
            const show = (category === 'ALL' || c.dataset.category === category) &&
                terms.every((t) => c.dataset.search.includes(t));
            c.hidden = !show;
            if (show) visible++;
        });
        $('#noResults').hidden = visible > 0;
    }

    $('#searchInput').addEventListener('input', () => {
        clearTimeout(filterTimer);
        filterTimer = setTimeout(applyFilters, 120);
    });
    $('#categoryFilter').addEventListener('change', applyFilters);

    /* ---------- Bookmarks ---------- */
    function toggleBookmark(id, title) {
        const i = bookmarks.findIndex((b) => b.id === id);
        if (i === -1) {
            bookmarks.push({ id, title });
            showToast(`Saved "${title}" to Reviewer`);
        } else {
            bookmarks.splice(i, 1);
            showToast('Removed from Reviewer');
        }
        persistBookmarks();
        updateBookmarkUI();
        renderSavedTopics();
    }

    function updateBookmarkUI() {
        const badge = $('#bookmarkBadge');
        if (badge) badge.textContent = bookmarks.length;
        cards.forEach((card) => {
            const btn = $('.bookmark-btn', card);
            if (!btn) return;
            const saved = bookmarks.some((b) => b.id === card.dataset.id);
            btn.classList.toggle('saved', saved);
            btn.setAttribute('aria-pressed', String(saved));
            $('.btn-text', btn).textContent = saved ? 'Saved' : 'Save';
        });
    }

    function renderSavedTopics() {
        const box = $('#savedContainer');
        if (!box) return;
        if (!bookmarks.length) {
            box.innerHTML = '<p class="empty-state">No saved topics yet. Press the ★ Save button on a lesson card to keep it here.</p>';
            return;
        }
        box.innerHTML = '<ul class="saved-list">' + bookmarks.map((b) => `
            <li class="saved-item">
                <strong>${esc(b.title)}</strong>
                <span class="saved-actions">
                    <button type="button" class="btn-small" data-action="view" data-id="${esc(b.id)}">View lesson</button>
                    <button type="button" class="btn-small btn-danger" data-action="remove" data-id="${esc(b.id)}" data-title="${esc(b.title)}">Remove</button>
                </span>
            </li>`).join('') + '</ul>';
    }

    function jumpToTopic(id) {
        const card = cards.find((c) => c.dataset.id === id);
        if (!card) return;
        $('#searchInput').value = '';
        $('#categoryFilter').value = 'ALL';
        applyFilters();
        switchTab('lessons');
        card.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
        card.classList.remove('flash');
        void card.offsetWidth; // restart the highlight animation
        card.classList.add('flash');
    }

    document.addEventListener('click', (e) => {
        const tab = e.target.closest('.nav-item[data-tab]');
        if (tab) return switchTab(tab.dataset.tab);

        const save = e.target.closest('[data-bookmark]');
        if (save) return toggleBookmark(save.dataset.bookmark, save.dataset.title);

        const action = e.target.closest('[data-action]');
        if (!action) return;
        if (action.dataset.action === 'view') jumpToTopic(action.dataset.id);
        if (action.dataset.action === 'remove') toggleBookmark(action.dataset.id, action.dataset.title);
    });

    window.addEventListener('storage', (e) => {
        if (e.key !== STORAGE_KEY) return;
        bookmarks = loadBookmarks();
        updateBookmarkUI();
        renderSavedTopics();
    });

    /* ---------- Flashcards (keyboard accessible) ---------- */
    function flip(card) {
        const on = card.classList.toggle('flipped');
        card.setAttribute('aria-pressed', String(on));
    }
    $$('.flashcard').forEach((card) => {
        card.setAttribute('role', 'button');
        card.setAttribute('aria-pressed', 'false');
        card.tabIndex = 0;
        card.addEventListener('click', () => flip(card));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(card); }
        });
    });

    /* ---------- Contract validator ---------- */
    const OUTCOMES = {
        void: { title: 'Void / inexistent contract (Art. 1409)', desc: 'Produces no legal effect from the beginning. It cannot be ratified, and the defect cannot be cured by prescription.' },
        unenforceable: { title: 'Unenforceable contract (Art. 1403)', desc: 'Valid in itself but cannot be enforced in court unless it is ratified (or, for the Statute of Frauds, unless it is put in the required form or partly performed).' },
        voidable: { title: 'Voidable contract (Art. 1390)', desc: 'Valid and binding until a court annuls it. The defect can be cured by ratification.' },
        rescissible: { title: 'Rescissible contract (Art. 1381)', desc: 'Valid and binding, but it may be rescinded because of economic damage (lesion) to a party or a third person, or fraud on creditors.' },
        valid: { title: 'Valid and binding contract (Art. 1318)', desc: 'Consent, a certain object, and cause are all present without defects. The contract has the force of law between the parties.' }
    };

    function classify(v) {
        const found = { void: [], unenforceable: [], voidable: [], rescissible: [] };
        if (v.consent === 'none') found.void.push('no consent');
        if (v.object === 'illegal') found.void.push('illegal object');
        if (v.object === 'impossible') found.void.push('impossible object');
        if (v.cause === 'false') found.void.push('unlawful cause');
        if (v.cause === 'absent') found.void.push('no cause');
        if (v.consent === 'both_incapable') found.unenforceable.push('both parties incapable');
        if (v.authority === 'no_authority') found.unenforceable.push('no authority to bind the principal');
        if (v.authority === 'statute_of_frauds') found.unenforceable.push('Statute of Frauds not complied with');
        if (v.consent === 'vitiated') found.voidable.push('vitiated consent');
        if (v.consent === 'minor') found.voidable.push('one party incapable');
        if (v.lesion === 'fraud_creditor') found.rescissible.push('intent to defraud creditors');
        if (v.lesion === 'ward_damage') found.rescissible.push('ward prejudiced by more than 1/4');

        const order = ['void', 'unenforceable', 'voidable', 'rescissible'];
        const key = order.find((k) => found[k].length) || 'valid';
        const others = order.filter((k) => k !== key).flatMap((k) => found[k]);
        return { key, others, main: found[key] };
    }

    function runContractCheck() {
        const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
        const result = classify({
            consent: val('valConsent'), object: val('valObject'), cause: val('valCause'),
            lesion: val('valLesion'), authority: val('valAuthority')
        });
        const outcome = OUTCOMES[result.key];
        const box = $('#checkerResultDisplay');
        if (!box) return;
        box.className = 'checker-result tone-' + result.key;
        $('#resultTitle').textContent = outcome.title;
        let text = outcome.desc;
        if (result.main.length) text += ` Defect: ${result.main.join(', ')}.`;
        if (result.others.length) text += ` Other defects also present: ${result.others.join(', ')}.`;
        $('#resultDesc').textContent = text;
    }

    $('#validatorForm').addEventListener('change', runContractCheck);
    $('#validatorForm').addEventListener('submit', (e) => e.preventDefault());

    /* ---------- Quiz ---------- */
    const quizForm = $('#quizForm');
    const questions = $$('.quiz-question');
    const banner = $('#scoreBanner');

    function setBanner(kind, message) {
        banner.className = 'score-banner ' + kind;
        banner.textContent = message;
    }

    function submitQuiz() {
        const unanswered = questions.filter((q) => !$('input:checked', q));
        if (unanswered.length) {
            const nums = unanswered.map((q) => q.dataset.q).join(', ');
            setBanner('warn', `Answer every question before submitting. Missing: ${nums}.`);
            unanswered[0].scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
            return;
        }
        let score = 0;
        questions.forEach((q) => {
            const correct = q.dataset.correct;
            const ok = $('input:checked', q).value === correct;
            if (ok) score++;
            $$('input', q).forEach((input) => {
                input.disabled = true;
                const label = input.closest('label');
                if (input.value === correct) label.classList.add('is-correct');
                else if (input.checked) label.classList.add('is-wrong');
            });
            $('.quiz-explanation', q).className = 'quiz-explanation show ' + (ok ? 'correct' : 'incorrect');
        });
        const total = questions.length;
        if (score / total >= PASS_RATE) {
            setBanner('pass', `Score: ${score} / ${total}. Strong grasp of Obligations & Contracts.`);
        } else {
            setBanner('fail', `Score: ${score} / ${total}. Review the lessons and flashcards, then retake the quiz.`);
        }
        $('#submitQuiz').hidden = true;
        $('#retakeQuiz').hidden = false;
        banner.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
    }

    function resetQuiz() {
        quizForm.reset();
        questions.forEach((q) => {
            $$('input', q).forEach((i) => { i.disabled = false; });
            $$('.option-label', q).forEach((l) => l.classList.remove('is-correct', 'is-wrong'));
            $('.quiz-explanation', q).className = 'quiz-explanation';
        });
        banner.className = 'score-banner';
        banner.textContent = '';
        $('#submitQuiz').hidden = false;
        $('#retakeQuiz').hidden = true;
        $('#quiz').scrollIntoView({ behavior: scrollBehavior() });
    }

    quizForm.addEventListener('submit', (e) => e.preventDefault());
    $('#submitQuiz').addEventListener('click', submitQuiz);
    $('#retakeQuiz').addEventListener('click', resetQuiz);

    /* ---------- Init ---------- */
    updateBookmarkUI();
    renderSavedTopics();
    runContractCheck();
})();
