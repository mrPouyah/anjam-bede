const https = require('https');
const http = require('http');
const crypto = require('crypto');

const CATEGORIES = {
  tech: {
    name: 'فناوری و هوش مصنوعی',
    keywords: ['هوش مصنوعی', 'فناوری', 'تکنولوژی', 'اینترنت', 'دیجیتال', 'ربات']
  },
  science: {
    name: 'علم و دانش',
    keywords: ['علمی', 'نجوم', 'پزشکی', 'دانشگاه', 'پژوهش', 'سلامت']
  },
  economy: {
    name: 'اقتصاد و بازار',
    keywords: ['اقتصاد', 'بورس', 'طلا', 'ارز', 'بازار', 'بانک', 'تورم']
  },
  culture: {
    name: 'فرهنگ و هنر',
    keywords: ['فرهنگ', 'هنر', 'سینما', 'تئاتر', 'کتاب', 'ادبیات', 'موسیقی']
  }
};

const PERSIAN_FEEDS = [
  { url: 'https://www.mehrnews.com/rss', source: 'خبرگزاری مهر' },
  { url: 'https://www.isna.ir/rss', source: 'ایسنا' }
];

const PERSIAN_SOURCE_NAMES = [
  'ایرنا', 'ایسنا', 'خبرگزاری مهر', 'تسنیم', 'خبرآنلاین',
  'فرارو', 'انتخاب', 'زومیت', 'دیجیاتو', 'گجت نیوز', 'شرق',
  'همشهری', 'دنیای اقتصاد', 'عصر ایران', 'ایمنا'
];

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // Refresh live feeds every 5 minutes

function fetchWithRedirects(targetUrl, maxRedirects = 4) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return reject(new Error('Too many redirects'));
    const client = targetUrl.startsWith('https:') ? https : http;
    const req = client.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          const origin = new URL(targetUrl).origin;
          redirectUrl = new URL(redirectUrl, origin).toString();
        }
        return resolve(fetchWithRedirects(redirectUrl, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => resolve(raw));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(xml, tagName) {
  const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regularRegex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regularRegex);
  return match ? match[1].trim() : '';
}

function extractImage(descriptionXml, rawItem) {
  // Check for enclosure or media:content url attribute
  const enclosureMatch = rawItem.match(/url="([^"]+\.(?:jpg|jpeg|png|webp|gif)[^"]*)"/i) ||
                         rawItem.match(/<enclosure[^>]*url="([^"]+)"/i) ||
                         rawItem.match(/<media:content[^>]*url="([^"]+)"/i);
  if (enclosureMatch) return enclosureMatch[1];

  // Look for img src in description HTML
  const imgMatch = descriptionXml.match(/<img[^>]+src="([^">]+)"/i);
  if (imgMatch) return imgMatch[1];

  return null;
}

function parseRelativeTime(dateStr) {
  try {
    const pub = new Date(dateStr);
    if (isNaN(pub.getTime())) return 'به‌تازگی';
    const diffHours = Math.floor((Date.now() - pub.getTime()) / (1000 * 60 * 60));
    if (diffHours < 1) return 'چند لحظه پیش';
    if (diffHours < 24) return `${toFaDigits(diffHours)} ساعت پیش`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'دیروز';
    return `${toFaDigits(diffDays)} روز پیش`;
  } catch {
    return 'به‌تازگی';
  }
}

function toFaDigits(num) {
  return String(num).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

function isPersianText(value) {
  const text = stripHtml(value || '');
  if (text.length < 18) return false;
  const letters = text.match(/[A-Za-z\u0600-\u06FF]/g) || [];
  if (!letters.length) return false;
  const persianLetters = text.match(/[\u0600-\u06FF]/g) || [];
  const persianSpecificLetters = text.match(/[پچژگکی]/g) || [];
  const arabicOrthography = text.match(/[كيى]/g) || [];
  return persianLetters.length / letters.length >= 0.7
    && persianSpecificLetters.length >= 2
    && arabicOrthography.length <= persianSpecificLetters.length;
}

function isPersianSource(value) {
  const source = String(value || '').trim();
  return PERSIAN_SOURCE_NAMES.some(name => source.includes(name));
}

function containsKeyword(text, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z\\u0600-\\u06FF])${escaped}(?=$|[^A-Za-z\\u0600-\\u06FF])`, 'i').test(text);
}

function parseRss(rssText, categoryKey, sourceOverride = '') {
  const items = rssText.split(/<item[\s>]/i).slice(1);
  const articles = [];

  for (const raw of items) {
    const itemXml = raw.split(/<\/item>/i)[0];
    const fullTitle = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const descRaw = extractTag(itemXml, 'description');
    const source = extractTag(itemXml, 'source') || sourceOverride;

    // Google may return English stories even with fa/IR locale parameters.
    // Keep only stories whose title is predominantly Persian.
    if (!isPersianText(fullTitle) || !isPersianSource(source)) continue;

    // Google RSS titles often end with "- Source Name"
    let title = fullTitle;
    let detectedSource = source;
    const hyphenIdx = fullTitle.lastIndexOf(' - ');
    if (hyphenIdx > 0) {
      title = fullTitle.substring(0, hyphenIdx).trim();
      if (!detectedSource) {
        detectedSource = fullTitle.substring(hyphenIdx + 3).trim();
      }
    }

    const cleanDesc = stripHtml(descRaw);
    const imageUrl = extractImage(descRaw, itemXml);
    const keywords = CATEGORIES[categoryKey]?.keywords || [];
    const searchableText = title;
    if (keywords.length && !keywords.some(keyword => containsKeyword(searchableText, keyword))) continue;

    articles.push({
      id: crypto.createHash('sha256').update(link || title).digest('hex').slice(0, 16),
      title: title || 'بدون عنوان',
      summary: cleanDesc.length > 220 ? cleanDesc.slice(0, 217) + '…' : cleanDesc,
      imageUrl: imageUrl,
      url: link,
      source: detectedSource || 'منبع خبر',
      publishedAt: parseRelativeTime(pubDate),
      category: categoryKey,
      categoryName: CATEGORIES[categoryKey]?.name || 'خبر'
    });

    if (articles.length >= 10) break;
  }

  return articles;
}

async function fetchCategoryNews(categoryKey) {
  const targetCategory = CATEGORIES[categoryKey];
  if (!targetCategory) return [];

  const results = await Promise.allSettled(PERSIAN_FEEDS.map(async feed => {
    const xml = await fetchWithRedirects(feed.url);
    return parseRss(xml, categoryKey, feed.source);
  }));
  const articles = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  const unique = [...new Map(articles.map(article => [article.url || article.id, article])).values()];
  return unique.slice(0, 10);
}

async function getNews(category = 'all') {
  const now = Date.now();
  const cached = cache.get(category);
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  let articles = [];

  if (category === 'all') {
    const keys = Object.keys(CATEGORIES);
    const results = await Promise.allSettled(keys.map(k => getNews(k)));
    results.forEach(res => {
      if (res.status === 'fulfilled' && Array.isArray(res.value?.articles)) {
        articles.push(...res.value.articles.slice(0, 3));
      }
    });
    // Shuffle a bit or interleave
    articles.sort(() => Math.random() - 0.5);
  } else {
    articles = await fetchCategoryNews(category);
  }

  // Fallback items if external network is blocked/unavailable
  // Demo articles are opt-in only. Production news must come from the internet.
  if (process.env.NEWS_ALLOW_DEMO_FALLBACK === 'true' && (!articles || articles.length === 0)) {
    const fallbacks = {
      tech: [
        {
          id: 'fb-t1',
          title: 'رونمایی از نسل نوین پردازنده‌های عصبی با کارایی بالا در ابزارهای روزمره',
          summary: 'توسعه‌دهندگان فناوری از طراحی تراشه‌های پردازش مستقیم هوش مصنوعی روی دستگاه‌ها خبر دادند که مصرف انرژی را به حداقل می‌رساند.',
          imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
          url: 'https://news.google.com',
          source: 'دنیای فناوری',
          publishedAt: '۱ ساعت پیش',
          category: 'tech',
          categoryName: CATEGORIES.tech.name
        },
        {
          id: 'fb-t2',
          title: 'تحول معماری مدل‌های چندوجهی و ترجمه هم‌زمان زبان‌ها',
          summary: 'الگوریتم‌های تازه یادگیری عمیق امکان درک متون چندزبانه و تفسیر حالات گفتاری را با دقت بی‌سابقه‌ای میسر ساخته‌اند.',
          imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
          url: 'https://news.google.com',
          source: 'هوش و آینده',
          publishedAt: '۳ ساعت پیش',
          category: 'tech',
          categoryName: CATEGORIES.tech.name
        }
      ],
      science: [
        {
          id: 'fb-s1',
          title: 'تصویربرداری تلسکوپ‌های فضایی از تولد ستاره‌های نوزاد در کهکشان همسایه',
          summary: 'اخترشناسان با پردازش طیف‌های فروسرخ شواهدی تازه از شکل‌گیری منظومه‌های سیاره‌ای در ابرهای غبارآلود میان‌ستاره‌ای به دست آوردند.',
          imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
          url: 'https://news.google.com',
          source: 'مجله کیهان و فضا',
          publishedAt: '۲ ساعت پیش',
          category: 'science',
          categoryName: CATEGORIES.science.name
        }
      ],
      economy: [
        {
          id: 'fb-e1',
          title: 'گسترش پرداخت‌های دیجیتال و تحول بانکداری الکترونیک در منطقه',
          summary: 'سامانه‌های یکپارچه تسویه حساب و تراکنش‌های برخط سرعت گردش نقدینگی و اعتماد کسب‌وکارهای نوپا را ارتقا بخشیده‌اند.',
          imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&auto=format&fit=crop&q=80',
          url: 'https://news.google.com',
          source: 'اقتصاد و توسعه',
          publishedAt: '۴ ساعت پیش',
          category: 'economy',
          categoryName: CATEGORIES.economy.name
        }
      ],
      culture: [
        {
          id: 'fb-c1',
          title: 'برگزاری رویداد ملی خوشنویسی و نگارگری معاصر با حضور اساتید برجسته',
          summary: 'این گردهمایی با هدف بازخوانی سنت‌های کتاب‌آرایی و تلفیق آن با طراحی گرافیک امروزی در فرهنگستان هنر دایر شده است.',
          imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
          url: 'https://news.google.com',
          source: 'نگارستان فرهنگ',
          publishedAt: 'دیروز',
          category: 'culture',
          categoryName: CATEGORIES.culture.name
        }
      ]
    };

    if (category === 'all') {
      articles = Object.values(fallbacks).flat();
    } else {
      articles = fallbacks[category] || [];
    }
  }

  const resultPayload = {
    category,
    articles: articles.slice(0, 12),
    timestamp: now
  };

  cache.set(category, { timestamp: now, data: resultPayload });
  return resultPayload;
}

module.exports = {
  getNews,
  CATEGORIES
};
