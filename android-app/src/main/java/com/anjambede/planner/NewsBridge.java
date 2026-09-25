package com.anjambede.planner;

import android.text.Html;
import android.webkit.JavascriptInterface;
import android.util.Xml;

import org.json.JSONArray;
import org.json.JSONObject;
import org.xmlpull.v1.XmlPullParser;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class NewsBridge {
    private static final String[][] FEEDS = {
        {"https://www.mehrnews.com/rss", "خبرگزاری مهر"},
        {"https://www.isna.ir/rss", "ایسنا"}
    };

    private static final Map<String, String> CATEGORY_NAMES = new LinkedHashMap<>();
    private static final Map<String, String[]> KEYWORDS = new LinkedHashMap<>();

    static {
        CATEGORY_NAMES.put("tech", "فناوری و هوش مصنوعی");
        CATEGORY_NAMES.put("science", "علم و دانش");
        CATEGORY_NAMES.put("economy", "اقتصاد و بازار");
        CATEGORY_NAMES.put("culture", "فرهنگ و هنر");
        KEYWORDS.put("tech", new String[]{"هوش مصنوعی", "فناوری", "تکنولوژی", "اینترنت", "دیجیتال", "ربات"});
        KEYWORDS.put("science", new String[]{"علمی", "نجوم", "پزشکی", "دانشگاه", "پژوهش", "سلامت"});
        KEYWORDS.put("economy", new String[]{"اقتصاد", "بورس", "طلا", "ارز", "بازار", "بانک", "تورم"});
        KEYWORDS.put("culture", new String[]{"فرهنگ", "هنر", "سینما", "تئاتر", "کتاب", "ادبیات", "موسیقی"});
    }

    @JavascriptInterface
    public String getNews(String requestedCategory) {
        String category = CATEGORY_NAMES.containsKey(requestedCategory) || "all".equals(requestedCategory)
            ? requestedCategory : "all";
        JSONArray output = new JSONArray();
        try {
            List<Article> fetched = new ArrayList<>();
            for (String[] feed : FEEDS) {
                try { fetched.addAll(readFeed(feed[0], feed[1])); } catch (Exception ignored) { }
            }

            Map<String, Integer> categoryCounts = new HashMap<>();
            for (Article article : fetched) {
                String matchedCategory = matchCategory(article.title);
                if (matchedCategory == null) continue;
                if (!"all".equals(category) && !category.equals(matchedCategory)) continue;
                int limit = "all".equals(category) ? 3 : 10;
                int count = categoryCounts.containsKey(matchedCategory) ? categoryCounts.get(matchedCategory) : 0;
                if (count >= limit) continue;
                categoryCounts.put(matchedCategory, count + 1);
                output.put(toJson(article, matchedCategory));
                if (!"all".equals(category) && output.length() >= 10) break;
                if ("all".equals(category) && output.length() >= 12) break;
            }

            JSONObject result = new JSONObject();
            result.put("category", category);
            result.put("articles", output);
            result.put("timestamp", System.currentTimeMillis());
            return result.toString();
        } catch (Exception error) {
            JSONObject result = new JSONObject();
            try {
                result.put("category", category);
                result.put("articles", output);
                result.put("error", error.getMessage());
            } catch (Exception ignored) { }
            return result.toString();
        }
    }

    private List<Article> readFeed(String address, String defaultSource) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("User-Agent", "AnjamBede/1.0 Android");
        connection.setRequestProperty("Accept", "application/rss+xml, application/xml, text/xml");
        try (InputStream input = connection.getInputStream()) {
            XmlPullParser parser = Xml.newPullParser();
            parser.setInput(input, StandardCharsets.UTF_8.name());
            List<Article> articles = new ArrayList<>();
            Article current = null;
            int event = parser.getEventType();
            while (event != XmlPullParser.END_DOCUMENT) {
                String name = parser.getName();
                if (event == XmlPullParser.START_TAG && "item".equalsIgnoreCase(name)) {
                    current = new Article();
                    current.source = defaultSource;
                } else if (event == XmlPullParser.START_TAG && current != null) {
                    if ("title".equalsIgnoreCase(name)) current.title = parser.nextText().trim();
                    else if ("link".equalsIgnoreCase(name)) current.url = parser.nextText().trim();
                    else if ("description".equalsIgnoreCase(name)) current.description = parser.nextText();
                    else if ("pubDate".equalsIgnoreCase(name)) current.publishedAt = parser.nextText().trim();
                    else if ("source".equalsIgnoreCase(name)) current.source = parser.nextText().trim();
                    else if ("enclosure".equalsIgnoreCase(name) || "content".equalsIgnoreCase(name)) {
                        String candidate = parser.getAttributeValue(null, "url");
                        if (candidate != null) current.imageUrl = candidate;
                    }
                } else if (event == XmlPullParser.END_TAG && "item".equalsIgnoreCase(name) && current != null) {
                    if (isPersian(current.title) && current.url != null) articles.add(current);
                    current = null;
                }
                event = parser.next();
            }
            return articles;
        } finally {
            connection.disconnect();
        }
    }

    private String matchCategory(String title) {
        for (Map.Entry<String, String[]> category : KEYWORDS.entrySet()) {
            for (String keyword : category.getValue()) {
                String boundary = "(^|[^A-Za-z\\u0600-\\u06FF])" + Pattern.quote(keyword)
                    + "(?=$|[^A-Za-z\\u0600-\\u06FF])";
                if (Pattern.compile(boundary, Pattern.CASE_INSENSITIVE).matcher(title).find()) return category.getKey();
            }
        }
        return null;
    }

    private boolean isPersian(String text) {
        if (text == null || text.length() < 18) return false;
        int script = 0;
        int latin = 0;
        for (char character : text.toCharArray()) {
            if (character >= '\u0600' && character <= '\u06ff') script++;
            else if ((character >= 'A' && character <= 'Z') || (character >= 'a' && character <= 'z')) latin++;
        }
        return script >= 8 && script > latin;
    }

    private JSONObject toJson(Article article, String category) throws Exception {
        JSONObject value = new JSONObject();
        value.put("id", sha256(article.url).substring(0, 16));
        value.put("title", article.title);
        String summary = Html.fromHtml(article.description == null ? "" : article.description, Html.FROM_HTML_MODE_LEGACY).toString().replaceAll("\\s+", " ").trim();
        value.put("summary", summary.length() > 220 ? summary.substring(0, 217) + "…" : summary);
        value.put("imageUrl", article.imageUrl == null ? JSONObject.NULL : article.imageUrl);
        value.put("url", article.url);
        value.put("source", article.source);
        value.put("publishedAt", "به‌تازگی");
        value.put("category", category);
        value.put("categoryName", CATEGORY_NAMES.get(category));
        return value;
    }

    private String sha256(String value) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder output = new StringBuilder();
        for (byte item : digest) output.append(String.format(Locale.US, "%02x", item));
        return output.toString();
    }

    private static final class Article {
        String title;
        String description;
        String imageUrl;
        String url;
        String source;
        String publishedAt;
    }
}
