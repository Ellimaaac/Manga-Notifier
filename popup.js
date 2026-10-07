// ============================================================
// Éléments du popup
// ============================================================

const $ = (selector) =>
    document.querySelector(selector);

const MAX_IMPORT_BYTES =
    5 * 1024 * 1024;

const list = $('#list');
const interval = $('#interval');
const msg = $('#msg');
const add = $('#add');
const input = $('#url');
const check = $('#check');
const importTxt = $('#importTxt');
const exportTxt = $('#exportTxt');
const txtFile = $('#txtFile');
const importJson = $('#importJson');
const exportJson = $('#exportJson');
const jsonFile = $('#jsonFile');
const lastGlobal = $('#lastGlobal');

const searchToggle = $('#searchToggle');
const searchWrap = $('#searchWrap');
const searchInput = $('#searchInput');
const searchClear = $('#searchClear');

const popupWidth = $('#popupWidth');
const popupWidthNumber = $('#popupWidthNumber');
const popupHeight = $('#popupHeight');
const popupHeightNumber = $('#popupHeightNumber');
const resetPopupSize = $('#resetPopupSize');
const requestSite = $('#requestSite');
const githubProject = $('#githubProject');
const settingsDetails = $('.settings');
const popupShell = $('.popup-shell');
const menuBackdrop = $('#menuBackdrop');
const importOverlay = $('#importOverlay');
const importOverlayTitle = $('#importOverlayTitle');
const importOverlaySubtitle = $('#importOverlaySubtitle');

const interfaceLanguage = $('#interfaceLanguage');
const appTitle = $('#appTitle');
const libraryLabel = $('#libraryLabel');
const intervalLabel = $('#intervalLabel');
const interfaceLanguageLabel = $('#interfaceLanguageLabel');
const archiveNote = $('#archiveNote');
const windowSizeTitle = $('#windowSizeTitle');
const popupWidthLabel = $('#popupWidthLabel');
const popupHeightLabel = $('#popupHeightLabel');
const chromeLimitNote = $('#chromeLimitNote');

const displayTitle = $('#displayTitle');
const sortLabel = $('#sortLabel');
const sortMode = $('#sortMode');
const densityLabel = $('#densityLabel');
const densityMode = $('#densityMode');


// ============================================================
// Utilitaires
// ============================================================

function escapeHtml(value) {
    return String(value ?? '').replace(
        /[&<>"']/g,
        (character) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]
    );
}

function getDateLocale() {
    const locales = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', it: 'it-IT', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', pt: 'pt-BR' };
    return locales[currentInterfaceLanguage] || 'fr-FR';
}

function parsePublicationDate(timestamp) {
    if (!timestamp) {
        return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
        const [year, month, day] =
            timestamp.split('-').map(Number);

        return new Date(
            year,
            month - 1,
            day,
            12,
            0,
            0
        );
    }

    const date = new Date(timestamp);

    return Number.isNaN(date.getTime())
        ? null
        : date;
}

function formatDateOnly(timestamp) {
    const date =
        parsePublicationDate(timestamp);

    if (!date) {
        return '—';
    }

    return new Intl.DateTimeFormat(
        getDateLocale(),
        {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }
    ).format(date);
}

function formatDate(timestamp) {
    const date =
        parsePublicationDate(timestamp);

    if (!date) {
        return '—';
    }

    return date.toLocaleString(
        getDateLocale()
    );
}

function formatSourceRelativeAge(value) {
    const text =
        String(value || '')
            .trim()
            .toLocaleLowerCase();

    if (!text) {
        return '';
    }

    const unitRegex =
        /(\d+(?:\.\d+)?)\s*(months?|weeks?|days?|hours?|hrs?|minutes?|mins?)/gi;

    let totalHours = 0;
    let matched = false;

    for (const match of text.matchAll(unitRegex)) {
        matched = true;

        const amount =
            Number(match[1]);

        const unit =
            match[2].toLowerCase();

        if (!Number.isFinite(amount)) {
            continue;
        }

        if (unit.startsWith('month')) {
            totalHours += amount * 30 * 24;
        } else if (unit.startsWith('week')) {
            totalHours += amount * 7 * 24;
        } else if (unit.startsWith('day')) {
            totalHours += amount * 24;
        } else if (
            unit.startsWith('hour') ||
            unit.startsWith('hr')
        ) {
            totalHours += amount;
        } else if (
            unit.startsWith('minute') ||
            unit.startsWith('min')
        ) {
            totalHours += amount / 60;
        }
    }

    if (!matched) {
        return text;
    }

    /*
     * À partir de 24 h :
     * on n'affiche plus les heures restantes.
     * Exemple : "4 days, 16 hours" -> "4 jours".
     */
    if (totalHours >= 24) {
        const days = Math.max(
            1,
            Math.floor(totalHours / 24)
        );

        return t(
            days === 1
                ? 'oneDay'
                : 'manyDays',
            {
                count: days
            }
        );
    }

    /*
     * Moins de 24 h :
     * heures uniquement.
     */
    if (totalHours >= 1) {
        const hours = Math.max(
            1,
            Math.floor(totalHours)
        );

        return t(
            hours === 1
                ? 'oneHour'
                : 'manyHours',
            {
                count: hours
            }
        );
    }

    return t('lessThanHour');
}


function formatPublication(item) {
    if (!item.publishedAt) {
        return item.publishedAgo
            ? t('publishedAgo', {
                age:
                    formatSourceRelativeAge(
                        item.publishedAgo
                    )
            })
            : t('noPublishedTime');
    }

    const date =
        parsePublicationDate(
            item.publishedAt
        );

    if (!date) {
        return t('published', {
            date: formatDateOnly(
                item.publishedAt
            )
        });
    }

    const elapsedMs =
        Date.now() - date.getTime();

    const hour =
        60 * 60 * 1000;

    const day =
        24 * hour;

    const week =
        7 * day;

    /*
     * Moins d'une semaine :
     * affichage relatif, sans minutes.
     */
    if (
        elapsedMs >= 0 &&
        elapsedMs < week
    ) {
        if (elapsedMs < day) {
            const hours = Math.max(
                1,
                Math.floor(
                    elapsedMs / hour
                )
            );

            return t('publishedAgo', {
                age: t(
                    hours === 1
                        ? 'oneHour'
                        : 'manyHours',
                    {
                        count: hours
                    }
                )
            });
        }

        const days = Math.max(
            1,
            Math.floor(
                elapsedMs / day
            )
        );

        return t('publishedAgo', {
            age: t(
                days === 1
                    ? 'oneDay'
                    : 'manyDays',
                {
                    count: days
                }
            )
        });
    }

    /*
     * Une semaine ou plus :
     * date uniquement, jamais l'heure.
     */
    return t('published', {
        date: formatDateOnly(
            item.publishedAt
        )
    });
}

function getSiteName(site) {
    switch (site) {
        case 'mangadex':
            return 'MangaDex';

        case 'mangafreak':
            return 'MangaFreak';

        case 'webtoon':
            return 'WEBTOON';

        case 'sushiscan':
            return 'SushiScan';

        case 'mgeko':
        default:
            return 'Mgeko';
    }
}


// ============================================================
// Mise en avant du menu réglages
// ============================================================


function syncSettingsBackdrop() {
    if (!settingsDetails || !popupShell) {
        return;
    }

    popupShell.classList.toggle(
        'menu-open',
        settingsDetails.open
    );
}

if (settingsDetails) {
    settingsDetails.addEventListener(
        'toggle',
        syncSettingsBackdrop
    );
}

if (menuBackdrop && settingsDetails) {
    menuBackdrop.addEventListener(
        'click',
        () => {
            settingsDetails.open = false;
            syncSettingsBackdrop();
        }
    );
}

document.addEventListener(
    'keydown',
    (event) => {
        if (
            event.key === 'Escape' &&
            settingsDetails?.open
        ) {
            settingsDetails.open = false;
            syncSettingsBackdrop();
        }
    }
);


// ============================================================
// Recherche dans la bibliothèque
// ============================================================

searchToggle.addEventListener(
    'click',
    () => {
        const isOpen =
            searchWrap.classList.toggle(
                'open'
            );

        if (isOpen) {
            searchInput.focus();
            searchInput.select();
        } else {
            searchInput.value = '';
            renderCurrentLibrary();
        }
    }
);

searchInput.addEventListener(
    'input',
    () => {
        renderCurrentLibrary();
    }
);

searchInput.addEventListener(
    'keydown',
    (event) => {
        if (event.key === 'Escape') {
            searchInput.value = '';
            searchWrap.classList.remove(
                'open'
            );
            renderCurrentLibrary();
        }
    }
);

searchClear.addEventListener(
    'click',
    () => {
        searchInput.value = '';
        renderCurrentLibrary();
        searchInput.focus();
    }
);


// ============================================================
// Demande d'ajout de site
// ============================================================

requestSite.addEventListener(
    'click',
    () => {
        chrome.tabs.create({
            url: 'https://github.com/Ellimaaac/Manga-Update-Notifier/issues/new'
        });
    }
);


githubProject.addEventListener(
    'click',
    () => {
        chrome.tabs.create({
            url: 'https://github.com/Ellimaaac/Manga-Update-Notifier'
        });
    }
);


// ============================================================
// Sauvegarde JSON complète
// ============================================================

exportJson.addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({ type: 'EXPORT_JSON' });
    if (response?.error) { msg.textContent = response.error; msg.className = 'muted err'; return; }
    const blob = new Blob([response.text], { type: 'application/json;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl; link.download = 'manga-notifier-backup.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    msg.textContent = t('jsonExported'); msg.className = 'muted ok';
});

importJson.addEventListener('click', () => jsonFile.click());
jsonFile.addEventListener('change', async () => {
    const file =
        jsonFile.files?.[0];

    if (!file) {
        return;
    }

    if (
        file.size >
        MAX_IMPORT_BYTES
    ) {
        msg.textContent =
            t('importTooLarge');

        msg.className =
            'muted err';

        jsonFile.value = '';
        return;
    }

    let text = '';
    try { text = await file.text(); JSON.parse(text); }
    catch { msg.textContent = t('jsonInvalid'); msg.className = 'muted err'; jsonFile.value = ''; return; }
    const response = await chrome.runtime.sendMessage({ type: 'IMPORT_JSON', text });
    jsonFile.value = '';
    if (response?.error) { msg.textContent = response.error; msg.className = 'muted err'; return; }
    msg.textContent = t('jsonImported'); msg.className = 'muted ok'; await load();
});

// ============================================================
// Langue de l'interface
// ============================================================

let currentInterfaceLanguage = DEFAULT_INTERFACE_LANGUAGE;

function t(key, variables = {}) {
    const table =
        I18N[currentInterfaceLanguage] ||
        I18N[DEFAULT_INTERFACE_LANGUAGE];

    let value =
        table[key] ??
        I18N[DEFAULT_INTERFACE_LANGUAGE][key] ??
        key;

    for (const [name, replacement] of Object.entries(variables)) {
        value = value.replaceAll(
            `{${name}}`,
            String(replacement)
        );
    }

    return value;
}

function updateIntervalLabels() {
    const table =
        I18N[currentInterfaceLanguage] ||
        I18N[DEFAULT_INTERFACE_LANGUAGE];

    const labels =
        table.intervalLabels ||
        I18N[DEFAULT_INTERFACE_LANGUAGE].intervalLabels;

    for (const option of interval.options) {
        option.textContent =
            labels[option.value] ||
            option.value;
    }
}


function setImportOverlayState(isOpen) {
    if (!popupShell || !importOverlay) {
        return;
    }

    popupShell.classList.toggle(
        'importing',
        !!isOpen
    );

    importOverlay.classList.toggle(
        'open',
        !!isOpen
    );

    importOverlay.setAttribute(
        'aria-hidden',
        isOpen ? 'false' : 'true'
    );
}


function updateImportOverlayText() {
    if (!importOverlayTitle || !importOverlaySubtitle) {
        return;
    }

    importOverlayTitle.textContent = t('importProgressTitle');
    importOverlaySubtitle.textContent = t('importProgressSubtitle');
}


function updateRequestSiteLabel() {
    if (!requestSite) {
        return;
    }

    const label = t('requestSite');

    requestSite.textContent = label;
    requestSite.title = label;
    requestSite.setAttribute(
        'aria-label',
        label
    );
}


function applyInterfaceLanguage(language) {
    currentInterfaceLanguage =
        I18N[language]
            ? language
            : DEFAULT_INTERFACE_LANGUAGE;

    document.documentElement.lang =
        currentInterfaceLanguage;

    interfaceLanguage.value =
        currentInterfaceLanguage;

    appTitle.textContent = t('appTitle');
    libraryLabel.textContent = t('library');
    intervalLabel.textContent = t('interval');
    updateIntervalLabels();
    interfaceLanguageLabel.textContent = t('language');
    archiveNote.textContent = t('archiveNote');
    windowSizeTitle.textContent = t('windowSize');
    popupWidthLabel.textContent = t('width');
    popupHeightLabel.textContent = t('height');
    resetPopupSize.textContent = t('resetSize');
    if (chromeLimitNote) {
        chromeLimitNote.textContent =
            t('chromeLimit');
    }

    displayTitle.textContent = t('displayTitle');
    sortLabel.textContent = t('sort');
    densityLabel.textContent = t('density');

    const sortLabels = {
        recent: t('sortRecent'),
        title: t('sortTitle'),
        source: t('sortSource')
    };

    for (const option of sortMode.options) {
        option.textContent =
            sortLabels[option.value] ||
            option.value;
    }

    const densityLabels = {
        normal: t('densityNormal'),
        compact: t('densityCompact')
    };

    for (const option of densityMode.options) {
        option.textContent =
            densityLabels[option.value] ||
            option.value;
    }

    input.placeholder = t('urlPlaceholder');
    add.textContent = t('add');
    importTxt.textContent = t('importTxt');
    exportTxt.textContent = t('exportTxt');

    importTxt.title = t('importTxtTitle');
    importTxt.setAttribute(
        'aria-label',
        t('importTxtTitle')
    );

    exportTxt.title = t('exportTxtTitle');
    exportTxt.setAttribute(
        'aria-label',
        t('exportTxtTitle')
    );

    importJson.textContent = t('importJson');
    exportJson.textContent = t('exportJson');
    importJson.title = t('importJsonTitle');
    importJson.setAttribute('aria-label', t('importJsonTitle'));
    exportJson.title = t('exportJsonTitle');
    exportJson.setAttribute('aria-label', t('exportJsonTitle'));

    const settingsSummary =
        document.querySelector('.settings > summary');

    settingsSummary.title = t('settingsTitle');
    settingsSummary.setAttribute(
        'aria-label',
        t('settingsTitle')
    );

    check.title = t('checkNow');
    check.setAttribute(
        'aria-label',
        t('checkNow')
    );

    searchToggle.title = t('search');
    searchToggle.setAttribute(
        'aria-label',
        t('search')
    );

    searchInput.placeholder =
        t('searchPlaceholder');

    searchClear.title =
        t('clearSearch');

    searchClear.setAttribute(
        'aria-label',
        t('clearSearch')
    );

    updateRequestSiteLabel();

    if (requestSite) {
        requestSite.textContent =
            t('requestSite');
    }

    if (githubProject) {
        const githubLabel = t('githubProject');
        githubProject.title = githubLabel;
        githubProject.setAttribute(
            'aria-label',
            githubLabel
        );
    }
    updateImportOverlayText();
}



// ============================================================
// Taille du popup
// ============================================================

const DEFAULT_POPUP_WIDTH = 410;
const DEFAULT_POPUP_HEIGHT = 600;

function clamp(value, min, max) {
    return Math.min(
        max,
        Math.max(min, Number(value) || min)
    );
}

function applyPopupSize(width, height) {
    const safeWidth =
        clamp(width, 360, 800);

    const safeHeight =
        clamp(height, 300, 600);

    document.documentElement.style.setProperty(
        '--popup-width',
        `${safeWidth}px`
    );

    document.documentElement.style.setProperty(
        '--popup-height',
        `${safeHeight}px`
    );

    popupWidth.value = String(safeWidth);
    popupWidthNumber.value = String(safeWidth);

    popupHeight.value = String(safeHeight);
    popupHeightNumber.value = String(safeHeight);

    // Force le navigateur à recalculer immédiatement la taille du document.
    void document.documentElement.offsetHeight;
}

async function savePopupSize(width, height) {
    const safeWidth =
        clamp(width, 360, 800);

    const safeHeight =
        clamp(height, 300, 600);

    await chrome.storage.local.set({
        popupWidth: safeWidth,
        popupHeight: safeHeight
    });

    applyPopupSize(
        safeWidth,
        safeHeight
    );
}

function bindSizePair(rangeInput, numberInput, key) {
    rangeInput.addEventListener(
        'input',
        () => {
            numberInput.value =
                rangeInput.value;

            if (key === 'width') {
                applyPopupSize(
                    rangeInput.value,
                    popupHeight.value
                );
            } else {
                applyPopupSize(
                    popupWidth.value,
                    rangeInput.value
                );
            }
        }
    );

    rangeInput.addEventListener(
        'change',
        async () => {
            await savePopupSize(
                popupWidth.value,
                popupHeight.value
            );
        }
    );

    numberInput.addEventListener(
        'change',
        async () => {
            if (key === 'width') {
                await savePopupSize(
                    numberInput.value,
                    popupHeight.value
                );
            } else {
                await savePopupSize(
                    popupWidth.value,
                    numberInput.value
                );
            }
        }
    );
}


// ============================================================
// Affichage de la bibliothèque
// ============================================================

let currentLibrary = [];

function renderCover(item) {
    if (item.coverUrl) {
        return `
            <div class="cover-wrap">
                <img
                    class="cover-image"
                    src="${escapeHtml(item.coverUrl)}"
                    alt=""
                    referrerpolicy="no-referrer"
                    loading="lazy"
                >
            </div>
        `;
    }

    return `
        <div class="cover-wrap">
            <div class="cover-placeholder">Manga</div>
        </div>
    `;
}


function matchesSearch(item, query) {
    const normalizedQuery =
        String(query || '')
            .trim()
            .toLocaleLowerCase();

    if (!normalizedQuery) {
        return true;
    }

    const siteName =
        getSiteName(item.site);

    const haystack = [
        item.title,
        item.url,
        siteName,
        item.latestChapter,
        item.publishedAgo,
        item.publishedAt
    ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();

    return haystack.includes(
        normalizedQuery
    );
}

function renderCurrentLibrary() {
    const filtered =
        currentLibrary.filter(
            (item) =>
                matchesSearch(
                    item,
                    searchInput.value
                )
        );

    render(filtered);
}


function sortLibrary(library) {
    const mode =
        sortMode?.value || 'recent';

    return [...library].sort(
        (a, b) => {
            if (mode === 'title') {
                return String(
                    a.title ||
                    a.url
                ).localeCompare(
                    String(
                        b.title ||
                        b.url
                    ),
                    getDateLocale(),
                    {
                        sensitivity: 'base'
                    }
                );
            }

            if (mode === 'source') {
                const sourceCompare =
                    getSiteName(a.site)
                        .localeCompare(
                            getSiteName(b.site),
                            getDateLocale(),
                            {
                                sensitivity: 'base'
                            }
                        );

                if (sourceCompare) {
                    return sourceCompare;
                }

                return String(
                    a.title || a.url
                ).localeCompare(
                    String(
                        b.title || b.url
                    ),
                    getDateLocale(),
                    {
                        sensitivity: 'base'
                    }
                );
            }

            // Par défaut : nouveautés puis publications récentes.
            if (!!a.unread !== !!b.unread) {
                return a.unread ? -1 : 1;
            }

            const timeA = a.unread
                ? (a.detectedAt || 0)
                : (
                    a.publishedAt
                        ? Date.parse(a.publishedAt) || 0
                        : (
                            a.detectedAt ||
                            a.lastCheck ||
                            0
                        )
                );

            const timeB = b.unread
                ? (b.detectedAt || 0)
                : (
                    b.publishedAt
                        ? Date.parse(b.publishedAt) || 0
                        : (
                            b.detectedAt ||
                            b.lastCheck ||
                            0
                        )
                );

            return timeB - timeA;
        }
    );
}


function render(library) {
    const sortedLibrary =
        sortLibrary(library);

    list.innerHTML = '';

    if (!sortedLibrary.length) {
        list.innerHTML =
            '<div class="card empty muted">' +
            escapeHtml(t('empty')) +
            '</div>';

        return;
    }

    for (const item of sortedLibrary) {
        const siteName =
            getSiteName(item.site);

        const publication =
            formatPublication(item);

        const card =
            document.createElement('div');

        card.className =
            'card item' +
            (item.unread ? ' unread' : '');

        const newBadge = item.unread
            ? `<span class="new">• ${escapeHtml(t('new'))}</span>`
            : '';

        const errorText = item.lastError
            ? ` • ${escapeHtml(t('error'))} : ${escapeHtml(item.lastError)}`
            : '';


        const coverMarkup =
            renderCover(item);

        card.innerHTML = `
            <div class="item-layout">
                ${coverMarkup}

                <div class="item-main">
                    <div class="topline">
                        <div class="title">
                            ${escapeHtml(item.title || item.url)}
                            <span class="muted">
                                • ${escapeHtml(siteName)}
                            </span>
                        </div>

                        <div class="compact-actions">
                            <button
                                class="secondary open"
                                title="${escapeHtml(t('open'))}"
                                aria-label="${escapeHtml(t('open'))}"
                            >
                                ↗
                            </button>

                            <button
                                class="danger remove"
                                title="${escapeHtml(t('remove'))}"
                                aria-label="${escapeHtml(t('remove'))}"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    <div class="bottomline">
                        <div class="chapter">
                            ${escapeHtml(t('chapter'))} ${escapeHtml(item.latestChapter ?? '—')}
                            ${newBadge}
                        </div>

                        <div class="meta ${item.lastError ? 'err' : ''}">
                            • ${escapeHtml(publication)}
                            ${errorText}
                        </div>
                    </div>
                </div>
            </div>
        `;

        const coverImage =
            card.querySelector('.cover-image');

        if (coverImage) {
            coverImage.addEventListener(
                'error',
                () => {
                    const wrapper =
                        coverImage.parentElement;

                    if (wrapper) {
                        wrapper.innerHTML =
                            '<div class="cover-placeholder">Manga</div>';
                    }
                },
                { once: true }
            );
        }

        card
            .querySelector('.open')
            .addEventListener(
                'click',
                async () => {
                    await chrome.runtime.sendMessage({
                        type: 'MARK_READ',
                        url: item.url
                    });

                    const opened =
                        await chrome.runtime.sendMessage({
                            type: 'OPEN_URL',
                            url: item.url
                        });

                    if (opened?.error) {
                        msg.textContent =
                            opened.error;

                        msg.className =
                            'muted err';
                    }

                    await load();
                }
            );

        card
            .querySelector('.remove')
            .addEventListener(
                'click',
                async () => {
                    await chrome.runtime.sendMessage({
                        type: 'REMOVE_URL',
                        url: item.url
                    });

                    await load();
                }
            );

        list.appendChild(card);
    }
}


// ============================================================
// Chargement du popup
// ============================================================

async function load() {
    const data =
        await chrome.storage.local.get([
            'library',
            'intervalMinutes',
            'popupWidth',
            'popupHeight',
            'interfaceLanguage',
            'sortMode',
            'densityMode'
        ]);

    interval.value = String(
        data.intervalMinutes || 60
    );

    applyPopupSize(
        data.popupWidth || DEFAULT_POPUP_WIDTH,
        data.popupHeight || DEFAULT_POPUP_HEIGHT
    );

    applyInterfaceLanguage(
        data.interfaceLanguage ||
        DEFAULT_INTERFACE_LANGUAGE
    );

    sortMode.value =
        data.sortMode || 'recent';

    densityMode.value =
        data.densityMode || 'normal';

    document
        .querySelector('.popup-shell')
        ?.classList.toggle(
            'compact-view',
            densityMode.value === 'compact'
        );

    const library =
        Array.isArray(data.library)
            ? data.library
            : [];

    currentLibrary = library;

    const checks = library
        .map(
            (item) =>
                Number(item.lastCheck) || 0
        )
        .filter(Boolean);

    lastGlobal.textContent =
        checks.length
            ? t('lastChecked', {
                date: formatDate(Math.max(...checks))
            })
            : t('lastNever');

    renderCurrentLibrary();
}


// ============================================================
// Ajouter une lecture
// ============================================================

add.addEventListener(
    'click',
    async () => {
        msg.textContent = t('adding');
        msg.className = 'muted';

        add.disabled = true;

        const response =
            await chrome.runtime.sendMessage({
                type: 'ADD_URL',
                url: input.value
            });

        add.disabled = false;

        if (response?.error) {
            msg.textContent =
                response.error;

            msg.className =
                'muted err';

            return;
        }

        input.value = '';

        msg.textContent =
            t('added');

        msg.className =
            'muted ok';

        await load();
    }
);

input.addEventListener(
    'keydown',
    (event) => {
        if (event.key === 'Enter') {
            add.click();
        }
    }
);


// ============================================================
// Vérification manuelle
// ============================================================

check.addEventListener(
    'click',
    async () => {
        check.disabled = true;
        check.textContent = '…';

        await chrome.runtime.sendMessage({
            type: 'CHECK_ALL'
        });

        await load();

        check.disabled = false;
        check.textContent = '↻';
    }
);


// ============================================================
// Intervalle de vérification
// ============================================================

interval.addEventListener(
    'change',
    async () => {
        await chrome.storage.local.set({
            intervalMinutes:
                Number(interval.value)
        });

        await chrome.runtime.sendMessage({
            type: 'RESET_ALARM'
        });
    }
);


// ============================================================
// Export TXT
// ============================================================

exportTxt.addEventListener(
    'click',
    async () => {
        const response =
            await chrome.runtime.sendMessage({
                type: 'EXPORT_TXT'
            });

        if (response?.error) {
            msg.textContent =
                response.error;

            msg.className =
                'muted err';

            return;
        }

        const blob = new Blob(
            [response.text],
            {
                type: 'text/plain;charset=utf-8'
            }
        );

        const objectUrl =
            URL.createObjectURL(blob);

        const link =
            document.createElement('a');

        link.href = objectUrl;
        link.download = 'manga-library.txt';
        link.click();

        setTimeout(
            () => URL.revokeObjectURL(objectUrl),
            1000
        );

        msg.textContent =
            t('exported', {
                count: response.count
            });

        msg.className =
            'muted ok';
    }
);


// ============================================================
// Import TXT
// ============================================================

importTxt.addEventListener(
    'click',
    () => {
        txtFile.click();
    }
);

txtFile.addEventListener(
    'change',
    async () => {
        const file =
            txtFile.files?.[0];

        if (!file) {
            return;
        }

        if (
            file.size >
            MAX_IMPORT_BYTES
        ) {
            msg.textContent =
                t('importTooLarge');

            msg.className =
                'muted err';

            txtFile.value = '';
            return;
        }

        msg.textContent =
            t('importing');
        msg.className =
            'muted';

        settingsDetails.open = false;
        syncSettingsBackdrop();
        setImportOverlayState(true);
        importTxt.disabled = true;

        let response;

        try {
            response = await chrome.runtime.sendMessage({
                type: 'IMPORT_TXT',
                text: await file.text()
            });
        } finally {
            txtFile.value = '';
            importTxt.disabled = false;
            setImportOverlayState(false);
        }

        if (response?.error) {
            msg.textContent =
                response.error;

            msg.className =
                'muted err';

            return;
        }

        msg.textContent =
            t('imported', {
                added: response.added,
                archived: response.archived,
                invalid: response.invalid
            });

        msg.className =
            'muted ok';

        await load();
    }
);


// ============================================================
// Langue de l'interface
// ============================================================

interfaceLanguage.addEventListener(
    'change',
    async () => {
        await chrome.storage.local.set({
            interfaceLanguage:
                interfaceLanguage.value
        });

        applyInterfaceLanguage(
            interfaceLanguage.value
        );

        updateRequestSiteLabel();

        await load();
    }
);


// ============================================================
// Affichage
// ============================================================

sortMode.addEventListener(
    'change',
    async () => {
        await chrome.storage.local.set({
            sortMode: sortMode.value
        });

        renderCurrentLibrary();
    }
);

densityMode.addEventListener(
    'change',
    async () => {
        await chrome.storage.local.set({
            densityMode:
                densityMode.value
        });

        document
            .querySelector('.popup-shell')
            ?.classList.toggle(
                'compact-view',
                densityMode.value ===
                    'compact'
            );
    }
);



// ============================================================
// Taille de la fenêtre
// ============================================================

bindSizePair(
    popupWidth,
    popupWidthNumber,
    'width'
);

bindSizePair(
    popupHeight,
    popupHeightNumber,
    'height'
);

resetPopupSize.addEventListener(
    'click',
    async () => {
        await savePopupSize(
            DEFAULT_POPUP_WIDTH,
            DEFAULT_POPUP_HEIGHT
        );
    }
);


// ============================================================
// Démarrage
// ============================================================

load();


syncSettingsBackdrop();
