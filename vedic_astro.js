
document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // HTML ELEMENTS
  // ==========================================

  const grid = document.getElementById("vedicRashiGrid");
  const result = document.getElementById("vedicRashiResult");
  const form = document.getElementById("vedicKundliForm");
  const kundliResult = document.getElementById("vedicKundliResult");

  const horoscopeLanguage =
    document.getElementById("vedicLanguage");

  const kundliLanguage =
    document.getElementById("vedicKundliLanguage");

  let selectedSign = "";
  let horoscopeRequestId = 0;
  let horoscopeAbortController = null;
  let phaladeshInFlight = false;
  let kundliInFlight = false;
  let lastPhaladeshRequestAt = 0;
  const PHALADESH_COOLDOWN_MS = 12000;

  // ==========================================
  // RASHI MAPPING
  // ==========================================

  const rashiMap = {
    mesha: "aries",
    vrishabha: "taurus",
    mithuna: "gemini",
    karka: "cancer",
    simha: "leo",
    kanya: "virgo",
    tula: "libra",
    vrishchika: "scorpio",
    dhanu: "sagittarius",
    makara: "capricorn",
    kumbha: "aquarius",
    meena: "pisces"
  };

  // ==========================================
  // RASHI SELECTION
  // ==========================================

  grid?.addEventListener("click", async event => {
    const button = event.target.closest("[data-sign]");

    if (!button) return;

    const sanskritSign = button.dataset.sign.toLowerCase();
    selectedSign = rashiMap[sanskritSign];

    if (!selectedSign) return;

    grid.querySelectorAll(".astro-sign").forEach(item => {
      item.classList.remove("is-selected");
    });

    button.classList.add("is-selected");

    await loadRashiHoroscope();
  });

  // ==========================================
  // DAILY RASHIFAL
  // ==========================================

  async function loadRashiHoroscope() {
    if (!selectedSign || !result) return;

    const requestId = ++horoscopeRequestId;
    const language = horoscopeLanguage?.value || "en";

    // Cancel the previous sign/language request so stale responses
    // cannot overwrite the user's latest selection.
    if (horoscopeAbortController) horoscopeAbortController.abort();
    horoscopeAbortController = new AbortController();

    showMessage(result, "Loading your daily Rashi reading...");

    try {
      const data = await getRashiHoroscope(
        selectedSign,
        language,
        horoscopeAbortController.signal
      );

      if (requestId !== horoscopeRequestId) return;
      displayRashiHoroscope(data, result);

    } catch (error) {
      if (error.name === "AbortError") return;
      if (requestId !== horoscopeRequestId) return;

      console.error("Rashifal error:", error);
      showMessage(result, friendlyApiMessage(error));
    }
  }

  horoscopeLanguage?.addEventListener("change", () => {
    if (selectedSign) loadRashiHoroscope();
  });

  // ==========================================
  // ADD PHALADESH BUTTON
  // ==========================================

  let phaladeshButton = null;

  if (form && kundliResult) {
    phaladeshButton = document.createElement("button");

    phaladeshButton.type = "button";
    phaladeshButton.className = "astro-btn astro-btn-outline";
    phaladeshButton.textContent = "Generate Full Phaladesh ✧";
    phaladeshButton.style.marginTop = "12px";

    form.appendChild(phaladeshButton);

    phaladeshButton.addEventListener(
      "click",
      generatePhaladesh
    );
  }

  // ==========================================
  // KUNDLI FORM
  // ==========================================

  form?.addEventListener("submit", async event => {
    event.preventDefault();

    if (kundliInFlight) return;

    const birth = getBirthDetails();

    if (!birth) {
      showMessage(
        kundliResult,
        "Please enter your birth date, time and birthplace."
      );
      return;
    }

    kundliInFlight = true;

    const submitButton =
      form.querySelector('[type="submit"]');

    const originalText = submitButton?.textContent;

    setButtonState(
      submitButton,
      true,
      "Calculating your Kundli..."
    );

    showMessage(
      kundliResult,
      "Calculating your Vedic birth chart..."
    );

    try {
      const data = await getKundli(birth);

      displayKundli(data, kundliResult, birth.name);

    } catch (error) {
      console.error("Kundli error:", error);

      showMessage(
        kundliResult,
        error.message || "Unable to generate your Kundli."
      );

    } finally {
      kundliInFlight = false;
      setButtonState(submitButton, false, originalText);
    }
  });

  // ==========================================
  // GENERATE FULL PHALADESH
  // ==========================================

  async function generatePhaladesh() {
    if (phaladeshInFlight) return;

    const now = Date.now();
    const waitRemaining = PHALADESH_COOLDOWN_MS - (now - lastPhaladeshRequestAt);

    if (waitRemaining > 0) {
      showMessage(
        kundliResult,
        `Please wait ${Math.ceil(waitRemaining / 1000)} seconds before requesting another full report. This helps avoid the provider's rate limit.`
      );
      return;
    }

    const birth = getBirthDetails();

    if (!birth) {
      showMessage(
        kundliResult,
        "Please enter your birth date, time and birthplace first."
      );
      return;
    }

    phaladeshInFlight = true;
    lastPhaladeshRequestAt = Date.now();

    setButtonState(
      phaladeshButton,
      true,
      "Preparing your life analysis..."
    );

    showMessage(
      kundliResult,
      "Your detailed Phaladesh is being calculated. Please wait..."
    );

    try {
   const report = await getPhaladesh(birth);

displayPhaladesh(
  report,
  kundliResult,
  birth.name
);

// Add topic-based AI explanations below the original report
addGeminiExplanation(
  report,
  kundliResult,
  birth.language
);
    } catch (error) {
      console.error("Phaladesh error:", error);

      showMessage(
        kundliResult,
        friendlyApiMessage(error)
      );

    } finally {
      phaladeshInFlight = false;
      setButtonState(
        phaladeshButton,
        false,
        "Generate Full Phaladesh ✧"
      );
    }
  }

  // ==========================================
  // READ BIRTH FORM
  // ==========================================

  function getBirthDetails() {
    if (!form) return null;

    const formData = new FormData(form);

    const name = String(
      formData.get("name") || ""
    ).trim();

    const date = formData.get("date");
    const time = formData.get("time");

    const place = String(
      formData.get("place") || ""
    ).trim();

    if (!date || !time || !place) return null;

    return {
      name,
      date,
      time,
      place,
      language: kundliLanguage?.value || "en"
    };
  }

  // ==========================================
  // API: DAILY RASHIFAL
  // ==========================================

  async function getRashiHoroscope(sign, language = "en", signal) {
    const params = new URLSearchParams({
      action: "horoscope",
      sign,
      period: "daily",
      lang: language
    });

    const response = await fetch(
      `/.netlify/functions/astrology?${params}`,
      { signal, headers: { Accept: "application/json" } }
    );

    const payload = await readResponse(response);
    return payload.data ?? payload;
  }

  // ==========================================
  // API: BASIC KUNDLI
  // ==========================================

  async function getKundli(birth) {
    const payload = await postAstrology("kundli", {
      birth: {
        date: birth.date,
        time: birth.time,
        place: { query: birth.place }
      },
      options: {
        lang: birth.language,
        ayanamsa: "lahiri",
        house_system: "whole_sign"
      }
    });

    return payload.data ?? payload;
  }

  // ==========================================
  // API: FULL VEDIC PHALADESH
  // ==========================================

  async function getPhaladesh(birth) {
    const payload = await postAstrology("phaladesh", {
      birth: {
        date: birth.date,
        time: birth.time,
        place: { query: birth.place }
      },

      name: birth.name || undefined,

      include: [
        "kundli",
        "divisional:D2,D9,D10",
        "dasha:2",
        "current_dasha",
        "yogas",
        "wealth",
        "shadbala",
        "year_outlook"
      ],

      options: {
        lang: birth.language,
        ayanamsa: "lahiri",
        house_system: "whole_sign",
        tone: "descriptive"
      }
    });

    
const finalReport = payload.data ?? payload;

// Diagnostic 1: Check the top-level response structure.
console.log(
  "ASTROLOGICS REPORT KEYS:",
  Object.keys(finalReport || {})
);

// Diagnostic 2: Check which calculations succeeded.
console.log(
  "ASTROLOGICS CALCULATION STATUS:",
  Object.fromEntries(
    Object.entries(finalReport?.calculations || {}).map(
      ([key, value]) => [
        key,
        {
          success: value?.success,
          hasData: value?.data != null,
          dataType: Array.isArray(value?.data)
            ? "array"
            : typeof value?.data,
          error: value?.error || null
        }
      ]
    )
  )
);

return finalReport;

  }


  
// ==========================================
// GEMINI AI — EXPLAIN ASTROLOGICS REPORT
// ==========================================


// ==========================================
// GEMINI AI — PREMIUM STRUCTURED UI
// ==========================================

function addGeminiExplanation(report, container, language = "en") {
  const section = document.createElement("section");
  section.className = "gemini-panel";

  const header = document.createElement("div");
  header.className = "gemini-panel-header";

  const eyebrow = document.createElement("span");
  eyebrow.className = "gemini-eyebrow";
  eyebrow.textContent = "✦ PARAS BABA · AI INSIGHTS";

  const heading = document.createElement("h3");
  heading.textContent = language === "hi"
    ? "अपनी कुंडली को विस्तार से समझें"
    : "Explore Your Kundali";

  const description = document.createElement("p");
  description.textContent = language === "hi"
    ? "किसी विषय को चुनें और AstroLogics की गणनाओं पर आधारित उसका अलग-अलग विश्लेषण प्राप्त करें।"
    : "Choose a life area to receive a focused explanation based on your actual AstroLogics calculations.";

  header.append(eyebrow, heading, description);

  const consentBox = document.createElement("label");
  consentBox.className = "gemini-consent";

  const consent = document.createElement("input");
  consent.type = "checkbox";

  const consentText = document.createElement("span");
  consentText.textContent = language === "hi"
    ? "मैं चुने गए विषय की व्याख्या के लिए अपनी AstroLogics गणना का आवश्यक डेटा Groq AI को भेजने की सहमति देता/देती हूँ।"
    : "I agree to send the relevant AstroLogics calculation data to Groq AI for the selected explanation.";

  consentBox.append(consent, consentText);

  const topicGrid = document.createElement("div");
  topicGrid.className = "gemini-topic-grid";

  const topics = [
    { id: "career", icon: "💼", en: "Career & Profession", hi: "करियर और पेशा", descEn: "Career direction and work strengths", descHi: "करियर दिशा और कार्य क्षमता" },
    { id: "education", icon: "🎓", en: "Education", hi: "शिक्षा", descEn: "Studies and learning indicators", descHi: "पढ़ाई और शिक्षा के संकेत" },
    { id: "marriage", icon: "💍", en: "Marriage & Relationships", hi: "विवाह और रिश्ते", descEn: "Partnership and marriage indicators", descHi: "विवाह और संबंधों के संकेत" },
    { id: "finance", icon: "₹", en: "Finance & Wealth", hi: "धन और वित्त", descEn: "Income, savings and wealth", descHi: "आय, बचत और धन" },
    { id: "travel", icon: "✈️", en: "Foreign Travel", hi: "विदेश यात्रा", descEn: "Travel and relocation indicators", descHi: "यात्रा और स्थान परिवर्तन" },
    { id: "dasha", icon: "⏳", en: "Dasha & Timing", hi: "दशा और समय", descEn: "Actual planetary periods and dates", descHi: "वास्तविक ग्रह दशाएँ और तिथियाँ" },
    { id: "overall", icon: "✦", en: "Overall Overview", hi: "संपूर्ण कुंडली", descEn: "A concise chart overview", descHi: "कुंडली का संक्षिप्त विश्लेषण" }
  ];

  const status = document.createElement("p");
  status.className = "gemini-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const output = document.createElement("div");
  output.className = "gemini-results";

  let activeRequest = 0;

  topics.forEach(topic => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gemini-topic-btn";
    button.dataset.topic = topic.id;

    const title = language === "hi" ? topic.hi : topic.en;
    const desc = language === "hi" ? topic.descHi : topic.descEn;

    const icon = document.createElement("span");
    icon.className = "gemini-topic-icon";
    icon.textContent = topic.icon;

    const copy = document.createElement("span");
    copy.className = "gemini-topic-copy";

    const strong = document.createElement("strong");
    strong.textContent = title;

    const small = document.createElement("small");
    small.textContent = desc;

    copy.append(strong, small);
    button.append(icon, copy);

    button.addEventListener("click", async () => {
      if (!consent.checked) {
        status.textContent = language === "hi"
          ? "कृपया पहले AI व्याख्या के लिए सहमति दें।"
          : "Please provide consent before requesting an AI explanation.";
        consent.focus();
        return;
      }

      const requestId = ++activeRequest;

      topicGrid.querySelectorAll("button").forEach(item => {
        item.disabled = true;
        item.classList.toggle("is-active", item === button);
      });

      status.textContent = language === "hi"
        ? `${title} का विश्लेषण तैयार किया जा रहा है...`
        : `Preparing your ${title} explanation...`;

      output.replaceChildren();

      const loading = document.createElement("p");
      loading.className = "gemini-loading";
      loading.textContent = language === "hi"
        ? "AstroLogics के संबंधित डेटा का विश्लेषण हो रहा है। कृपया प्रतीक्षा करें..."
        : "Analysing the relevant AstroLogics data. Please wait...";
      output.appendChild(loading);

      try {
        const response = await fetch("/.netlify/functions/ai-explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consent: true,
            report,
            language: language || "en",
            topic: topic.id
          })
        });

        const payload = await readResponse(response);

        if (requestId !== activeRequest) return;
        if (!payload.explanation) {
          throw new Error(payload.error || "AI returned no explanation.");
        }

        renderGeminiExplanation(payload.explanation, output);
        status.textContent = language === "hi"
          ? `${title} की व्याख्या तैयार है।`
          : `${title} explanation is ready.`;

      } catch (error) {
        if (requestId !== activeRequest) return;

        console.error("Topic AI explanation error:", error);
        output.replaceChildren();

        const errorText = document.createElement("p");
        errorText.textContent = error.message || "Unable to generate this explanation.";
        output.appendChild(errorText);

        status.textContent = language === "hi"
          ? "व्याख्या तैयार नहीं हो सकी। कृपया बाद में प्रयास करें।"
          : "The explanation could not be generated. Please try again.";

      } finally {
        if (requestId === activeRequest) {
          topicGrid.querySelectorAll("button").forEach(item => {
            item.disabled = false;
          });
        }
      }
    });

    topicGrid.appendChild(button);
  });

  section.append(header, consentBox, topicGrid, status, output);
  container.appendChild(section);
}

// ==========================================
// RENDER AI RESPONSE AS STRUCTURED CARDS
// ==========================================


function renderGeminiExplanation(text, container) {
  container.replaceChildren();

  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n");

  let currentCard = null;
  let cardGrid = document.createElement("div");

  cardGrid.className = "gemini-card-grid";

  // Render inline Markdown safely without innerHTML.
  function appendInlineMarkdown(parent, value) {
    const pattern = /(\*\*[^*]+\*\*|(?<!\*)\*[^*]+\*(?!\*)|`[^`]+`)/g;

    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(value)) !== null) {
      if (match.index > lastIndex) {
        parent.appendChild(
          document.createTextNode(
            value.slice(lastIndex, match.index)
          )
        );
      }

      const token = match[0];
      const content = token.slice(1, -1);

      if (token.startsWith("**")) {
        const strong = document.createElement("strong");
        strong.textContent = token.slice(2, -2);
        parent.appendChild(strong);
      } else if (token.startsWith("`")) {
        const code = document.createElement("code");
        code.textContent = content;
        parent.appendChild(code);
      } else {
        const italic = document.createElement("em");
        italic.textContent = content;
        parent.appendChild(italic);
      }

      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < value.length) {
      parent.appendChild(
        document.createTextNode(value.slice(lastIndex))
      );
    }
  }

  // Create an individual insight card.
  function createCard(title) {
    const card = document.createElement("article");
    card.className = "gemini-insight-card";

    const heading = document.createElement("h4");
    heading.textContent = title;

    const body = document.createElement("div");
    body.className = "gemini-card-content";

    card.append(heading, body);
    cardGrid.appendChild(card);

    return body;
  }

  function ensureCard() {
    if (!currentCard) {
      currentCard = createCard("AI Interpretation");
    }

    return currentCard;
  }

  // Keep track of consecutive bullet lists.
  let currentList = null;
  let currentListType = "";

  function resetList() {
    currentList = null;
    currentListType = "";
  }

  lines.forEach(rawLine => {
    const line = rawLine.trim();

    if (!line) {
      resetList();
      return;
    }

    // Markdown headings.
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);

    if (headingMatch) {
      currentCard = createCard(
        headingMatch[1].replace(/\*\*/g, "")
      );

      resetList();
      return;
    }

    // Bold standalone headings.
    const boldHeading = line.match(/^\*\*(.+)\*\*:?$/);

    if (boldHeading) {
      currentCard = createCard(boldHeading[1]);
      resetList();
      return;
    }

    const body = ensureCard();

    // Unordered and numbered lists.
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    const numberMatch = line.match(/^\d+[.)]\s+(.+)$/);

    if (bulletMatch || numberMatch) {
      const listType = numberMatch ? "ol" : "ul";

      if (!currentList || currentListType !== listType) {
        currentList = document.createElement(listType);
        body.appendChild(currentList);
        currentListType = listType;
      }

      const item = document.createElement("li");

      appendInlineMarkdown(
        item,
        bulletMatch ? bulletMatch[1] : numberMatch[1]
      );

      currentList.appendChild(item);
      return;
    }

    resetList();

    // Normal paragraphs.
    const paragraph = document.createElement("p");

    appendInlineMarkdown(paragraph, line);

    body.appendChild(paragraph);
  });

  // Fallback for empty or unsupported output.
  if (!cardGrid.children.length) {
    const body = createCard("AI Interpretation");
    const paragraph = document.createElement("p");

    appendInlineMarkdown(paragraph, String(text || ""));

    body.appendChild(paragraph);
  }

  container.appendChild(cardGrid);
}





  // ==========================================
  // COMMON POST REQUEST
  // ==========================================

  async function postAstrology(action, body) {
    const response = await fetch(
      `/.netlify/functions/astrology?action=${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    return await readResponse(response);
  }

  // ==========================================
  // SAFE API RESPONSE HANDLING
  // ==========================================

  async function readResponse(response) {
    const text = await response.text();

    let payload;

    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(
        "The server returned an invalid response. Check Netlify Dev and the function logs."
      );
    }

    if (!response.ok) {
      const message =
        payload.error?.message ||
        payload.error ||
        payload.message ||
        "Astrology request failed.";

      throw new Error(
        typeof message === "string"
          ? message
          : JSON.stringify(message)
      );
    }

    return payload;
  }

  // ==========================================
  // DISPLAY DAILY RASHIFAL
  // ==========================================

  function displayRashiHoroscope(data, container) {
    container.replaceChildren();

    if (!data) {
      showMessage(container, "No horoscope data received.");
      return;
    }

    const heading = document.createElement("h3");

    heading.textContent =
      `${data.sign_label || data.sign || "Vedic Rashi"} · Daily Reading`;

    const reading = document.createElement("p");

    reading.textContent =
      data.reading || "No reading is available.";

    container.append(heading, reading);

    if (data.scores && typeof data.scores === "object") {
      const scoreContainer = document.createElement("div");

      scoreContainer.className = "vedic-score-grid";

      Object.entries(data.scores).forEach(([category, score]) => {
        const item = document.createElement("div");
        item.className = "vedic-score-item";

        const label = document.createElement("strong");
        label.textContent =
          category.charAt(0).toUpperCase() + category.slice(1);

        const value = document.createElement("span");
        value.textContent = `${score}/100`;

        item.append(label, value);
        scoreContainer.appendChild(item);
      });

      container.appendChild(scoreContainer);
    }

    if (data.date) {
      const dateText = document.createElement("small");
      dateText.textContent = `Reading date: ${data.date}`;
      container.appendChild(dateText);
    }
  }

  // ==========================================
  // DISPLAY BASIC KUNDLI
  // ==========================================

  function displayKundli(data, container, name = "") {
    container.replaceChildren();

    if (!data) {
      showMessage(container, "No Kundli data received.");
      return;
    }

    const heading = document.createElement("h3");

    heading.textContent = name
      ? `${name}'s Vedic Birth Chart`
      : "Your Vedic Birth Chart";

    container.appendChild(heading);

    if (data.lagna) {
      const lagna = data.lagna;

      const section = document.createElement("section");
      section.className = "vedic-lagna-section";

      const title = document.createElement("h4");
      title.textContent = "Lagna Details";

      const details = document.createElement("p");

      details.textContent =
        `Rashi: ${lagna.sign_label || lagna.sign || "N/A"} | ` +
        `Degree: ${lagna.degree ?? "N/A"}° | ` +
        `Nakshatra: ${lagna.nakshatra_label || lagna.nakshatra || "N/A"} | ` +
        `Pada: ${lagna.pada ?? "N/A"}`;

      section.append(title, details);
      container.appendChild(section);
    }

    const planets = Array.isArray(data.planets)
      ? data.planets
      : [];

    if (planets.length) {
      const title = document.createElement("h4");
      title.textContent = "Planetary Positions";

      const table = document.createElement("table");
      table.className = "vedic-planet-table";

      const headers = [
        "Planet",
        "Rashi",
        "Degree",
        "House",
        "Nakshatra"
      ];

      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");

      headers.forEach(label => {
        const th = document.createElement("th");
        th.textContent = label;
        headerRow.appendChild(th);
      });

      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");

      planets.forEach(planet => {
        const row = document.createElement("tr");

        const values = [
          planet.label || planet.id || "N/A",
          planet.sign_label || planet.sign || "N/A",
          planet.degree_in_sign != null
            ? `${Number(planet.degree_in_sign).toFixed(2)}°`
            : "N/A",
          planet.house ?? "N/A",
          planet.nakshatra_label || planet.nakshatra || "N/A"
        ];

        values.forEach(value => {
          const td = document.createElement("td");
          td.textContent = String(value);
          row.appendChild(td);
        });

        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      container.append(title, table);
    }

    if (data.divisional_lagnas) {
      const title = document.createElement("h4");
      title.textContent = "Divisional Charts";

      const list = document.createElement("ul");

      Object.entries(data.divisional_lagnas).forEach(([chart, sign]) => {
        const item = document.createElement("li");
        item.textContent = `${chart}: ${sign}`;
        list.appendChild(item);
      });

      container.append(title, list);
    }

    if (!data.lagna && !planets.length) {
      renderObject(data, container);
    }
  }

  // ==========================================
  // DISPLAY FULL PHALADESH
  // ==========================================

  function displayPhaladesh(report, container, name = "") {
    container.replaceChildren();

    const calculations = report?.calculations || {};
    const calc = key => calculations[key]?.success ? calculations[key].data : null;
    const kundli = calc("birthChart") || report?.kundli || {};
    const divisional = calc("divisionalCharts") || report?.divisional || {};
    const dasha = calc("vimshottariDasha") || report?.dasha || {};
    const currentDasha = calc("currentDasha") || report?.current_dasha || {};
    const yogas = calc("yogas") || report?.yogas || {};
    const wealth = calc("wealthAnalysis") || report?.wealth || {};
    const shadbala = calc("planetaryStrength") || report?.shadbala || {};

    const heading = document.createElement("h3");
    heading.textContent = name ? `${name}'s Vedic Life Report` : "Your Vedic Life Report";
    container.appendChild(heading);

    const intro = document.createElement("p");
    intro.className = "vedic-report-intro";
    intro.textContent = "A traditional Jyotish reading based on the birth-chart and supporting calculations returned for the birth details you entered. Each chapter explains the relevant chart factors in clear language.";
    container.appendChild(intro);

    const profile = extractChartProfile(kundli);
    renderVedicSummary(profile, container);

    const chapters = buildVedicChapters({
      profile, kundli, divisional, dasha, currentDasha, yogas, wealth, shadbala
    });

    const chapterGrid = document.createElement("div");
    chapterGrid.className = "vedic-life-chapters";

    chapters.forEach(chapter => {
      const section = document.createElement("section");
      section.className = "vedic-report-section vedic-life-chapter";

      const heading = document.createElement("h4");
      heading.textContent = chapter.title;

      const paragraph = document.createElement("p");
      paragraph.className = "vedic-chapter-copy";
      paragraph.textContent = chapter.copy;

      section.append(heading, paragraph);

      if (chapter.factors.length) {
        const factorTitle = document.createElement("small");
        factorTitle.className = "vedic-factor-label";
        factorTitle.textContent = "Chart factors considered";
        const factors = document.createElement("div");
        factors.className = "vedic-factor-list";
        chapter.factors.forEach(factor => {
          const chip = document.createElement("span");
          chip.className = "vedic-factor-chip";
          chip.textContent = factor;
          factors.appendChild(chip);
        });
        section.append(factorTitle, factors);
      }
      chapterGrid.appendChild(section);
    });

    container.appendChild(chapterGrid);

    // Preserve the detailed source calculations below the readable interpretation.
    const details = document.createElement("details");
    details.className = "vedic-technical-details";
    const summary = document.createElement("summary");
    summary.textContent = "Explore detailed Kundli calculations";
    details.appendChild(summary);

    if (Object.keys(kundli).length) {
      const section = createReportSection("Birth Chart & Planetary Positions");
      displayKundli(kundli, section);
      details.appendChild(section);
    }
    [
      ["Divisional Charts — D2, D9 & D10", divisional],
      ["Vimshottari Dasha Timeline", dasha],
      ["Current Mahadasha & Antardasha", currentDasha],
      ["Important Yogas", yogas],
      ["Wealth Indicators", wealth],
      ["Planetary Strength — Shadbala", shadbala]
    ].forEach(([title, data]) => {
      if (data && Object.keys(data).length) appendReportSection(details, title, data);
    });

    const failed = Object.entries(calculations)
      .filter(([, item]) => item && !item.success)
      .map(([key]) => formatLabel(key));
    if (failed.length) {
      const note = document.createElement("p");
      note.className = "vedic-calculation-note";
      note.textContent = `Some supporting calculations were unavailable: ${failed.join(", ")}. Interpretations are limited to the chart data that was successfully returned.`;
      details.appendChild(note);
    }

    if (report?.meta) {
      const meta = document.createElement("small");
      meta.className = "vedic-report-meta";
      meta.textContent = `Calculation engine: ${report.meta.engine_version || "Provider"} · Credits used: ${report.meta.credits_charged ?? "Not supplied"}`;
      details.appendChild(meta);
    }

    container.appendChild(details);

    const disclaimer = document.createElement("p");
    disclaimer.className = "astro-note";
    disclaimer.textContent = "Vedic astrology is a traditional interpretive system, not a scientifically established way to predict events. These themes are reflective, not guarantees about career, marriage, money, health or education. Use practical judgement for important life decisions.";
    container.appendChild(disclaimer);
  }

  function extractChartProfile(kundli) {
    const planets = Array.isArray(kundli?.planets) ? kundli.planets : [];
    const getPlanet = name => planets.find(p =>
      String(p.id || p.name || p.label || "").toLowerCase() === name.toLowerCase()
    ) || null;
    const lagna = kundli?.lagna || kundli?.ascendant || {};
    return {
      lagna: lagna.sign_label || lagna.sign || lagna.rashi_label || "",
      lagnaNakshatra: lagna.nakshatra_label || lagna.nakshatra || "",
      moon: getPlanet("moon"),
      sun: getPlanet("sun"),
      mars: getPlanet("mars"),
      mercury: getPlanet("mercury"),
      jupiter: getPlanet("jupiter"),
      venus: getPlanet("venus"),
      saturn: getPlanet("saturn"),
      rahu: getPlanet("rahu"),
      ketu: getPlanet("ketu"),
      planets
    };
  }

  function planetDescription(planet, label) {
    if (!planet) return `${label}'s placement was not available in the returned chart data`;
    const sign = planet.sign_label || planet.sign || planet.rashi_label;
    const house = planet.house ?? planet.house_number;
    const nakshatra = planet.nakshatra_label || planet.nakshatra;
    const parts = [];
    if (sign) parts.push(`${label} in ${sign}`);
    if (house != null) parts.push(`${label} in house ${house}`);
    if (nakshatra) parts.push(`${label} in ${nakshatra} Nakshatra`);
    return parts.join(" · ") || `${label} placement returned`;
  }

  function renderVedicSummary(profile, container) {
    const summary = document.createElement("div");
    summary.className = "vedic-chart-summary";
    const items = [
      ["Lagna", profile.lagna || "Not returned"],
      ["Moon", profile.moon ? (profile.moon.sign_label || profile.moon.sign || "Placement available") : "Not returned"],
      ["Janma Nakshatra", profile.moon?.nakshatra_label || profile.moon?.nakshatra || profile.lagnaNakshatra || "Not returned"]
    ];
    items.forEach(([label, value]) => {
      const card = document.createElement("div");
      card.className = "vedic-summary-item";
      const small = document.createElement("small");
      small.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = value;
      card.append(small, strong);
      summary.appendChild(card);
    });
    container.appendChild(summary);
  }

  function buildVedicChapters(data) {
    const { profile: p, divisional, dasha, currentDasha, yogas, wealth, shadbala } = data;
    const factor = (planet, label) => planetDescription(p[planet], label);
    const houseFactor = (house, label) => `House ${house}: ${label}`;
    const has = value => value && Object.keys(value).length > 0;
    const d9 = has(divisional) ? findChartValue(divisional, ["d9", "navamsa", "navamsha"]) : "";
    const d10 = has(divisional) ? findChartValue(divisional, ["d10", "dashamsha", "dasamsa"]) : "";
    const d2 = has(divisional) ? findChartValue(divisional, ["d2", "hora"]) : "";
    const dashaText = has(currentDasha) ? summarizeObject(currentDasha) : (has(dasha) ? summarizeObject(dasha) : "");

    const make = (title, copy, factors) => ({ title, copy, factors: factors.filter(Boolean) });

    return [
      make("01 · Overall life direction",
        `In Jyotish, the Lagna is used as the starting point for understanding temperament, life approach and the structure of the houses. ${p.lagna ? `Your recorded Lagna is ${p.lagna}.` : "The returned data does not identify a Lagna, so an ascendant-based overview cannot be stated here."} The Moon adds the traditional perspective on emotional responses and everyday experience${p.moon ? `; the Moon is recorded in ${p.moon.sign_label || p.moon.sign || "a sign not labelled in the response"}.` : ", but its placement was not available in the response."} Read these factors together rather than treating one placement as a complete description of a person.`,
        [p.lagna ? `Lagna: ${p.lagna}` : "", factor("moon", "Moon"), p.lagnaNakshatra ? `Lagna Nakshatra: ${p.lagnaNakshatra}` : ""]
      ),
      make("02 · Career & profession",
        `Career is traditionally assessed through the 10th house, its lord, the Sun, Saturn and the D10 (Dashamsha) chart. ${p.planets.length ? `The available chart includes ${p.planets.length} planetary entries, which provide the base for a fuller professional assessment.` : "Planetary details were not returned, so a specific career tendency cannot responsibly be inferred."} ${d10 ? `A D10-related result was returned: ${d10}.` : "A readable D10 placement was not identifiable in the returned divisional-chart data."} This section should be interpreted as vocational themes and work-style reflection, not a guarantee of a particular job, promotion or government appointment.`,
        [houseFactor(10, "profession, responsibility and public contribution"), factor("sun", "Sun"), factor("saturn", "Saturn"), d10 ? `D10: ${d10}` : ""]
      ),
      make("03 · Love & relationships",
        `Traditional relationship interpretation considers the 5th house, Venus, Mars and the condition of relevant house lords. Venus is often used to discuss affection, harmony and relationship values, while the 5th house is associated with romance and emotional expression. ${p.venus ? `Your chart records ${p.venus.sign_label || p.venus.sign || "a Venus placement"}.` : "The Venus placement was not returned, so a sign-specific relationship reading is unavailable."} These symbols can prompt reflection on communication, expectations and compatibility; they do not establish whether or when a relationship will occur.`,
        [houseFactor(5, "romance and emotional expression"), factor("venus", "Venus"), factor("mars", "Mars")]
      ),
      make("04 · Marriage & long-term partnership",
        `Marriage is traditionally examined through the 7th house, its lord, Venus, Jupiter and the Navamsa (D9) chart. ${d9 ? `The returned divisional data includes a D9-related result: ${d9}.` : "A clearly labelled D9/Navamsa result was not identifiable in the response, so this report will not invent one."} A complete assessment would compare the 7th-house condition with the D9 and relevant dasha periods. The available information is best used to reflect on partnership values and readiness, not to promise a marriage date, spouse description or outcome.`,
        [houseFactor(7, "marriage and committed partnership"), factor("venus", "Venus"), factor("jupiter", "Jupiter"), d9 ? `D9: ${d9}` : ""]
      ),
      make("05 · Education & learning",
        `Education is commonly explored through the 4th and 5th houses, Mercury and Jupiter, with the 9th house also considered for higher learning, teachers and philosophical study. ${p.mercury ? `Mercury is recorded as ${p.mercury.sign_label || p.mercury.sign || "placed in the chart"}.` : "Mercury's placement was not supplied, so a specific learning-style interpretation cannot be made."} In a fuller reading, house lords and their strengths would be considered together before drawing conclusions about academic direction or learning opportunities.`,
        [houseFactor(4, "foundational education"), houseFactor(5, "intellect and study"), houseFactor(9, "higher learning"), factor("mercury", "Mercury"), factor("jupiter", "Jupiter")]
      ),
      make("06 · Money, savings & wealth",
        `The 2nd house is traditionally associated with savings and accumulated resources, the 11th with gains, and the 5th and 9th may be considered in broader prosperity combinations. ${d2 ? `The divisional response includes a D2/Hora-related result: ${d2}.` : "A clearly labelled D2/Hora result was not identifiable in the returned data."} ${has(wealth) ? `A wealth calculation was returned and is available in the technical section for review.` : "No separate wealth-analysis result was returned."} Astrology cannot replace budgeting, financial planning or professional investment advice.`,
        [houseFactor(2, "savings and accumulated resources"), houseFactor(11, "income and gains"), factor("jupiter", "Jupiter"), factor("venus", "Venus"), d2 ? `D2: ${d2}` : ""]
      ),
      make("07 · Family & home life",
        `The 4th house and Moon are traditionally used when reflecting on home, emotional security, roots and the relationship with one's domestic environment. The 2nd house is also considered for family background and speech. ${p.moon ? `The Moon's recorded placement is ${p.moon.sign_label || p.moon.sign || "available in the chart"}.` : "The Moon's placement was not returned, so this part remains a general explanation of the Jyotish framework."} The full interpretation depends on house lords and aspects, not on one planet alone.`,
        [houseFactor(4, "home, comfort and roots"), houseFactor(2, "family and speech"), factor("moon", "Moon")]
      ),
      make("08 · Current life period & timing",
        `${dashaText ? `The dasha calculation returned the following summary: ${dashaText}.` : "A current Mahadasha/Antardasha summary was not available in a readable form in the returned response."} In Jyotish, Vimshottari Dasha is traditionally used to organise planetary periods; the meaning of a period depends on the planet's natal role, house ownership, placement and supporting factors. Timing should therefore be interpreted in context rather than as a fixed prediction.`,
        [has(currentDasha) ? "Current Dasha calculation returned" : "", has(dasha) ? "Vimshottari Dasha calculation returned" : ""]
      ),
      make("09 · Strengths, challenges & personal growth",
        `Shadbala is a traditional framework for assessing planetary strength, but strength alone does not mean that every result is automatically favourable. The house ruled by a planet, its placement, dignity, associations and dasha context all matter. ${has(shadbala) ? "A Shadbala result was returned; review the technical details to see which planetary strength values the provider supplied." : "A Shadbala result was not returned, so this report avoids ranking planets as strong or weak."} Use the reading as a prompt for thoughtful self-development and practical decision-making.`,
        [has(shadbala) ? "Shadbala calculation returned" : "", has(yogas) ? "Yoga calculation returned" : "", factor("saturn", "Saturn"), factor("jupiter", "Jupiter")]
      )
    ];
  }

  function findChartValue(value, terms, depth = 0) {
    if (!value || depth > 5) return "";
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findChartValue(item, terms, depth + 1);
        if (found) return found;
      }
      return "";
    }
    if (typeof value !== "object") return "";
    for (const [key, item] of Object.entries(value)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (terms.some(term => normalized === term.replace(/[^a-z0-9]/g, ""))) {
        if (typeof item === "string" || typeof item === "number") return `${key}: ${item}`;
        if (item && typeof item === "object") return summarizeObject(item);
      }
    }
    for (const item of Object.values(value)) {
      const found = findChartValue(item, terms, depth + 1);
      if (found) return found;
    }
    return "";
  }

  function summarizeObject(value, depth = 0) {
    if (depth > 2 || value == null) return "";
    if (typeof value !== "object") return String(value);
    if (Array.isArray(value)) return value.slice(0, 4).map(item => summarizeObject(item, depth + 1)).filter(Boolean).join("; ");
    return Object.entries(value).slice(0, 5)
      .map(([key, item]) => `${formatLabel(key)}: ${typeof item === "object" ? summarizeObject(item, depth + 1) : String(item)}`)
      .filter(Boolean).join("; ");
  }

  // ==========================================
  // REPORT SECTION HELPERS
  // ==========================================

  function createReportSection(title) {
    const section = document.createElement("section");
    section.className = "vedic-report-section";

    const heading = document.createElement("h4");
    heading.textContent = title;

    section.appendChild(heading);
    return section;
  }

  function appendReportSection(container, title, data) {
    if (
      data === undefined ||
      data === null
    ) return;

    const section = createReportSection(title);

    renderObject(data, section);

    container.appendChild(section);
  }

  // ==========================================
  // SAFE RECURSIVE DATA RENDERER
  // ==========================================

  function renderObject(value, container, depth = 0) {
    if (depth > 5 || value == null) return;

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      const paragraph = document.createElement("p");
      paragraph.textContent = String(value);
      container.appendChild(paragraph);
      return;
    }

    if (Array.isArray(value)) {
      if (!value.length) {
        const empty = document.createElement("p");
        empty.textContent = "No entries returned.";
        container.appendChild(empty);
        return;
      }

      const list = document.createElement("ul");

      value.forEach(item => {
        const li = document.createElement("li");

        if (item && typeof item === "object") {
          renderObject(item, li, depth + 1);
        } else {
          li.textContent = String(item);
        }

        list.appendChild(li);
      });

      container.appendChild(list);
      return;
    }

    if (typeof value === "object") {
      Object.entries(value).forEach(([key, item]) => {
        if (item === undefined || item === null) return;

        const wrapper = document.createElement("div");
        wrapper.className = "vedic-report-item";

        const label = document.createElement("strong");
        label.textContent = formatLabel(key);

        wrapper.appendChild(label);

        if (typeof item === "object") {
          renderObject(item, wrapper, depth + 1);
        } else {
          const text = document.createElement("span");
          text.textContent = `: ${String(item)}`;
          wrapper.appendChild(text);
        }

        container.appendChild(wrapper);
      });
    }
  }

  // ==========================================
  // UTILITIES
  // ==========================================

  function formatLabel(value) {
    return String(value)
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  function showMessage(container, message) {
    if (!container) return;

    container.replaceChildren();

    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    paragraph.setAttribute("role", "status");
    paragraph.setAttribute("aria-live", "polite");

    container.appendChild(paragraph);
  }

  function friendlyApiMessage(error) {
    const message = String(error?.message || "");

    if (/rate.limit|rate_limited|too many requests|429/i.test(message)) {
      return "The astrology service is receiving too many requests right now. Please wait about 30–60 seconds, then try once. Avoid repeatedly clicking Generate.";
    }

    if (/quota.exhausted|quota_exhausted/i.test(message)) {
      return "The API monthly credit quota has been reached. Please check your AstroLogics dashboard or try again when the quota resets.";
    }

    if (/place_ambiguous|ambiguous/i.test(message)) {
      return "The birthplace is ambiguous. Please enter a more specific city, district or state.";
    }

    return message || "Unable to complete this astrology request. Please try again later.";
  }

  function setButtonState(button, disabled, text) {
    if (!button) return;

    button.disabled = disabled;
    button.textContent = text;
  }
});
