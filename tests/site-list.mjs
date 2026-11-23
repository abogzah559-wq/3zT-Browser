// Websites for the site check (tests/site-check.mjs): widely used sites worldwide and in the Arabic-speaking world.
// Pages that need no account; sites that send a visitor to a sign-in page are still listed (the sign-in page itself is checked).
export const GLOBAL = [
  'https://www.google.com/', 'https://www.youtube.com/', 'https://www.facebook.com/', 'https://www.instagram.com/', 'https://x.com/',
  'https://en.wikipedia.org/wiki/Main_Page', 'https://www.reddit.com/', 'https://www.amazon.com/', 'https://www.yahoo.com/', 'https://www.tiktok.com/explore',
  'https://www.linkedin.com/', 'https://www.netflix.com/', 'https://www.bing.com/', 'https://outlook.live.com/', 'https://www.microsoft.com/',
  'https://www.office.com/', 'https://www.twitch.tv/', 'https://discord.com/', 'https://www.whatsapp.com/', 'https://web.whatsapp.com/',
  'https://chatgpt.com/', 'https://claude.ai/', 'https://gemini.google.com/', 'https://github.com/', 'https://stackoverflow.com/questions',
  'https://www.apple.com/', 'https://www.ebay.com/', 'https://www.aliexpress.com/', 'https://www.temu.com/', 'https://www.shein.com/',
  'https://www.walmart.com/', 'https://www.imdb.com/', 'https://open.spotify.com/', 'https://www.pinterest.com/', 'https://www.quora.com/',
  'https://edition.cnn.com/', 'https://www.bbc.com/news', 'https://www.nytimes.com/', 'https://www.theguardian.com/international', 'https://www.foxnews.com/',
  'https://weather.com/', 'https://www.accuweather.com/', 'https://www.espn.com/', 'https://www.fandom.com/', 'https://www.canva.com/',
  'https://zoom.us/', 'https://www.dropbox.com/', 'https://www.paypal.com/', 'https://www.booking.com/', 'https://www.airbnb.com/',
  'https://www.tripadvisor.com/', 'https://duckduckgo.com/', 'https://www.baidu.com/', 'https://web.telegram.org/', 'https://vk.com/',
  'https://www.naver.com/', 'https://www.roblox.com/', 'https://store.epicgames.com/', 'https://store.steampowered.com/', 'https://www.ign.com/',
  'https://www.gamespot.com/', 'https://www.chess.com/', 'https://www.duolingo.com/', 'https://www.coursera.org/', 'https://www.udemy.com/',
  'https://www.khanacademy.org/', 'https://medium.com/', 'https://substack.com/', 'https://www.notion.com/', 'https://www.figma.com/',
  'https://trello.com/', 'https://slack.com/', 'https://www.adobe.com/', 'https://www.nvidia.com/', 'https://www.amd.com/',
  'https://www.samsung.com/', 'https://www.speedtest.net/', 'https://archive.org/', 'https://www.cloudflare.com/', 'https://wordpress.com/',
  'https://www.tumblr.com/', 'https://soundcloud.com/', 'https://www.deezer.com/', 'https://vimeo.com/', 'https://www.dailymotion.com/',
  'https://kick.com/', 'https://www.crunchyroll.com/', 'https://www.disneyplus.com/', 'https://www.primevideo.com/', 'https://www.forbes.com/',
  'https://www.bloomberg.com/', 'https://www.reuters.com/', 'https://www.cnbc.com/', 'https://www.investing.com/', 'https://www.tradingview.com/',
  'https://coinmarketcap.com/', 'https://www.binance.com/', 'https://www.etsy.com/', 'https://www.ikea.com/', 'https://www.nike.com/',
  'https://www.google.com/maps', 'https://translate.google.com/', 'https://news.google.com/', 'https://www.wix.com/', 'https://www.shopify.com/'
];

export const ARABIC = [
  'https://www.aljazeera.net/', 'https://www.alarabiya.net/', 'https://sabq.org/', 'https://www.okaz.com.sa/', 'https://www.alriyadh.com/',
  'https://www.spa.gov.sa/', 'https://haraj.com.sa/', 'https://www.noon.com/saudi-ar/', 'https://www.amazon.sa/', 'https://www.jarir.com/',
  'https://www.extra.com/ar-sa/', 'https://shahid.mbc.net/ar', 'https://www.mbc.net/ar', 'https://www.kooora.com/', 'https://www.yallakora.com/',
  'https://www.filgoal.com/', 'https://www.youm7.com/', 'https://www.masrawy.com/', 'https://www.almasryalyoum.com/', 'https://www.elwatannews.com/',
  'https://www.shorouknews.com/', 'https://gate.ahram.org.eg/', 'https://www.hespress.com/', 'https://www.alwatan.com.sa/', 'https://aawsat.com/',
  'https://www.independentarabia.com/', 'https://www.skynewsarabia.com/', 'https://www.bbc.com/arabic', 'https://arabic.cnn.com/', 'https://www.france24.com/ar/',
  'https://www.dw.com/ar/', 'https://mawdoo3.com/', 'https://www.almrsal.com/', 'https://www.sayidaty.net/', 'https://www.layalina.com/',
  'https://www.argaam.com/ar', 'https://www.mubasher.info/', 'https://www.aleqt.com/', 'https://maaal.com/', 'https://www.alyaum.com/',
  'https://www.al-madina.com/', 'https://www.emaratalyoum.com/', 'https://www.albayan.ae/', 'https://www.alkhaleej.ae/', 'https://www.alqabas.com/',
  'https://www.alraimedia.com/', 'https://www.aljarida.com/', 'https://www.alanba.com.kw/', 'https://www.annahar.com/', 'https://www.akhbarelyom.com/',
  'https://www.elbalad.news/', 'https://www.vetogate.com/', 'https://www.my.gov.sa/', 'https://www.absher.sa/', 'https://www.moh.gov.sa/',
  'https://www.stc.com.sa/', 'https://www.mobily.com.sa/', 'https://sa.zain.com/ar', 'https://www.alrajhibank.com.sa/', 'https://www.alahli.com/',
  'https://www.careem.com/ar-AE/', 'https://hungerstation.com/sa-ar', 'https://www.jahez.net/', 'https://mrsool.co/', 'https://www.talabat.com/ar/uae',
  'https://salla.com/', 'https://zid.sa/', 'https://tamara.co/ar-SA', 'https://tabby.ai/ar-SA', 'https://www.namshi.com/saudi-ar/',
  'https://www.ounass.com/', 'https://www.goldenscent.com/ar/', 'https://www.nahdionline.com/ar-sa', 'https://www.bayut.sa/', 'https://sa.aqar.fm/',
  'https://sa.opensooq.com/ar', 'https://www.dubizzle.com/', 'https://www.propertyfinder.ae/ar/', 'https://www.almosafer.com/ar', 'https://www.flynas.com/ar',
  'https://www.saudia.com/ar-SA', 'https://www.flyadeal.com/ar', 'https://ar.wego.com/', 'https://www.kau.edu.sa/', 'https://ksu.edu.sa/ar/',
  'https://thmanyah.com/', 'https://www.anghami.com/', 'https://www.tod.tv/ar', 'https://www.osnplus.com/ar', 'https://www.weyyak.com/ar',
  'https://quran.com/ar', 'https://www.islamweb.net/ar/', 'https://islamqa.info/ar', 'https://dorar.net/', 'https://www.alukah.net/',
  'https://aitnews.com/', 'https://www.arageek.com/', 'https://www.tech-wd.com/wd/', 'https://www.365scores.com/ar', 'https://ar.wikipedia.org/wiki/'
];

