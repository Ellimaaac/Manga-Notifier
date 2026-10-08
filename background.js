const CHECK_ALARM = 'check-manga-library';
const DEFAULT_INTERVAL = 60;
const STORAGE_SCHEMA_VERSION = 1;
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ENTRIES = 5000;
const MAX_TITLE_LENGTH = 300;
const MAX_SHORT_TEXT_LENGTH = 500;
const WAKE_ALARM_LATE_MS = 60 * 1000;
const WAKE_NETWORK_GRACE_MS = 12 * 1000;
const FETCH_RETRY_DELAY_MS = 5 * 1000;


const SAFE_COVER_HOSTS = new Set([
    'www.mgeko.cc',
    'mgeko.cc',
    'mangadex.org',
    'uploads.mangadex.org',
    'ww3.mangafreak.me',
    'www.mangafreak.me',
    'mangafreak.me',
    'images.mangafreak.me',
    'www.webtoons.com',
    'webtoons.com',
    'webtoon-phinf.pstatic.net',
    'sushiscan.net',
    'www.sushiscan.net',
    'static.mfcdn.nl'
]);


const BACKGROUND_I18N = {
 fr:{notificationTitle:'Nouveau chapitre disponible !',chapter:'chapitre',ago:'il y a {age}',duplicate:'Cette lecture est déjà dans la liste.',notFound:'Lecture introuvable.'},
 en:{notificationTitle:'New chapter available!',chapter:'chapter',ago:'{age} ago',duplicate:'This title is already in the list.',notFound:'Title not found.'},
 es:{notificationTitle:'¡Nuevo capítulo disponible!',chapter:'capítulo',ago:'hace {age}',duplicate:'Esta lectura ya está en la lista.',notFound:'Lectura no encontrada.'},
 it:{notificationTitle:'Nuovo capitolo disponibile!',chapter:'capitolo',ago:'{age} fa',duplicate:'Questa lettura è già nella lista.',notFound:'Lettura non trovata.'},
 zh:{notificationTitle:'有新章节！',chapter:'章节',ago:'{age}前',duplicate:'该作品已在列表中。',notFound:'未找到该作品。'},
 ja:{notificationTitle:'新しいチャプターがあります！',chapter:'チャプター',ago:'{age}前',duplicate:'この作品はすでにリストにあります。',notFound:'作品が見つかりません。'},
 ko:{notificationTitle:'새 챕터가 있습니다!',chapter:'챕터',ago:'{age} 전',duplicate:'이미 목록에 있는 작품입니다.',notFound:'작품을 찾을 수 없습니다.'},
 pt:{notificationTitle:'Novo capítulo disponível!',chapter:'capítulo',ago:'há {age}',duplicate:'Esta leitura já está na lista.',notFound:'Leitura não encontrada.'}
};
const BACKGROUND_LOCALES={fr:'fr-FR',en:'en-US',es:'es-ES',it:'it-IT',zh:'zh-CN',ja:'ja-JP',ko:'ko-KR',pt:'pt-BR'};
async function getBackgroundLanguage(){const d=await chrome.storage.local.get('interfaceLanguage');return BACKGROUND_I18N[d.interfaceLanguage]?d.interfaceLanguage:'fr';}
function bgText(language,key,vars={}){let v=BACKGROUND_I18N[language]?.[key]??BACKGROUND_I18N.fr[key]??key;for(const [k,r] of Object.entries(vars))v=v.replaceAll(`{${k}}`,String(r));return v;}
function formatBackgroundDate(value,language){if(!value)return '';const locale=BACKGROUND_LOCALES[language]||'fr-FR';if(/^\d{4}-\d{2}-\d{2}$/.test(value)){const [y,m,d]=value.split('-').map(Number);return new Intl.DateTimeFormat(locale,{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(y,m-1,d));}return new Date(value).toLocaleString(locale);}


// ============================================================
// URL / sites supportés
// ============================================================

function normalizeUrl(raw) {
    const value =
        String(raw || '').trim();

    if (
        !value ||
        value.length > 2048
    ) {
        throw new Error(
            'URL invalide ou trop longue'
        );
    }

    const url =
        new URL(value);

    if (
        url.protocol !== 'https:' &&
        url.protocol !== 'http:'
    ) {
        throw new Error(
            'Seules les URL HTTP/HTTPS sont autorisées'
        );
    }

    url.protocol = 'https:';
    url.username = '';
    url.password = '';
    url.hash = '';

    // Mgeko
    if (['www.mgeko.cc', 'mgeko.cc'].includes(url.hostname)) {
        url.search = '';

        if (!url.pathname.startsWith('/manga/')) {
            throw new Error('Utilise une URL Mgeko de manga');
        }

        url.hostname = 'www.mgeko.cc';

        if (!url.pathname.endsWith('/')) {
            url.pathname += '/';
        }

        return {
            url: url.toString(),
            site: 'mgeko'
        };
    }

    // MangaDex
    if (['www.mangadex.org', 'mangadex.org'].includes(url.hostname)) {
        url.search = '';

        const match = url.pathname.match(
            /^\/title\/([0-9a-f-]{36})(?:\/([^/]+))?\/?$/i
        );

        if (!match) {
            throw new Error('Utilise une URL MangaDex de titre');
        }

        const mangaId = match[1];
        const slug = match[2];

        return {
            url:
                `https://mangadex.org/title/${mangaId}` +
                (slug ? `/${slug}` : ''),
            site: 'mangadex',
            mangaId
        };
    }

    // MangaFreak
    if (
        [
            'ww3.mangafreak.me',
            'www.mangafreak.me',
            'mangafreak.me'
        ].includes(url.hostname)
    ) {
        url.search = '';

        const match = url.pathname.match(/^\/Manga\/([^/?#]+)\/?$/i);

        if (!match) {
            throw new Error('Utilise une URL MangaFreak de manga');
        }

        url.hostname = 'ww3.mangafreak.me';
        url.pathname = `/Manga/${match[1]}`;

        return {
            url: url.toString(),
            site: 'mangafreak'
        };
    }

    // SushiScan
    if (
        [
            'www.sushiscan.net',
            'sushiscan.net'
        ].includes(url.hostname)
    ) {
        url.search = '';

        const match = url.pathname.match(
            /^\/catalogue\/([^/?#]+)\/?$/i
        );

        if (!match) {
            throw new Error(
                'Utilise une URL SushiScan de catalogue'
            );
        }

        url.hostname = 'sushiscan.net';
        url.pathname = `/catalogue/${match[1]}/`;

        return {
            url: url.toString(),
            site: 'sushiscan'
        };
    }



    // MangaFire
    if (
        [
            'mangafire.to',
            'www.mangafire.to'
        ].includes(url.hostname)
    ) {
        url.search = '';

        const match =
            url.pathname.match(
                /^\/title\/([^/?#]+)\/?$/i
            );

        if (!match) {
            throw new Error(
                'Utilise une URL MangaFire de titre'
            );
        }

        url.hostname = 'mangafire.to';
        url.pathname =
            `/title/${match[1]}`;

        return {
            url: url.toString(),
            site: 'mangafire'
        };
    }


    // WEBTOON
    if (
        [
            'www.webtoons.com',
            'webtoons.com'
        ].includes(url.hostname)
    ) {
        const titleNo = url.searchParams.get('title_no');

        if (!titleNo || !/^\d+$/.test(titleNo)) {
            throw new Error(
                'Utilise une URL WEBTOON de série contenant title_no'
            );
        }

        if (!/\/list\/?$/i.test(url.pathname)) {
            throw new Error(
                'Utilise la page liste de la série WEBTOON'
            );
        }

        url.hostname = 'www.webtoons.com';
        url.search = '';
        url.searchParams.set('title_no', titleNo);

        return {
            url: url.toString(),
            site: 'webtoon',
            webtoonId: titleNo
        };
    }

    throw new Error(
        'Site accepté : Mgeko, MangaDex, MangaFreak, MangaFire, SushiScan ou WEBTOON'
    );
}


// ============================================================
// Utilitaires
// ============================================================

function slugTitle(url) {
    try {
        return decodeURIComponent(
            new URL(url).pathname.split('/').filter(Boolean).pop() || 'Lecture'
        )
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    } catch {
        return 'Lecture';
    }
}

function stripHtml(value) {
    return value
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/gi, '"')
        .replace(/\s+/g, ' ')
        .trim();
}


function decodeHtmlAttribute(value) {
    return String(value ?? '')
        .replace(/&amp;/gi, '&')
        .replace(/&#38;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .trim();
}

function extractMetaImageUrl(html, baseUrl = '') {
    const match =
        html.match(
            /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["'][^>]*>/i
        ) ||
        html.match(
            /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/i
        );

    if (!match?.[1]) {
        return '';
    }

    const rawUrl =
        decodeHtmlAttribute(match[1]);

    try {
        return new URL(
            rawUrl,
            baseUrl || undefined
        ).toString();
    } catch {
        return rawUrl;
    }
}


function absoluteImageUrl(rawUrl, baseUrl = '') {
    const value =
        decodeHtmlAttribute(rawUrl);

    if (!value) {
        return '';
    }

    try {
        return new URL(
            value,
            baseUrl || undefined
        ).toString();
    } catch {
        return value;
    }
}

function extractImageFromClass(
    html,
    className,
    baseUrl = ''
) {
    const escapedClass =
        className.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        );

    /*
     * Cas 1 : la classe est directement sur l'image.
     */
    const imageClassRegex =
        new RegExp(
            `<img\\\\b(?=[^>]*\\\\bclass=["'][^"']*\\\\b${escapedClass}\\\\b[^"']*["'])(?=[^>]*\\\\bsrc=["']([^"']+)["'])[^>]*>`,
            'i'
        );

    let match =
        html.match(imageClassRegex);

    if (match?.[1]) {
        return absoluteImageUrl(
            match[1],
            baseUrl
        );
    }

    /*
     * Cas 2 : la classe est sur un conteneur qui contient l'image.
     */
    const containerRegex =
        new RegExp(
            `<[^>]+\\\\bclass=["'][^"']*\\\\b${escapedClass}\\\\b[^"']*["'][^>]*>[\\\\s\\\\S]{0,6000}?<img\\\\b[^>]*\\\\bsrc=["']([^"']+)["']`,
            'i'
        );

    match =
        html.match(containerRegex);

    if (match?.[1]) {
        return absoluteImageUrl(
            match[1],
            baseUrl
        );
    }

    return '';
}


// ============================================================
// Mgeko
// ============================================================

function extractMgeko(html, url) {
    const chapterRegex = /\b(\d+(?:\.\d+)?)-eng-li\b/gi;

    const chapters = [...html.matchAll(chapterRegex)]
        .map((match) => ({
            chapter: match[1],
            n: Number(match[1]),
            index: match.index
        }))
        .filter((item) => Number.isFinite(item.n));

    if (!chapters.length) {
        throw new Error('Aucun chapitre détecté sur Mgeko');
    }

    const latest = chapters.reduce(
        (current, candidate) =>
            candidate.n > current.n ? candidate : current
    );

    const nearHtml =
        html.slice(
            Math.max(0, latest.index - 600),
            latest.index + 1200
        );

    const near = stripHtml(nearHtml);

    const age = near.match(
        /(\d+\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?)(?:\s*,?\s*\d+\s*(?:minutes?|mins?|hours?|hrs?))?)/i
    );

    const titleMatch =
        html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

    let title = titleMatch
        ? stripHtml(titleMatch[1]).replace(/\s*[-|].*$/, '').trim()
        : slugTitle(url);

    const coverUrl =
        extractMetaImageUrl(
            html,
            url
        );

    return {
        chapter: latest.chapter,
        sortKey: latest.n,
        title: title || slugTitle(url),
        coverUrl,
        publishedAgo: age ? age[1].trim() : '',
        publishedAt: ''
    };
}

async function fetchMgeko(item) {
    const response = await fetch(item.url, {
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error(`Mgeko HTTP ${response.status}`);
    }

    const html =
        await response.text();

    return extractMgeko(
        html,
        item.url
    );
}


// ============================================================
// MangaDex
// ============================================================

async function fetchMangaDex(item) {
    const id =
        item.mangaId ||
        normalizeUrl(item.url).mangaId;

    // --------------------------------------------------------
    // Titre du manga
    // --------------------------------------------------------

    const titleResponse = await fetch(
        `https://api.mangadex.org/manga/${id}?includes[]=cover_art`,
        {
            cache: 'no-store'
        }
    );

    if (!titleResponse.ok) {
        throw new Error(
            `MangaDex titre HTTP ${titleResponse.status}`
        );
    }

    const titleData = await titleResponse.json();
    const titles =
        titleData?.data?.attributes?.title || {};

    const title =
        titles.en ||
        titles['ja-ro'] ||
        Object.values(titles)[0] ||
        slugTitle(item.url);

    const coverRelationship =
        (titleData?.data?.relationships || [])
            .find(
                (relationship) =>
                    relationship?.type === 'cover_art'
            );

    const coverFileName =
        coverRelationship?.attributes?.fileName || '';

    const coverUrl =
        coverFileName
            ? `https://uploads.mangadex.org/covers/${id}/${coverFileName}`
            : '';


    // --------------------------------------------------------
    // Dernier numéro de chapitre anglais
    //
    // IMPORTANT :
    // On ne trie plus par date d'upload/readableAt.
    // Sinon une ré-upload d'un ancien chapitre (ex. 110)
    // peut passer devant un chapitre supérieur (ex. 120).
    //
    // MangaDex sait trier directement par numéro de chapitre.
    // --------------------------------------------------------

    const query = new URLSearchParams();

    query.set('limit', '100');
    query.set('manga', id);
    query.append(
        'translatedLanguage[]',
        'en'
    );
    query.append(
        'order[chapter]',
        'desc'
    );
    query.set(
        'includeFutureUpdates',
        '0'
    );

    const response = await fetch(
        `https://api.mangadex.org/chapter?${query}`,
        {
            cache: 'no-store'
        }
    );

    if (!response.ok) {
        throw new Error(
            `MangaDex chapitres HTTP ${response.status}`
        );
    }

    const data = await response.json();

    const rows = (data.data || [])
        .filter(
            (row) =>
                row?.attributes?.chapter != null
        )
        .map((row) => {
            const chapter =
                String(
                    row.attributes.chapter
                );

            return {
                row,
                chapter,
                numericChapter:
                    Number(chapter)
            };
        });


    // --------------------------------------------------------
    // On privilégie les chapitres numériques.
    //
    // Même si l'API change son tri, on cherche encore nous-mêmes
    // le plus grand numéro pour éviter les anciennes ré-uploads.
    // --------------------------------------------------------

    const numericRows = rows.filter(
        (entry) =>
            Number.isFinite(
                entry.numericChapter
            )
    );

    if (!numericRows.length) {
        throw new Error(
            'Aucun chapitre anglais numéroté détecté sur MangaDex'
        );
    }

    const latest = numericRows.reduce(
        (current, candidate) =>
            candidate.numericChapter >
            current.numericChapter
                ? candidate
                : current
    );

    const attributes =
        latest.row.attributes;

    return {
        chapter:
            latest.chapter,

        sortKey:
            latest.numericChapter,

        title,

        coverUrl,

        publishedAt:
            attributes.readableAt ||
            attributes.publishAt ||
            attributes.createdAt ||
            '',

        publishedAgo:
            '',

        chapterId:
            latest.row.id
    };
}


// ============================================================
// MangaFreak
// ============================================================

function extractMangaFreak(html, url) {
    // --------------------------------------------------------
    // Titre du manga
    // --------------------------------------------------------

    const titleMatch =
        html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

    let title = titleMatch
        ? stripHtml(titleMatch[1])
        : slugTitle(url);

    title = title
        .replace(/\s*[-|]\s*MangaFreak.*$/i, '')
        .replace(/\s*Manga Online.*$/i, '')
        .trim();


    // --------------------------------------------------------
    // Chapitres + dates
    //
    // MangaFreak affiche les chapitres dans un tableau :
    //
    // Chapter 1194 - ... | 2026/09/25 | ...
    //
    // Il est important d'extraire le chapitre ET la date depuis
    // la même ligne <tr>. Sinon une date d'un ancien chapitre
    // peut être associée au dernier chapitre.
    // --------------------------------------------------------

    const rows = [];

    const tableRowRegex =
        /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

    for (const rowMatch of html.matchAll(tableRowRegex)) {
        const rowHtml = rowMatch[1];
        const rowText = stripHtml(rowHtml);

        const chapterMatch =
            rowText.match(
                /\bChapter\s+(\d+(?:\.\d+)?)\b/i
            );

        const dateMatch =
            rowText.match(
                /\b(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\b/
            );

        if (!chapterMatch) {
            continue;
        }

        const chapter = chapterMatch[1];
        const numericChapter = Number(chapter);

        const linkMatch =
            rowHtml.match(
                /href=["']([^"']+)["']/i
            );

        let chapterUrl = '';

        if (linkMatch?.[1]) {
            try {
                chapterUrl =
                    new URL(
                        decodeHtmlAttribute(
                            linkMatch[1]
                        ),
                        url
                    ).toString();
            } catch {
                chapterUrl = '';
            }
        }

        if (!Number.isFinite(numericChapter)) {
            continue;
        }

        let publishedAt = '';

        if (dateMatch) {
            const year = dateMatch[1];
            const month = dateMatch[2].padStart(2, '0');
            const day = dateMatch[3].padStart(2, '0');

            /*
             * MangaFreak fournit ses dates en YYYY/MM/DD.
             * On les conserve comme date seule en YYYY-MM-DD :
             * 2026/10/08 -> 2026-10-08.
             */
            publishedAt =
                `${year}-${month}-${day}`;
        }

        rows.push({
            chapter,
            n: numericChapter,
            publishedAt,
            chapterUrl
        });
    }


    // --------------------------------------------------------
    // Fallback
    //
    // Si MangaFreak modifie un jour légèrement son HTML et que
    // les <tr> ne sont plus détectés, on essaie encore de trouver
    // le numéro du chapitre. Dans ce cas on n'invente PAS de date.
    // --------------------------------------------------------

    if (!rows.length) {
        const fallbackChapters = [
            ...html.matchAll(
                /\bChapter\s+(\d+(?:\.\d+)?)\b/gi
            )
        ]
            .map((match) => ({
                chapter: match[1],
                n: Number(match[1]),
                publishedAt: ''
            }))
            .filter((item) =>
                Number.isFinite(item.n)
            );

        rows.push(...fallbackChapters);
    }

    if (!rows.length) {
        throw new Error(
            'Aucun chapitre détecté sur MangaFreak'
        );
    }


    // --------------------------------------------------------
    // Dernier chapitre
    // --------------------------------------------------------

    const latest = rows.reduce(
        (current, candidate) =>
            candidate.n > current.n
                ? candidate
                : current
    );

    const coverUrl =
        extractImageFromClass(
            html,
            'manga_series_image',
            url
        ) ||
        extractMetaImageUrl(
            html,
            url
        );

    return {
        chapter: latest.chapter,
        sortKey: latest.n,
        title: title || slugTitle(url),
        coverUrl,
        publishedAt: latest.publishedAt,
        publishedAgo: ''
    };
}


async function fetchMangaFreak(item) {
    const response = await fetch(item.url, {
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error(
            `MangaFreak HTTP ${response.status}`
        );
    }

    const html =
        await response.text();

    return extractMangaFreak(
        html,
        item.url
    );
}


// ============================================================
// WEBTOON
// ============================================================

function parseWebtoonDate(text) {
    const match = String(text).match(
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})\b/i
    );

    if (!match) {
        return '';
    }

    const months = {
        jan: '01',
        feb: '02',
        mar: '03',
        apr: '04',
        may: '05',
        jun: '06',
        jul: '07',
        aug: '08',
        sep: '09',
        oct: '10',
        nov: '11',
        dec: '12'
    };

    const month = months[match[1].toLowerCase()];
    const day = match[2].padStart(2, '0');
    const year = match[3];

    return `${year}-${month}-${day}`;
}

function extractWebtoon(html, url) {
    const titleMatch =
        html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

    let title = titleMatch
        ? stripHtml(titleMatch[1])
        : slugTitle(url);

    title = title
        .replace(/\s*\|\s*WEBTOON.*$/i, '')
        .trim();

    let expectedTitleNo = '';

    try {
        expectedTitleNo =
            new URL(url).searchParams.get('title_no') || '';
    } catch {
        // URL déjà validée par normalizeUrl().
    }

    const episodes = [];
    const seenEpisodeNos = new Set();

    /*
     * On lit directement les href /viewer?... et on parse leurs
     * paramètres avec URLSearchParams. L'ordre de episode_no et
     * title_no n'a donc aucune importance.
     */
    const hrefRegex =
        /href\s*=\s*(["'])([^"']*\/viewer\?[^"']+)\1/gi;

    for (const hrefMatch of html.matchAll(hrefRegex)) {
        const rawHref = hrefMatch[2]
            .replace(/&amp;/gi, '&')
            .replace(/&#38;/gi, '&');

        let viewerUrl;

        try {
            viewerUrl = new URL(
                rawHref,
                'https://www.webtoons.com'
            );
        } catch {
            continue;
        }

        const episodeNoText =
            viewerUrl.searchParams.get('episode_no');

        const titleNo =
            viewerUrl.searchParams.get('title_no');

        if (!episodeNoText) {
            continue;
        }

        if (
            expectedTitleNo &&
            titleNo &&
            titleNo !== expectedTitleNo
        ) {
            continue;
        }

        const episodeNo = Number(episodeNoText);

        if (
            !Number.isFinite(episodeNo) ||
            seenEpisodeNos.has(episodeNo)
        ) {
            continue;
        }

        seenEpisodeNos.add(episodeNo);

        /*
         * On prend le <li> contenant ce lien pour associer
         * correctement le titre et la date au même épisode.
         */
        const hrefIndex = hrefMatch.index || 0;
        const liStart = html.lastIndexOf('<li', hrefIndex);
        const liEnd = html.indexOf('</li>', hrefIndex);

        let itemHtml;

        if (
            liStart !== -1 &&
            liEnd !== -1 &&
            liEnd > liStart
        ) {
            itemHtml = html.slice(
                liStart,
                liEnd + 5
            );
        } else {
            /*
             * Fallback si WEBTOON modifie sa structure.
             */
            itemHtml = html.slice(
                Math.max(0, hrefIndex - 1200),
                hrefIndex + 1800
            );
        }

        const itemText = stripHtml(itemHtml);

        const labelMatch =
            itemText.match(
                /(\[Season\s+\d+\]\s*Ep\.\s*\d+(?:\s*\([^)]*\))?)/i
            ) ||
            itemText.match(
                /\b(Ep\.\s*\d+(?:\s*\([^)]*\))?)/i
            );

        const label = labelMatch
            ? labelMatch[1]
                .replace(/\s+/g, ' ')
                .trim()
            : `Épisode ${episodeNo}`;

        const publishedAt =
            parseWebtoonDate(itemText);

        episodes.push({
            chapter: label,
            episodeNo,
            publishedAt,
            url: viewerUrl.toString()
        });
    }

    if (!episodes.length) {
        throw new Error(
            'Aucun épisode détecté sur WEBTOON'
        );
    }

    /*
     * episode_no est croissant sur WEBTOON et reste fiable
     * même lorsqu'une nouvelle saison repart à Ep. 1.
     */
    const latest = episodes.reduce(
        (current, candidate) =>
            candidate.episodeNo > current.episodeNo
                ? candidate
                : current
    );

    const coverUrl =
        extractImageFromClass(
            html,
            'detail_header',
            url
        ) ||
        extractMetaImageUrl(
            html,
            url
        );

    return {
        chapter: latest.chapter,
        sortKey: latest.episodeNo,
        title: title || slugTitle(url),
        coverUrl,
        publishedAt: latest.publishedAt,
        publishedAgo: '',
        chapterId: String(latest.episodeNo)
    };
}


async function fetchWebtoon(item) {
    const response = await fetch(item.url, {
        cache: 'no-store',
        headers: {
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    if (!response.ok) {
        throw new Error(
            `WEBTOON HTTP ${response.status}`
        );
    }

    const html =
        await response.text();

    return extractWebtoon(
        html,
        item.url
    );
}


// ============================================================
// SushiScan
// ============================================================

const SUSHISCAN_MONTHS = {
    janvier: '01',
    février: '02',
    fevrier: '02',
    mars: '03',
    avril: '04',
    mai: '05',
    juin: '06',
    juillet: '07',
    août: '08',
    aout: '08',
    septembre: '09',
    octobre: '10',
    novembre: '11',
    décembre: '12',
    decembre: '12'
};

function extractSushiScan(html, url) {
    const titleMatch =
        html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

    let title = titleMatch
        ? stripHtml(titleMatch[1])
        : slugTitle(url);

    title = title
        .replace(/\s*[-|]\s*(?:Scan\s+FR|VF|SushiScan).*$/i, '')
        .trim();

    const text = stripHtml(html);

    /*
     * SushiScan affiche les entrées sous la forme :
     * "Chapitre 652 11 mai 2025".
     *
     * On récupère tous les chapitres et on choisit le plus grand
     * numéro, plutôt que de faire confiance à l'ordre du HTML.
     */
    const rows = [];
    const rowRegex =
        /\bChapitre\s+(\d+(?:\.\d+)?)\s+(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})\b/gi;

    for (const match of text.matchAll(rowRegex)) {
        const chapter = match[1];
        const n = Number(chapter);

        if (!Number.isFinite(n)) {
            continue;
        }

        const day = match[2].padStart(2, '0');
        const month =
            SUSHISCAN_MONTHS[
                match[3].toLowerCase()
            ];
        const year = match[4];

        rows.push({
            chapter,
            n,
            publishedAt:
                month
                    ? `${year}-${month}-${day}`
                    : ''
        });
    }

    /*
     * Fallback : si SushiScan change l'affichage des dates,
     * on garde quand même la détection du dernier chapitre.
     */
    if (!rows.length) {
        const chapterRegex =
            /\bChapitre\s+(\d+(?:\.\d+)?)\b/gi;

        for (const match of text.matchAll(chapterRegex)) {
            const chapter = match[1];
            const n = Number(chapter);

            if (Number.isFinite(n)) {
                rows.push({
                    chapter,
                    n,
                    publishedAt: ''
                });
            }
        }
    }

    if (!rows.length) {
        throw new Error(
            'Aucun chapitre détecté sur SushiScan'
        );
    }

    const latest = rows.reduce(
        (current, candidate) =>
            candidate.n > current.n
                ? candidate
                : current
    );

    const coverUrl =
        extractImageFromClass(
            html,
            'attachment-size-wp-post-image',
            url
        ) ||
        extractMetaImageUrl(
            html,
            url
        );

    return {
        chapter: latest.chapter,
        sortKey: latest.n,
        title: title || slugTitle(url),
        coverUrl,
        publishedAt: latest.publishedAt,
        publishedAgo: ''
    };
}

async function fetchSushiScan(item) {
    const response = await fetch(item.url, {
        cache: 'no-store',
        headers: {
            'Accept-Language': 'fr-FR,fr;q=0.9'
        }
    });

    if (!response.ok) {
        throw new Error(
            `SushiScan HTTP ${response.status}`
        );
    }

    const html =
        await response.text();

    return extractSushiScan(
        html,
        item.url
    );
}



// ============================================================
// MangaFire
// ============================================================

/*
 * MangaFire charge désormais sa liste de chapitres via son API
 * /api/titles/{id}/chapters et protège les requêtes avec un VRF.
 *
 * Algorithme compatible avec l'implémentation actuelle de Haruneko:
 * https://github.com/manga-download/haruneko
 */

const MANGAFIRE_VRF_STAGES = [
    {
        table:
            'yINlmUNho8VYJT+ibTIP+9ESiULpVEtMOoD6U6lRE0R/xwXo/Xp9NrUgC4cw/' +
            'Lmo33vUyjUE40kUoEWIr/fxfNNcq2s79ShQ5NhNrFnJ4hXPwOu/SuXzIbuTQKG' +
            'Fvfm08E9jvCfqAtoDqvQq3dVWPQFmJjgvkISBeXY3BgANR+yVnjGbcxZ47d6k' +
            'LNfZPIayTq3/YGySb1KuVZodWp/WGNAO5pfMcpaK53Hhs0allBszaMaxuouOwd' +
            'xbwgxIw6YunSsXjI05Yi0j9j4eHKfSXR8Ifo/Od+8iamRfCXTyvm7NGRGYdcQ' +
            '0ywcK/u6RXhrbcCm4t2eCtrDgQVecJGkQ+A==',

        key:
            '0Ec58JOY3uBzJK9m3zqIOpdlF7UFiax9DmA=',

        iv:
            0x5a
    },
    {
        table:
            'IUFltCxD3Oc2cwCgkJffthaOg9cgPUb0LgW6H/VtfcF0kc5F25t+aWj6JH9V' +
            'OhOaY0rAFdUxlDnl5BLNvwEJvQtP5qcw7vdb/K+chnbwnspSHT8mz5lqwz41T' +
            'ezG0hkO06FTjJZhsyNuFLDpD2ZZxQj/QIRcF90zpmQ7Byu483WsQqUE0C342H' +
            'L+JXngRB6fRzxRyVTaKu83h7UYTJ0QMt6ixFh6S3F8gqkKwrGTL3jHNBsD45U' +
            'nifK8+RGtishQV2K3rujLKEkiZxpr2dYcudFW4oFsDKhad3CLBvuyTqsCo4B7m' +
            'L5IKQ1vXo/MOOvq1I1d8ar9X6Ttu5KF4fZgiA==',

        key:
            'AAdjb1iPY8CiDmq9H34tKTBF8a3oDQ==',

        iv:
            0x35
    },
    {
        table:
            'NQHlu1/wVO5EmkwQymF810qqY2xG1k2obcas4Z9mCsPEIFl9pRIjFxbJ7ybM' +
            'HbBckT5Ton85E0FOeHezbh/mjlEYpmpnlXOS8dgrqeq2KfxImTh1YK9y0PeMN' +
            'hzA1OQzSY9brYOJq/l2QnE/hwOeZIhPixVSKIUlDb5vLcH6RWKxkIEMuP0bDw' +
            'IqQ71AJJaEaMJL7A6YtyIwoRT+L5v4aZzodN/0+3nOGsfblFjgxSfPzVDjNFe' +
            'Nl5P26+kEC/8AHgdrpAbt3hHz3HrRN1Y6e+JHgF7ncFWnoF0y3THL1S71WgWG' +
            'Ca6KtSzTCCG58n68nTyj2T3Sshk7utqCtMi/ZQ==',

        key:
            'DELOJgPsVaCcblDtTGMdHzM=',

        iv:
            0xba
    }
].map(
    ({ table, key, iv }) => ({
        table:
            mangaFireBase64Bytes(
                table
            ),

        key:
            mangaFireBase64Bytes(
                key
            ),

        iv
    })
);

function mangaFireBase64Bytes(value) {
    const binary =
        atob(value);

    const result =
        new Uint8Array(
            binary.length
        );

    for (
        let i = 0;
        i < binary.length;
        i++
    ) {
        result[i] =
            binary.charCodeAt(i);
    }

    return result;
}

function mangaFireUtf8Bytes(value) {
    return new TextEncoder()
        .encode(value);
}

function mangaFireUrlBase64(bytes) {
    let binary = '';

    for (const byte of bytes) {
        binary +=
            String.fromCharCode(
                byte
            );
    }

    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function mangaFireEncryptStage(
    data,
    stage
) {
    const output =
        new Uint8Array(
            data.length
        );

    let previous =
        stage.iv;

    for (
        let i = 0;
        i < data.length;
        i++
    ) {
        previous =
            stage.table[
                data[i] ^
                stage.key[
                    i %
                    stage.key.length
                ] ^
                previous
            ];

        output[i] =
            previous;
    }

    return output;
}

function mangaFireComputeVrf(url) {
    const sorted =
        new URL(url.toString());

    sorted.searchParams.sort();

    const pathAndQuery =
        url.pathname.replace(
            /^\/api\//,
            '/'
        ) +
        sorted.search;

    let data =
        mangaFireUtf8Bytes(
            pathAndQuery
        );

    for (
        const stage of
        MANGAFIRE_VRF_STAGES
    ) {
        data =
            mangaFireEncryptStage(
                data,
                stage
            );
    }

    return mangaFireUrlBase64(
        data
    );
}

async function mangaFireApi(
    endpoint,
    params = {}
) {
    const url =
        new URL(
            endpoint,
            'https://mangafire.to/api/'
        );

    for (
        const [key, value] of
        Object.entries(params)
    ) {
        url.searchParams.set(
            key,
            String(value)
        );
    }

    url.searchParams.set(
        'vrf',
        mangaFireComputeVrf(
            url
        )
    );

    const response =
        await fetch(
            url.toString(),
            {
                cache: 'no-store',
                headers: {
                    'Accept':
                        'application/json,text/plain,*/*',

                    'Accept-Language':
                        'en-US,en;q=0.9',

                    'Referer':
                        'https://mangafire.to/'
                }
            }
        );

    if (!response.ok) {
        throw new Error(
            `MangaFire API HTTP ${response.status}`
        );
    }

    const text =
        await response.text();

    let data;

    try {
        data =
            JSON.parse(text);
    } catch {
        throw new Error(
            'Réponse API MangaFire invalide'
        );
    }

    return data;
}

function mangaFireIdFromUrl(url) {
    const pathname =
        new URL(url).pathname;

    const match =
        pathname.match(
            /^\/title\/([^-\/]+)/i
        );

    if (!match?.[1]) {
        throw new Error(
            'Identifiant MangaFire introuvable'
        );
    }

    return match[1];
}

function mangaFireRelativeAgeToIso(value) {
    const match =
        String(value || '')
            .trim()
            .match(
                /^(\d+)\s*(mo|y|w|d|h|m)\s+ago$/i
            );

    if (!match) {
        return '';
    }

    const amount =
        Number(match[1]);

    const unit =
        match[2].toLowerCase();

    if (
        !Number.isFinite(amount) ||
        amount < 0
    ) {
        return '';
    }

    const date =
        new Date();

    switch (unit) {
        case 'm':
            date.setMinutes(
                date.getMinutes() - amount
            );
            break;

        case 'h':
            date.setHours(
                date.getHours() - amount
            );
            break;

        case 'd':
            date.setDate(
                date.getDate() - amount
            );
            break;

        case 'w':
            date.setDate(
                date.getDate() - (amount * 7)
            );
            break;

        case 'mo':
            date.setMonth(
                date.getMonth() - amount
            );
            break;

        case 'y':
            date.setFullYear(
                date.getFullYear() - amount
            );
            break;

        default:
            return '';
    }

    return date.toISOString();
}

function mangaFireDateFromItem(item) {
    const candidates = [
        item?.publishedAt,
        item?.published_at,
        item?.createdAt,
        item?.created_at,
        item?.updatedAt,
        item?.updated_at,
        item?.date,
        item?.date_upload,
        item?.uploadedAt
    ];

    for (const value of candidates) {
        if (
            value === null ||
            value === undefined ||
            value === ''
        ) {
            continue;
        }

        /*
         * MangaFire peut renvoyer un âge comme "5d ago".
         */
        if (
            typeof value === 'string'
        ) {
            const relative =
                mangaFireRelativeAgeToIso(
                    value
                );

            if (relative) {
                return relative;
            }
        }

        /*
         * Timestamp Unix :
         * - 10 chiffres ~ secondes
         * - 13 chiffres ~ millisecondes
         *
         * Le bug 21/01/1970 venait d'un timestamp en secondes
         * directement passé à new Date().
         */
        const numeric =
            typeof value === 'number' ||
            /^\d+(?:\.\d+)?$/.test(
                String(value).trim()
            )
                ? Number(value)
                : NaN;

        if (
            Number.isFinite(numeric)
        ) {
            const milliseconds =
                numeric < 1e12
                    ? numeric * 1000
                    : numeric;

            const date =
                new Date(
                    milliseconds
                );

            if (
                !Number.isNaN(
                    date.getTime()
                ) &&
                date.getFullYear() >= 2000
            ) {
                return date.toISOString();
            }

            continue;
        }

        const date =
            new Date(value);

        if (
            !Number.isNaN(
                date.getTime()
            ) &&
            date.getFullYear() >= 2000
        ) {
            return date.toISOString();
        }
    }

    return '';
}

async function fetchMangaFire(item) {
    const mangaFireId =
        mangaFireIdFromUrl(
            item.url
        );

    /*
     * L'API "titles/{id}" donne notamment le HID canonique et le titre.
     */
    const detail =
        await mangaFireApi(
            `titles/${mangaFireId}`
        );

    const mangaData =
        detail?.data ||
        {};

    const hid =
        mangaData.hid ||
        mangaFireId;

    /*
     * On demande directement les chapitres triés par numéro décroissant.
     * limit=200 est suffisant pour déterminer le plus grand chapitre,
     * mais on vérifie quand même toutes les entrées reçues.
     */
    const chapterData =
        await mangaFireApi(
            `titles/${hid}/chapters`,
            {
                sort: 'number',
                order: 'desc',
                page: 1,
                limit: 200
            }
        );

    const items =
        Array.isArray(
            chapterData?.items
        )
            ? chapterData.items
            : [];

    const chapters =
        items
            .map(
                (row) => ({
                    row,
                    number:
                        Number(
                            row?.number
                        )
                })
            )
            .filter(
                (entry) =>
                    Number.isFinite(
                        entry.number
                    )
            );

    if (!chapters.length) {
        throw new Error(
            'Aucun chapitre détecté sur MangaFire'
        );
    }

    const latest =
        chapters.reduce(
            (current, candidate) =>
                candidate.number >
                current.number
                    ? candidate
                    : current
        );

    /*
     * Le HTML normal reste utile pour la couverture.
     * Le chapitre, lui, vient de l'API signée.
     */
    let html = '';

    try {
        const pageResponse =
            await fetch(
                item.url,
                {
                    cache:
                        'no-store',

                    headers: {
                        'Accept-Language':
                            'en-US,en;q=0.9'
                    }
                }
            );

        if (pageResponse.ok) {
            html =
                await pageResponse.text();
        }
    } catch {
        html = '';
    }

    const htmlTitle =
        html.match(
            /<h1[^>]*>([\s\S]*?)<\/h1>/i
        ) ||
        html.match(
            /<title[^>]*>([\s\S]*?)<\/title>/i
        );

    let title =
        cleanText(
            mangaData.title ||
            (
                htmlTitle
                    ? stripHtml(
                        htmlTitle[1]
                    )
                    : ''
            ) ||
            slugTitle(
                item.url
            ),
            MAX_TITLE_LENGTH
        );

    title =
        title.replace(
            /\s*[-|]\s*MangaFire.*$/i,
            ''
        ).trim();

    /*
     * Les détails MangaFire contiennent la couverture dans poster.
     * On la préfère au DOM, car la page peut être rendue côté client.
     */
    const apiCoverUrl =
        mangaData?.poster?.large ||
        mangaData?.poster?.medium ||
        mangaData?.poster?.small ||
        mangaData?.poster?.url ||
        '';

    const htmlCoverUrl =
        html
            ? (
                extractImageFromClass(
                    html,
                    'title-detail_poster-col',
                    item.url
                ) ||
                extractMetaImageUrl(
                    html,
                    item.url
                )
            )
            : '';

    const coverUrl =
        absoluteImageUrl(
            apiCoverUrl ||
            htmlCoverUrl,
            item.url
        );

    return {
        chapter:
            String(
                latest.number
            ),

        sortKey:
            latest.number,

        title,

        coverUrl,

        publishedAt:
            mangaFireDateFromItem(
                latest.row
            ),

        publishedAgo:
            '',

        chapterId:
            String(
                latest.row?.id ||
                latest.number
            )
    };
}


// ============================================================
// Sélection de la source
// ============================================================

const SITE_FETCHERS = {
    mgeko: fetchMgeko,
    mangadex: fetchMangaDex,
    mangafreak: fetchMangaFreak,
    mangafire: fetchMangaFire,
    sushiscan: fetchSushiScan,
    webtoon: fetchWebtoon
};
async function fetchInfo(item) { const fetcher = SITE_FETCHERS[item.site]; if (!fetcher) throw new Error(`Site non supporté : ${item.site}`); return fetcher(item); }


// ============================================================
// Validation / durcissement des données importées
// ============================================================

function byteLength(value) {
    return new TextEncoder().encode(
        String(value || '')
    ).length;
}

function assertImportSize(text) {
    if (
        byteLength(text) >
        MAX_IMPORT_BYTES
    ) {
        throw new Error(
            'Fichier trop volumineux (5 Mo maximum).'
        );
    }
}

function sleep(ms) {
    return new Promise(
        (resolve) =>
            setTimeout(resolve, ms)
    );
}

function isTransientNetworkError(error) {
    const message =
        String(
            error?.message ||
            error ||
            ''
        ).toLowerCase();

    return (
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('network error') ||
        message.includes('load failed') ||
        message.includes('internet disconnected') ||
        message.includes('name_not_resolved') ||
        message.includes('timed out') ||
        message.includes('timeout') ||
        /http\s+(408|425|429|500|502|503|504)\b/.test(
            message
        )
    );
}

async function fetchInfoWithRetry(item) {
    try {
        return await fetchInfo(item);
    } catch (firstError) {
        if (
            !isTransientNetworkError(
                firstError
            )
        ) {
            throw firstError;
        }

        await sleep(
            FETCH_RETRY_DELAY_MS
        );

        return fetchInfo(item);
    }
}


function cleanText(
    value,
    maxLength = MAX_SHORT_TEXT_LENGTH
) {
    return String(value ?? '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function finiteTimestamp(value) {
    const number =
        Number(value);

    return Number.isFinite(number) &&
        number >= 0
            ? number
            : 0;
}

function sanitizeCoverUrl(raw) {
    if (!raw) {
        return '';
    }

    try {
        const url =
            new URL(String(raw));

        if (
            url.protocol !== 'https:' ||
            !SAFE_COVER_HOSTS.has(
                url.hostname.toLowerCase()
            )
        ) {
            return '';
        }

        url.username = '';
        url.password = '';
        url.hash = '';

        return url.toString()
            .slice(0, 4096);
    } catch {
        return '';
    }
}

function sanitizeChapterValue(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return '';
    }

    return cleanText(
        value,
        160
    );
}

function sanitizeLibraryEntry(raw) {
    if (
        !raw ||
        typeof raw !== 'object' ||
        Array.isArray(raw)
    ) {
        throw new Error(
            'Entrée de bibliothèque invalide.'
        );
    }

    const normalized =
        normalizeUrl(raw.url);

    return {
        url:
            normalized.url,

        site:
            normalized.site,

        mangaId:
            normalized.mangaId || '',

        webtoonId:
            normalized.webtoonId || '',

        title:
            cleanText(
                raw.title ||
                slugTitle(
                    normalized.url
                ),
                MAX_TITLE_LENGTH
            ),

        coverUrl:
            sanitizeCoverUrl(
                raw.coverUrl
            ),

        latestChapter:
            sanitizeChapterValue(
                raw.latestChapter
            ),

        lastSeenChapter:
            sanitizeChapterValue(
                raw.lastSeenChapter
            ),

        lastSeenChapterId:
            cleanText(
                raw.lastSeenChapterId,
                200
            ),

        latestChapterId:
            cleanText(
                raw.latestChapterId,
                200
            ),

        publishedAgo:
            cleanText(
                raw.publishedAgo,
                100
            ),

        publishedAt:
            cleanText(
                raw.publishedAt,
                100
            ),

        lastCheck:
            finiteTimestamp(
                raw.lastCheck
            ),

        detectedAt:
            finiteTimestamp(
                raw.detectedAt
            ),

        lastError:
            cleanText(
                raw.lastError,
                500
            ),

        unread:
            raw.unread === true
    };
}

function sanitizeArchiveEntry(raw) {
    if (
        !raw ||
        typeof raw !== 'object' ||
        Array.isArray(raw)
    ) {
        throw new Error(
            'Entrée d’archive invalide.'
        );
    }

    const normalized =
        normalizeUrl(raw.url);

    return {
        url:
            normalized.url,

        site:
            normalized.site,

        mangaId:
            normalized.mangaId || '',

        webtoonId:
            normalized.webtoonId || '',

        coverUrl:
            sanitizeCoverUrl(
                raw.coverUrl
            ),

        title:
            cleanText(
                raw.title ||
                slugTitle(
                    normalized.url
                ),
                MAX_TITLE_LENGTH
            ),

        firstAddedAt:
            finiteTimestamp(
                raw.firstAddedAt
            ),

        lastSeenAt:
            finiteTimestamp(
                raw.lastSeenAt
            ),

        lastKnownChapter:
            sanitizeChapterValue(
                raw.lastKnownChapter
            )
    };
}

function dedupeByIdentity(items) {
    const seen =
        new Set();

    const result = [];

    for (const item of items) {
        const key =
            item.mangaId
                ? `${item.site}|${item.mangaId}`
                : `${item.site}|${item.url}`;

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        result.push(item);
    }

    return result;
}

function sanitizeSettings(data) {
    const restored = {};

    if (
        Number.isFinite(
            Number(data.intervalMinutes)
        )
    ) {
        const allowed =
            new Set([
                5,
                15,
                30,
                60,
                180,
                300,
                600,
                1440
            ]);

        const value =
            Number(
                data.intervalMinutes
            );

        if (allowed.has(value)) {
            restored.intervalMinutes =
                value;
        }
    }

    const width =
        Number(data.popupWidth);

    if (
        Number.isFinite(width)
    ) {
        restored.popupWidth =
            Math.min(
                800,
                Math.max(
                    360,
                    Math.round(width)
                )
            );
    }

    const height =
        Number(data.popupHeight);

    if (
        Number.isFinite(height)
    ) {
        restored.popupHeight =
            Math.min(
                600,
                Math.max(
                    300,
                    Math.round(height)
                )
            );
    }

    const languages =
        new Set([
            'fr',
            'en',
            'es',
            'it',
            'zh',
            'ja',
            'ko',
            'pt'
        ]);

    if (
        languages.has(
            data.interfaceLanguage
        )
    ) {
        restored.interfaceLanguage =
            data.interfaceLanguage;
    }

    const sortModes =
        new Set([
            'recent',
            'title',
            'source'
        ]);

    if (
        sortModes.has(
            data.sortMode
        )
    ) {
        restored.sortMode =
            data.sortMode;
    }

    const densities =
        new Set([
            'normal',
            'compact'
        ]);

    if (
        densities.has(
            data.densityMode
        )
    ) {
        restored.densityMode =
            data.densityMode;
    }

    return restored;
}

function safeSupportedOpenUrl(raw) {
    try {
        return normalizeUrl(raw).url;
    } catch {
        return '';
    }
}


// ============================================================
// Migration du stockage
// ============================================================

function cleanLegacyLibraryItem(item) {
    if (
        !item ||
        typeof item !== 'object'
    ) {
        return item;
    }

    const {
        customTitle,
        notificationsEnabled,
        latestChapterUrl,
        ...clean
    } = item;

    return clean;
}

async function migrateStorage() {
    const data =
        await chrome.storage.local.get([
            'storageSchemaVersion',
            'library',
            'archive'
        ]);

    const currentVersion =
        Number(
            data.storageSchemaVersion
        ) || 0;

    if (
        currentVersion >=
        STORAGE_SCHEMA_VERSION
    ) {
        return;
    }

    const library =
        Array.isArray(data.library)
            ? data.library.map(
                cleanLegacyLibraryItem
            )
            : [];

    const archive =
        Array.isArray(data.archive)
            ? data.archive.map(
                cleanLegacyLibraryItem
            )
            : [];

    await chrome.storage.local.set({
        library,
        archive,
        storageSchemaVersion:
            STORAGE_SCHEMA_VERSION
    });
}


// ============================================================
// Stockage : bibliothèque et archive
// ============================================================

async function getLibrary() {
    const data = await chrome.storage.local.get('library');

    return Array.isArray(data.library)
        ? data.library
        : [];
}

async function saveLibrary(library) {
    await chrome.storage.local.set({ library });
}

async function getArchive() {
    const data = await chrome.storage.local.get('archive');

    return Array.isArray(data.archive)
        ? data.archive
        : [];
}

function upsertArchiveItem(
    archive,
    item,
    now = Date.now()
) {
    let archivedItem = archive.find(
        (entry) =>
            entry.url === item.url ||
            (
                item.mangaId &&
                entry.mangaId === item.mangaId
            )
    );

    if (!archivedItem) {
        archivedItem = {
            url: item.url,
            site: item.site,
            mangaId: item.mangaId || '',
            webtoonId: item.webtoonId || '',
            coverUrl: item.coverUrl || '',
            title:
                item.title ||
                slugTitle(item.url),
            firstAddedAt: now
        };

        archive.push(archivedItem);
    }

    Object.assign(archivedItem, {
        title:
            item.title ||
            archivedItem.title ||
            slugTitle(item.url),

        site:
            item.site ||
            archivedItem.site,

        mangaId:
            item.mangaId ||
            archivedItem.mangaId ||
            '',

        webtoonId:
            item.webtoonId ||
            archivedItem.webtoonId ||
            '',

        coverUrl:
            item.coverUrl ||
            archivedItem.coverUrl ||
            '',

        lastKnownChapter:
            item.latestChapter ??
            item.lastSeenChapter ??
            archivedItem.lastKnownChapter ??
            '',

        lastSeenAt: now
    });

    return archivedItem;
}

async function archiveItem(item) {
    const archive =
        await getArchive();

    const archivedItem =
        upsertArchiveItem(
            archive,
            item
        );

    await chrome.storage.local.set({
        archive
    });

    return archivedItem;
}


// ============================================================
// Import / export TXT
// ============================================================

function txtSafe(value) {
    return String(value ?? '')
        .replace(/[\t\r\n]+/g, ' ')
        .trim();
}

function makeTxt(archive) {
    /*
     * Export lisible en 2 colonnes :
     *
     * Titre du manga                         URL
     * ------------------------------------------------------------
     * Tower of God                           https://...
     * One Piece                              https://...
     *
     * L'import reste compatible car parseTxt() recherche l'URL
     * n'importe où sur la ligne.
     */

    const rows = archive
        .map((item) => ({
            title: txtSafe(
                item.title || 'Sans titre'
            ),
            url: txtSafe(item.url)
        }))
        .sort((a, b) =>
            a.title.localeCompare(
                b.title,
                'fr',
                {
                    sensitivity: 'base'
                }
            )
        );

    const MIN_TITLE_WIDTH = 50;
    const MAX_TITLE_WIDTH = 90;

    const longestTitle = rows.reduce(
        (max, row) =>
            Math.max(
                max,
                row.title.length
            ),
        0
    );

    const titleWidth = Math.min(
        MAX_TITLE_WIDTH,
        Math.max(
            MIN_TITLE_WIDTH,
            longestTitle + 10
        )
    );

    const lines = [
        '# Manga Multi-Notifier Library',
        '# Tu peux modifier ce fichier puis le réimporter.',
        '# Format : TITRE + URL',
        ''
    ];

    for (const row of rows) {
        /*
         * Pour les titres normaux, les URL sont parfaitement alignées.
         * Pour un titre exceptionnellement long, on garde le titre entier
         * et on ajoute au minimum 4 espaces avant l'URL.
         */
        const spacing =
            row.title.length < titleWidth
                ? ' '.repeat(
                    titleWidth -
                    row.title.length
                )
                : '    ';

        lines.push(
            `${row.title}${spacing}${row.url}`
        );
    }

    lines.push('');

    return lines.join('\n');
}

function parseTxt(text) {
    assertImportSize(text);

    const rows = [];

    const lines =
        String(text || '')
            .split(/\r?\n/);

    for (const rawLine of lines) {
        if (
            rows.length >=
            MAX_IMPORT_ENTRIES
        ) {
            throw new Error(
                'Trop d’entrées dans le fichier (5000 maximum).'
            );
        }

        const line =
            rawLine.trim();

        if (
            !line ||
            line.startsWith('#')
        ) {
            continue;
        }

        /*
         * On ne retient qu'une URL http(s) visible dans la ligne.
         * normalizeUrl() fera ensuite la whitelist des sites.
         */
        const match =
            line.match(
                /https?:\/\/[^\s]+/i
            );

        if (!match) {
            continue;
        }

        const rawUrl =
            match[0]
                .replace(
                    /[),;]+$/,
                    ''
                )
                .slice(
                    0,
                    2048
                );

        const title =
            cleanText(
                line
                    .slice(
                        0,
                        match.index
                    )
                    .replace(
                        /[\t|;-]+$/,
                        ''
                    ),
                MAX_TITLE_LENGTH
            );

        rows.push({
            title,
            url: rawUrl
        });
    }

    return rows;
}


// ============================================================
// Détection des nouveaux chapitres
// ============================================================

function isNewer(info, item) {
    if (item.lastSeenChapter == null) {
        return false;
    }

    const current = Number(info.chapter);
    const previous = Number(item.lastSeenChapter);

    if (
        Number.isFinite(current) &&
        Number.isFinite(previous)
    ) {
        return current > previous;
    }

    return (
        String(info.chapter) !==
            String(item.lastSeenChapter) &&
        info.chapterId !==
            item.lastSeenChapterId
    );
}

async function checkOne(item, { notify = true, archive = null } = {}) {
    const now = Date.now();

    try {
        if (!item.site) {
            const normalized = normalizeUrl(item.url);

            item.site = normalized.site;
            item.mangaId = normalized.mangaId;
                    item.webtoonId = normalized.webtoonId;
        }

        const info = await fetchInfoWithRetry(item);

        const initialized =
            item.lastSeenChapter != null;

        const isNew =
            initialized &&
            isNewer(info, item);

        Object.assign(item, {
            title:
                info.title ||
                item.title,

            coverUrl:
                info.coverUrl ||
                item.coverUrl ||
                '',

            latestChapter:
                info.chapter,

            publishedAgo:
                info.publishedAgo || '',

            publishedAt:
                info.publishedAt || '',

            lastCheck:
                now,

            lastError:
                '',

            latestChapterId:
                info.chapterId || ''
        });

        if (!initialized) {
            item.lastSeenChapter =
                info.chapter;

            item.lastSeenChapterId =
                info.chapterId || '';

            item.detectedAt = now;
        }

        if (isNew) {
            item.lastSeenChapter =
                info.chapter;

            item.lastSeenChapterId =
                info.chapterId || '';

            item.detectedAt = now;
            item.unread = true;

            if (notify) {
                const language = await getBackgroundLanguage();
                const when = info.publishedAt
                    ? ` • ${formatBackgroundDate(info.publishedAt, language)}`
                    : (info.publishedAgo ? ` • ${bgText(language, 'ago', { age: info.publishedAgo })}` : '');
                await chrome.notifications.create(
                    `manga|${encodeURIComponent(item.url)}|${encodeURIComponent(info.chapter)}`,
                    { type:'basic', iconUrl:'icon128.png', title:bgText(language,'notificationTitle'),
                      message:`${item.title} — ${bgText(language,'chapter')} ${info.chapter}${when}`, priority:2 }
                );
            }
        }

        if (archive) {
            upsertArchiveItem(
                archive,
                item,
                now
            );
        } else {
            await archiveItem(item);
        }

        return {
            isNew,
            chapter: info.chapter
        };
    } catch (error) {
        item.lastCheck = now;

        item.lastError =
            String(
                error?.message ||
                error
            );

        return {
            error:
                item.lastError
        };
    }
}


// ============================================================
// Badge / vérification globale / alarme
// ============================================================

async function updateBadge(library) {
    const unreadCount = library.filter(
        (item) => item.unread
    ).length;

    await chrome.action.setBadgeText({
        text: unreadCount
            ? String(unreadCount)
            : ''
    });

    if (unreadCount) {
        await chrome.action.setBadgeBackgroundColor({
            color: '#e53935'
        });
    }
}

async function checkAll({ notify = true } = {}) {
    const stored =
        await chrome.storage.local.get([
            'library',
            'archive'
        ]);

    const library =
        Array.isArray(stored.library)
            ? stored.library
            : [];

    const archive =
        Array.isArray(stored.archive)
            ? stored.archive
            : [];

    const concurrency =
        Math.min(
            4,
            Math.max(
                1,
                library.length
            )
        );

    let nextIndex = 0;

    async function worker() {
        while (true) {
            const index =
                nextIndex++;

            if (
                index >=
                library.length
            ) {
                return;
            }

            await checkOne(
                library[index],
                {
                    notify,
                    archive
                }
            );
        }
    }

    await Promise.all(
        Array.from(
            {
                length:
                    concurrency
            },
            () => worker()
        )
    );

    await chrome.storage.local.set({
        library,
        archive
    });

    await updateBadge(
        library
    );

    return library;
}

async function resetAlarm() {
    const {
        intervalMinutes = DEFAULT_INTERVAL
    } = await chrome.storage.local.get(
        'intervalMinutes'
    );

    await chrome.alarms.clear(CHECK_ALARM);

    chrome.alarms.create(
        CHECK_ALARM,
        {
            delayInMinutes: 1,
            periodInMinutes: Math.max(
                1,
                Number(intervalMinutes) ||
                    DEFAULT_INTERVAL
            )
        }
    );
}


// ============================================================
// Événements Chrome
// ============================================================

chrome.runtime.onInstalled.addListener(
    async () => {
        await migrateStorage();

        const data =
            await chrome.storage.local.get([
                'intervalMinutes',
                'library'
            ]);

        if (!data.intervalMinutes) {
            await chrome.storage.local.set({
                intervalMinutes:
                    DEFAULT_INTERVAL
            });
        }

        if (Array.isArray(data.library)) {
                    for (const item of data.library) {
                        try {
                            const normalized =
                                normalizeUrl(item.url);
        
                            item.site =
                                normalized.site;
        
                            item.mangaId =
                                normalized.mangaId;
        
                            item.webtoonId =
                                normalized.webtoonId;
                        } catch {
                            // On conserve l'entrée existante.
                        }
                    }
        
                    await saveLibrary(data.library);
                }

        await resetAlarm();

        await checkAll({
            notify: false
        });
    }
);

chrome.runtime.onStartup.addListener(
    async () => {
        await migrateStorage();
        await resetAlarm();
    }
);

chrome.alarms.onAlarm.addListener(
    async (alarm) => {
        if (alarm.name !== CHECK_ALARM) {
            return;
        }

        /*
         * Quand le PC sort de veille, Chrome peut déclencher
         * immédiatement une alarme qui aurait dû sonner pendant
         * la veille. À cet instant le Wi-Fi/DNS n'est pas toujours
         * encore disponible.
         */
        const lateness =
            Date.now() -
            Number(
                alarm.scheduledTime ||
                Date.now()
            );

        if (
            lateness >
            WAKE_ALARM_LATE_MS
        ) {
            await sleep(
                WAKE_NETWORK_GRACE_MS
            );
        }

        await checkAll();
    }
);

chrome.notifications.onClicked.addListener(
    (notificationId) => {
        if (
            !notificationId.startsWith('manga|')
        ) {
            return;
        }

        try {
            const rawUrl =
                decodeURIComponent(
                    notificationId
                        .split('|')[1]
                );

            const url =
                safeSupportedOpenUrl(
                    rawUrl
                );

            if (!url) {
                return;
            }

            chrome.tabs.create({
                url
            });
        } catch {
            // Notification malformée ou URL non autorisée.
        }
    }
);


// ============================================================
// Sauvegarde JSON complète
// ============================================================
async function exportJsonBackup(){const data=await chrome.storage.local.get(['library','archive','intervalMinutes','popupWidth','popupHeight','interfaceLanguage','sortMode','densityMode','storageSchemaVersion']);return JSON.stringify({format:'manga-update-notifier-backup',version:1,exportedAt:new Date().toISOString(),data},null,2);}
async function importJsonBackup(text) {
    assertImportSize(text);

    const backup =
        JSON.parse(
            String(text || '')
        );

    if (
        backup?.format !==
            'manga-update-notifier-backup' ||
        backup?.version !== 1 ||
        !backup?.data ||
        typeof backup.data !== 'object' ||
        Array.isArray(backup.data)
    ) {
        throw new Error(
            'Sauvegarde Manga Multi-Notifier invalide.'
        );
    }

    const rawLibrary =
        backup.data.library ?? [];

    const rawArchive =
        backup.data.archive ?? [];

    if (
        !Array.isArray(rawLibrary) ||
        !Array.isArray(rawArchive)
    ) {
        throw new Error(
            'Bibliothèque ou archive JSON invalide.'
        );
    }

    if (
        rawLibrary.length >
            MAX_IMPORT_ENTRIES ||
        rawArchive.length >
            MAX_IMPORT_ENTRIES
    ) {
        throw new Error(
            'Trop d’entrées dans la sauvegarde (5000 maximum par liste).'
        );
    }

    const library =
        dedupeByIdentity(
            rawLibrary.map(
                sanitizeLibraryEntry
            )
        );

    const archive =
        dedupeByIdentity(
            rawArchive.map(
                sanitizeArchiveEntry
            )
        );

    /*
     * On reconstruit uniquement les champs autorisés :
     * les propriétés supplémentaires du JSON sont ignorées.
     */
    const settings =
        sanitizeSettings(
            backup.data
        );

    const restored = {
        ...settings,
        library,
        archive,
        storageSchemaVersion:
            STORAGE_SCHEMA_VERSION
    };

    await chrome.storage.local.set(
        restored
    );

    await resetAlarm();

    await updateBadge(
        library
    );

    return restored;
}


// ============================================================
// Messages envoyés par le popup
// ============================================================

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
        (async () => {
            // Ouvrir uniquement une URL de manga supportée
            if (message?.type === 'OPEN_URL') {
                const url =
                    safeSupportedOpenUrl(
                        message.url
                    );

                if (!url) {
                    return sendResponse({
                        error:
                            'URL non autorisée.'
                    });
                }

                await chrome.tabs.create({
                    url
                });

                return sendResponse({
                    ok: true
                });
            }

            // Vérifier toute la bibliothèque
            if (message?.type === 'CHECK_ALL') {
                return sendResponse({
                    library:
                        await checkAll()
                });
            }

            // Ajouter une URL
            if (message?.type === 'ADD_URL') {
                try {
                    const normalized =
                        normalizeUrl(message.url);

                    const stored =
                        await chrome.storage.local.get([
                            'library',
                            'archive'
                        ]);

                    const library =
                        Array.isArray(stored.library)
                            ? stored.library
                            : [];

                    const archive =
                        Array.isArray(stored.archive)
                            ? stored.archive
                            : [];

                    const alreadyExists =
                        library.some(
                            (item) =>
                                item.url ===
                                    normalized.url ||
                                (
                                    normalized.mangaId &&
                                    item.mangaId ===
                                        normalized.mangaId
                                )
                        );

                    if (alreadyExists) {
                        const language = await getBackgroundLanguage();
                        return sendResponse({ error: bgText(language, 'duplicate') });
                    }

                    const item = {
                        url: normalized.url,
                        site: normalized.site,
                        mangaId:
                            normalized.mangaId,
                        webtoonId:
                            normalized.webtoonId,
                        title:
                            slugTitle(
                                normalized.url
                            )
                    };

                    await checkOne(
                        item,
                        {
                            notify: false,
                            archive
                        }
                    );

                    if (item.lastError) {
                        return sendResponse({
                            error:
                                item.lastError
                        });
                    }

                    library.push(item);

                    await chrome.storage.local.set({
                        library,
                        archive
                    });

                    return sendResponse({
                        ok: true
                    });
                } catch (error) {
                    return sendResponse({
                        error: String(
                            error.message ||
                                error
                        )
                    });
                }
            }

// Retirer une lecture active
            if (message?.type === 'REMOVE_URL') {
                const stored =
                    await chrome.storage.local.get([
                        'library',
                        'archive'
                    ]);

                const currentLibrary =
                    Array.isArray(
                        stored.library
                    )
                        ? stored.library
                        : [];

                const archive =
                    Array.isArray(
                        stored.archive
                    )
                        ? stored.archive
                        : [];

                const oldItem =
                    currentLibrary.find(
                        (item) =>
                            item.url ===
                            message.url
                    );

                if (oldItem) {
                    upsertArchiveItem(
                        archive,
                        oldItem
                    );
                }

                const library =
                    currentLibrary.filter(
                        (item) =>
                            item.url !==
                            message.url
                    );

                await chrome.storage.local.set({
                    library,
                    archive
                });

                await updateBadge(
                    library
                );

                return sendResponse({
                    ok: true
                });
            }

            if (message?.type === 'EXPORT_JSON') {
                return sendResponse({ ok:true, text:await exportJsonBackup() });
            }

            if (message?.type === 'IMPORT_JSON') {
                try { await importJsonBackup(message.text); return sendResponse({ ok:true }); }
                catch (error) { return sendResponse({ error:String(error.message || error) }); }
            }

            // Exporter l'archive TXT
            if (message?.type === 'EXPORT_TXT') {
                const archive =
                    await getArchive();

                return sendResponse({
                    ok: true,
                    text:
                        makeTxt(archive),
                    count:
                        archive.length
                });
            }

            // Importer une archive TXT
            if (message?.type === 'IMPORT_TXT') {
                const rows =
                    parseTxt(message.text);

                const stored =
                    await chrome.storage.local.get([
                        'library',
                        'archive'
                    ]);

                const library =
                    Array.isArray(stored.library)
                        ? stored.library
                        : [];

                const archive =
                    Array.isArray(stored.archive)
                        ? stored.archive
                        : [];

                let added = 0;
                let archived = 0;
                let invalid = 0;

                for (const row of rows) {
                    try {
                        const normalized =
                            normalizeUrl(row.url);

                        let item =
                            library.find(
                                (entry) =>
                                    entry.url ===
                                        normalized.url ||
                                    (
                                        normalized.mangaId &&
                                        entry.mangaId ===
                                            normalized.mangaId
                                    )
                            );

                        if (!item) {
                            item = {
                                url:
                                    normalized.url,
                                site:
                                    normalized.site,
                                mangaId:
                                    normalized.mangaId,
                                webtoonId:
                                    normalized.webtoonId,
                                title:
                                    row.title ||
                                    slugTitle(
                                        normalized.url
                                    )
                            };

                            await checkOne(
                                item,
                                {
                                    notify: false,
                                    archive
                                }
                            );

                            if (item.lastError) {
                                invalid++;
                                continue;
                            }

                            library.push(item);
                            added++;
                        } else if (
                            row.title &&
                            !item.title
                        ) {
                            item.title =
                                row.title;
                        }

                        upsertArchiveItem(
                            archive,
                            {
                                ...item,
                                title:
                                    item.title ||
                                    row.title
                            }
                        );

                        archived++;
                    } catch {
                        invalid++;
                    }
                }

                await chrome.storage.local.set({
                    library,
                    archive
                });

                await updateBadge(
                    library
                );

                return sendResponse({
                    ok: true,
                    added,
                    archived,
                    invalid
                });
            }

            // Marquer un manga comme lu
            if (message?.type === 'MARK_READ') {
                const library =
                    await getLibrary();

                const item =
                    library.find(
                        (entry) =>
                            entry.url ===
                            message.url
                    );

                if (item) {
                    item.unread = false;
                }

                await saveLibrary(library);
                await updateBadge(library);

                return sendResponse({
                    ok: true
                });
            }

            // Reprogrammer la vérification
            if (message?.type === 'RESET_ALARM') {
                await resetAlarm();

                return sendResponse({
                    ok: true
                });
            }
        })()
            .catch((error) => {
                sendResponse({
                    error: String(
                        error.message ||
                            error
                    )
                });
            });

        return true;
    }
);
