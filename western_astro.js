document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("westernSignGrid");
  const result = document.getElementById("westernHoroscopeResult");
  const period = document.getElementById("westernPeriod");
  const form = document.getElementById("westernBirthForm");
  const reportResult = document.getElementById("westernChartResult");
  const timeInput = document.getElementById("westernBirthTime");
  const accuracyInput = document.getElementById("westernTimeAccuracy");

  let selectedSign = "";
  let horoscopeId = 0;
  let horoscopeController;
  let reportBusy = false;
  let lastReportAt = 0;

  function syncTimeField() {
    if (!timeInput || !accuracyInput) return;
    const unknown = accuracyInput.value === "unknown";
    timeInput.required = !unknown;
    timeInput.disabled = unknown;
    if (unknown) timeInput.value = "";
  }
  accuracyInput?.addEventListener("change", syncTimeField);
  syncTimeField();

  grid?.addEventListener("click", event => {
    const button = event.target.closest("[data-sign]");
    if (!button) return;
    selectedSign = button.dataset.sign.toLowerCase();
    grid.querySelectorAll(".astro-sign").forEach(item => item.classList.remove("is-selected"));
    button.classList.add("is-selected");
    loadSignReading();
  });
  period?.addEventListener("change", () => { if (selectedSign) loadSignReading(); });

  async function loadSignReading() {
    const id = ++horoscopeId;
    horoscopeController?.abort();
    horoscopeController = new AbortController();
    const selectedPeriod = period?.value || "daily";
    show(result, `Loading ${selectedPeriod} reading for ${cap(selectedSign)}...`);
    try {
      const params = new URLSearchParams({ action: "horoscope", sign: selectedSign, period: selectedPeriod, lang: "en" });
      const payload = await request(`/.netlify/functions/astrology?${params}`, { signal: horoscopeController.signal });
      if (id !== horoscopeId) return;
      renderSignReading(payload.data ?? payload, result);
    } catch (error) {
      if (error.name === "AbortError" || id !== horoscopeId) return;
      show(result, friendly(error));
    }
  }

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (reportBusy) return;

    const fd = new FormData(form);
    const birth = {
      name: String(fd.get("name") || "").trim(),
      date: String(fd.get("date") || ""),
      time: String(fd.get("time") || ""),
      place: String(fd.get("place") || "").trim(),
      time_accuracy: String(fd.get("time_accuracy") || "exact")
    };
    const houseSystem = String(fd.get("house_system") || "placidus");
    const lang = String(fd.get("language") || "en");

    if (!birth.date || !birth.place || (birth.time_accuracy !== "unknown" && !birth.time)) {
      show(reportResult, "Enter your date and birthplace. Add a birth time unless you select “I don't know my birth time”.");
      return;
    }

    const wait = 15000 - (Date.now() - lastReportAt);
    if (wait > 0) {
      show(reportResult, `Please wait ${Math.ceil(wait / 1000)} seconds before requesting another report.`);
      return;
    }

    reportBusy = true;
    lastReportAt = Date.now();
    const button = form.querySelector('[type="submit"]');
    const label = button?.textContent || "Generate my Western life report";
    if (button) { button.disabled = true; button.textContent = "Calculating your life report..."; }
    show(reportResult, "Calculating your tropical birth chart, natal aspects, planetary transits and progressions. Please wait...");

    try {
      const payload = await request("/.netlify/functions/astrology?action=western-life", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birth,
          house_system: houseSystem,
          options: { lang }
        })
      });
      renderLifeReport(payload.data ?? payload, reportResult, birth.name);
      reportResult.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      show(reportResult, friendly(error));
    } finally {
      reportBusy = false;
      if (button) { button.disabled = false; button.textContent = label; }
    }
  });

  async function request(url, options = {}) {
    const response = await fetch(url, { headers: { Accept: "application/json" }, ...options });
    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); }
    catch { throw new Error("The server returned an invalid response. Check your Netlify function logs."); }
    if (!response.ok) {
      const e = payload.error;
      throw new Error(typeof e === "string" ? e : e?.message || payload.message || `Request failed (${response.status}).`);
    }
    return payload;
  }

  function renderSignReading(data, target) {
    target.replaceChildren();
    if (!data) return show(target, "No sign reading was returned.");
    target.append(el("h3", `${data.sign_label || cap(data.sign || "Zodiac")} · ${cap(data.period || "daily")} Reading`));
    target.append(el("p", data.reading || "No reading text was returned."));
    if (data.scores) {
      const scores = el("div");
      scores.className = "western-scores-grid";
      [["love","Love"],["career","Career"],["health","Health"],["money","Money"]].forEach(([key,label]) => {
        if (data.scores[key] == null) return;
        const card = el("div"); card.className = "western-score-item";
        card.append(el("strong", label), el("span", `${data.scores[key]}/100`));
        if (data.score_notes?.[key]) card.append(el("small", data.score_notes[key]));
        scores.append(card);
      });
      target.append(scores);
    }
    if (data.date) target.append(el("small", `Reading date: ${data.date}`));
  }

  function renderLifeReport(report, target, name) {
    target.replaceChildren();
    if (!report || typeof report !== "object") return show(target, "No life-report data was returned.");
    target.append(
      el("h3", name ? `${name}'s Western Life Report` : "Your Western Life Report"),
      el("p", "This report organises your tropical chart calculations into traditional astrology themes. It is for reflection, not a guaranteed prediction of life events.")
    );

    const calc = report.calculations || {};
    const chartEntry = calc.natalChart;
    const aspectsEntry = calc.natalAspects;
    const transitEntry = calc.planetaryTransits;
    const progressEntry = calc.secondaryProgressions;

    const chart = chartEntry?.data;
    const aspects = aspectsEntry?.data;
    const transits = transitEntry?.data;
    const progressions = progressEntry?.data;

    if (chartEntry?.success && chart) {
      renderBigThree(chart, target);
      renderLifeAreas(chart, target);
      renderPlanets(chart, target);
      renderBalance(chart.balance, target);
    } else renderFailure(target, "Natal chart", chartEntry);

    if (aspectsEntry?.success && aspects) renderAspects(aspects, target);
    else renderFailure(target, "Natal aspects", aspectsEntry);

    if (transitEntry?.success && transits) renderTransits(transits, target);
    else renderFailure(target, "Planetary transits", transitEntry);

    if (progressEntry?.success && progressions) renderProgressions(progressions, target);
    else renderFailure(target, "Secondary progressions", progressEntry);

    if (Array.isArray(report.warnings) && report.warnings.length) {
      const section = sectionBox("Calculation notes");
      const ul = el("ul");
      report.warnings.forEach(w => ul.append(el("li", typeof w === "string" ? w : JSON.stringify(w))));
      section.append(ul); target.append(section);
    }
    const note = el("p", "Astrology is a traditional interpretive practice, not a scientifically established method for predicting career, marriage, health, wealth or life outcomes. Use this report for reflection, not as a substitute for professional advice.");
    note.className = "astro-note";
    target.append(note);
  }

  function renderBigThree(chart, target) {
    const planets = chart.planets || [];
    const sun = planets.find(p => p.id === "sun");
    const moon = planets.find(p => p.id === "moon");
    const section = sectionBox("Your Big Three & public direction");
    const grid = el("div"); grid.className = "western-big-three-grid";
    [
      ["☉","Sun",sun?.sign_name || "Unavailable","Identity and conscious expression"],
      ["☾","Moon",moon?.sign_name || "Unavailable","Emotional needs and responses"],
      ["↗","Rising",chart.angles?.ascendant?.sign_name || "Unavailable","Ascendant and chart orientation"],
      ["✦","Midheaven",chart.angles?.midheaven?.sign_name || "Unavailable","Public direction and vocation"]
    ].forEach(([symbol,label,value,note]) => {
      const card = el("div"); card.className = "western-placement-card";
      card.append(el("span",symbol),el("small",label),el("strong",value),el("p",note)); grid.append(card);
    });
    section.append(grid);
    section.append(el("small", `Tropical zodiac · House system: ${chart.house_system || "not available"}`));
    target.append(section);
  }

  function renderLifeAreas(chart, target) {
    const planets = Array.isArray(chart.planets) ? chart.planets : [];
    const houses = Array.isArray(chart.houses) ? chart.houses : [];
    const angles = chart.angles || {};
    const getPlanet = id => planets.find(p => p.id === id);
    const getHouse = n => houses.find(h => Number(h.house) === n);
    const getCusp = n => getHouse(n)?.formatted || null;
    const getSign = p => String(p?.sign || "").toLowerCase();
    const getHouseNumber = p => Number.isInteger(Number(p?.house)) ? Number(p.house) : null;

    const signVoice = {
      aries: "direct, pioneering and action-oriented",
      taurus: "steady, patient and security-conscious",
      gemini: "curious, communicative and adaptable",
      cancer: "protective, intuitive and emotionally perceptive",
      leo: "expressive, creative and recognition-oriented",
      virgo: "observant, analytical and improvement-focused",
      libra: "diplomatic, relationship-aware and harmony-seeking",
      scorpio: "intense, private and deeply committed",
      sagittarius: "exploratory, optimistic and meaning-seeking",
      capricorn: "disciplined, pragmatic and achievement-focused",
      aquarius: "independent, inventive and community-minded",
      pisces: "imaginative, compassionate and sensitive"
    };
    const houseThemes = {
      1: "personal initiative, self-presentation and the way you approach new situations",
      2: "personal resources, values, earning priorities and the way you build security",
      3: "communication, foundational learning, siblings and everyday curiosity",
      4: "home, family roots, private life and the foundations that help you feel secure",
      5: "creativity, romance, hobbies, play and self-expression",
      6: "daily routines, practical skills, service and the habits that support wellbeing",
      7: "one-to-one relationships, commitment, cooperation and partnership",
      8: "shared resources, trust, intimacy and periods of psychological change",
      9: "higher education, philosophy, travel, beliefs and broadening your perspective",
      10: "career direction, public contribution, responsibility and long-term ambitions",
      11: "friendships, networks, communities and hopes for the future",
      12: "solitude, reflection, closure, imagination and matters handled behind the scenes"
    };
    const planetThemes = {
      sun: "identity, purpose and the kind of contribution that feels meaningful",
      moon: "emotional needs, instincts and the environments in which you feel at ease",
      mercury: "thinking, communication, analysis and learning style",
      venus: "affection, attraction, values and the way you build harmony",
      mars: "initiative, courage, motivation and how you pursue what you want",
      jupiter: "growth, confidence, opportunity and the search for meaning",
      saturn: "responsibility, boundaries, patience and skills developed over time",
      uranus: "independence, originality and the need to make room for change",
      neptune: "imagination, ideals, sensitivity and the importance of clear boundaries",
      pluto: "deep change, focus, power dynamics and personal renewal"
    };

    const positionText = p => {
      if (!p) return "This placement was not returned by the chart calculation.";
      const sign = getSign(p);
      const houseNo = getHouseNumber(p);
      const signText = signVoice[sign] ? `in ${cap(sign)}, a sign traditionally described as ${signVoice[sign]}` : `in ${p.sign_name || cap(sign || "an unavailable sign")}`;
      const houseText = houseNo ? `, placed in the ${ordinal(houseNo)} house associated with ${houseThemes[houseNo]}` : "";
      return `${cap(p.name || p.id)} is ${signText}${houseText}.`;
    };

    const cuspText = n => getCusp(n)
      ? `The ${ordinal(n)}-house cusp is ${getCusp(n)}.`
      : `The ${ordinal(n)}-house cusp is unavailable because the birth time was not supplied or the chart provider did not return house data.`;

    const planetInHouseText = (id, preferredHouse) => {
      const p = getPlanet(id);
      if (!p) return "";
      const n = getHouseNumber(p);
      if (!n) return positionText(p);
      return `${positionText(p)} This connects ${planetThemes[id] || "this planet's symbolism"} with ${houseThemes[n]}.`;
    };

    const makeNarrative = (title, kicker, paragraph, evidence, icon) => ({
      title, kicker, paragraph, evidence, icon
    });

    const sun = getPlanet("sun");
    const moon = getPlanet("moon");
    const mercury = getPlanet("mercury");
    const venus = getPlanet("venus");
    const mars = getPlanet("mars");
    const jupiter = getPlanet("jupiter");
    const saturn = getPlanet("saturn");
    const asc = angles.ascendant;
    const mc = angles.midheaven;

    const careerEvidence = [
      mc?.formatted ? `Midheaven: ${mc.formatted}` : "Midheaven: unavailable",
      getCusp(10) ? `10th house: ${getCusp(10)}` : "10th house: unavailable",
      saturn ? `Saturn: ${saturn.formatted || saturn.sign_name}` : null,
      sun ? `Sun: ${sun.formatted || sun.sign_name}` : null
    ].filter(Boolean);
    const careerTone = mc?.sign ? signVoice[String(mc.sign).toLowerCase()] : null;
    const careerParagraph = mc
      ? `In traditional Western astrology, the Midheaven and 10th house are read as symbols of vocation, public contribution and long-range ambition. Your Midheaven is in ${mc.sign_name || cap(mc.sign)}${careerTone ? `, a sign associated with being ${careerTone}` : ""}. ${planetInHouseText("saturn")} ${planetInHouseText("sun")} Read together, these placements can help you reflect on the kind of work environment, responsibilities and goals that feel motivating. They do not identify one guaranteed profession or promise a particular job, promotion or success date.`
      : `Career interpretation normally gives special attention to the Midheaven, the 10th house and their rulers. Those time-sensitive points are not available in this chart, so this section stays broad rather than guessing your professional direction. ${positionText(sun)} ${positionText(saturn)} Use the available planetary placements as reflection prompts, not as a prediction of a job or promotion.`;

    const loveParagraph = `Love and romance are traditionally explored through Venus, Mars and the 5th house. ${positionText(venus)} ${positionText(mars)} These placements describe symbolic approaches to affection, attraction, initiative and expressing interest. The most useful question is how these patterns might show up in your choices: what makes you feel appreciated, how directly you communicate your needs, and whether excitement and emotional steadiness are both present. Astrology cannot determine whether a particular person loves you or guarantee when a relationship will begin.`;

    const marriageParagraph = `Long-term partnership is traditionally considered through the 7th house, its ruler, Venus and the Descendant. ${angles.descendant?.formatted ? `Your Descendant is ${angles.descendant.formatted}.` : "The Descendant is not available in this chart."} ${cuspText(7)} ${positionText(venus)} These symbols can be used to reflect on the qualities you value in commitment, how you approach compromise and the balance between independence and togetherness. They cannot reliably establish a marriage date, guarantee marriage or identify a future spouse.`;

    const educationParagraph = `Education and learning are traditionally considered through Mercury and the 3rd and 9th houses. ${positionText(mercury)} ${cuspText(3)} ${cuspText(9)} The 3rd house is associated with foundational learning and communication, while the 9th is associated with higher study, specialist knowledge and broader intellectual horizons. ${positionText(jupiter)} Together, these factors offer a reflective way to think about your learning preferences—such as structured practice, discussion, independent research or exploring a subject in depth. They are not a measure of intelligence or a guarantee of exam results.`;

    const moneyParagraph = `Financial themes are traditionally explored through the 2nd house of personal resources, the 8th house of shared resources and the condition of Venus and Jupiter. ${cuspText(2)} ${cuspText(8)} ${positionText(jupiter)} ${positionText(venus)} This section is best read as a prompt to consider your relationship with security, spending, saving, collaboration and long-term planning. A birth chart cannot forecast a specific salary, investment return, inheritance or financial event, so practical financial decisions should be based on real-world information.`;

    const familyParagraph = `The 4th house and Moon are commonly used in Western astrology to reflect on home, family roots, belonging and private emotional life. ${cuspText(4)} ${positionText(moon)} These symbols can invite reflection on what helps you feel grounded, the kind of home atmosphere you value and how you balance family responsibilities with your own needs. They do not establish facts about relatives or guarantee particular family events.`;

    const lifeParagraph = `Your overall life story in a natal chart is not read from one placement alone. Astrologers usually begin with the Sun, Moon and Ascendant, then consider the chart ruler, planetary patterns and major aspects. ${positionText(sun)} ${positionText(moon)} ${asc?.formatted ? `Your Ascendant is ${asc.formatted}.` : "Your Ascendant is unavailable because an accurate birth time is needed."} These placements offer different lenses on identity, emotional needs and the way you meet new experiences. They are best treated as themes for self-understanding rather than a fixed script for your future.`;

    const growthParagraph = `Personal development can be explored through the Moon, Saturn, Jupiter and the 6th and 9th houses. ${positionText(moon)} ${positionText(saturn)} ${positionText(jupiter)} ${cuspText(6)} ${cuspText(9)} In traditional interpretation, these factors are associated with emotional awareness, responsibility, daily habits, learning and meaning. A practical way to use this section is to choose one habit to strengthen, one skill to develop and one boundary that supports your wellbeing. This is reflective guidance, not a health diagnosis or a substitute for professional support.`;

    const narratives = [
      makeNarrative("Overall life direction", "Your chart's central themes", lifeParagraph, [
        sun ? `Sun · ${sun.formatted || sun.sign_name}` : null,
        moon ? `Moon · ${moon.formatted || moon.sign_name}` : null,
        asc?.formatted ? `Ascendant · ${asc.formatted}` : "Ascendant · unavailable"
      ].filter(Boolean), "compass"),
      makeNarrative("Career & profession", "Vocation · ambition · public life", careerParagraph, careerEvidence, "briefcase-business"),
      makeNarrative("Love & relationships", "Affection · romance · connection", loveParagraph, [
        venus ? `Venus · ${venus.formatted || venus.sign_name}` : null,
        mars ? `Mars · ${mars.formatted || mars.sign_name}` : null,
        getCusp(5) ? `5th house · ${getCusp(5)}` : null
      ].filter(Boolean), "heart"),
      makeNarrative("Marriage & long-term partnership", "Commitment · compatibility themes", marriageParagraph, [
        angles.descendant?.formatted ? `Descendant · ${angles.descendant.formatted}` : null,
        getCusp(7) ? `7th house · ${getCusp(7)}` : null,
        venus ? `Venus · ${venus.formatted || venus.sign_name}` : null
      ].filter(Boolean), "rings"),
      makeNarrative("Education & learning", "Study · knowledge · communication", educationParagraph, [
        mercury ? `Mercury · ${mercury.formatted || mercury.sign_name}` : null,
        getCusp(3) ? `3rd house · ${getCusp(3)}` : null,
        getCusp(9) ? `9th house · ${getCusp(9)}` : null,
        jupiter ? `Jupiter · ${jupiter.formatted || jupiter.sign_name}` : null
      ].filter(Boolean), "graduation-cap"),
      makeNarrative("Money & financial habits", "Resources · security · values", moneyParagraph, [
        getCusp(2) ? `2nd house · ${getCusp(2)}` : null,
        getCusp(8) ? `8th house · ${getCusp(8)}` : null,
        jupiter ? `Jupiter · ${jupiter.formatted || jupiter.sign_name}` : null
      ].filter(Boolean), "wallet"),
      makeNarrative("Family & home life", "Roots · belonging · emotional foundations", familyParagraph, [
        getCusp(4) ? `4th house · ${getCusp(4)}` : null,
        moon ? `Moon · ${moon.formatted || moon.sign_name}` : null
      ].filter(Boolean), "house"),
      makeNarrative("Personal growth & wellbeing", "Habits · resilience · meaning", growthParagraph, [
        moon ? `Moon · ${moon.formatted || moon.sign_name}` : null,
        saturn ? `Saturn · ${saturn.formatted || saturn.sign_name}` : null,
        jupiter ? `Jupiter · ${jupiter.formatted || jupiter.sign_name}` : null
      ].filter(Boolean), "seedling")
    ];

    const section = sectionBox("Your personal life interpretation");
    const intro = el("p", "The following chapters translate your chart placements into everyday language. Each paragraph is tied to the planetary positions and house data returned for this birth chart. Astrology is interpretive: use the reading to reflect, not as a fixed forecast.");
    intro.className = "western-report-intro";
    section.append(intro);

    const grid = el("div");
    grid.className = "western-narrative-grid";
    narratives.forEach(item => {
      const article = el("article");
      article.className = "western-narrative-card";
      const head = el("div");
      head.className = "western-narrative-heading";
      const icon = el("span", "✦");
      icon.className = "western-narrative-icon";
      const titles = el("div");
      titles.append(el("small", item.kicker), el("h5", item.title));
      head.append(icon, titles);
      article.append(head);
      const paragraph = el("p", item.paragraph);
      paragraph.className = "western-narrative-copy";
      article.append(paragraph);
      if (item.evidence.length) {
        const evidence = el("div");
        evidence.className = "western-evidence";
        evidence.append(el("small", "Chart factors used"));
        const chips = el("div");
        chips.className = "western-evidence-chips";
        item.evidence.forEach(value => {
          const chip = el("span", value);
          chips.append(chip);
        });
        evidence.append(chips);
        article.append(evidence);
      }
      grid.append(article);
    });
    section.append(grid);
    target.append(section);
  }

  function ordinal(number) {
    const suffix = number % 100 >= 11 && number % 100 <= 13 ? "th" : ({1:"st",2:"nd",3:"rd"}[number % 10] || "th");
    return `${number}${suffix}`;
  }

  function renderPlanets(chart, target) {
    if (!Array.isArray(chart.planets) || !chart.planets.length) return;
    const section = sectionBox("Planetary placements");
    const wrap = el("div"); wrap.className = "western-table-wrap";
    const table = el("table"); table.className = "western-planet-table";
    const thead = el("thead"), hr = el("tr");
    ["Planet","Sign","Position","House","Motion"].forEach(x => hr.append(el("th",x)));
    thead.append(hr);
    const tbody = el("tbody");
    chart.planets.forEach(p => {
      const tr = el("tr");
      [p.name || p.id,p.sign_name || p.sign,p.formatted || `${p.degree ?? "—"}°`,p.house ?? "—",p.retrograde ? "Retrograde" : "Direct"].forEach(x => tr.append(el("td",String(x ?? "—"))));
      tbody.append(tr);
    });
    table.append(thead,tbody); wrap.append(table); section.append(wrap); target.append(section);
  }

  function renderBalance(balance,target) {
    if (!balance) return;
    const section = sectionBox("Element & modality balance");
    const grid = el("div"); grid.className = "western-balance-grid";
    [["Elements",balance.elements],["Modalities",balance.modalities]].forEach(([title,values]) => {
      if (!values) return;
      const card = el("div"); card.className = "western-balance-card"; card.append(el("h5",title));
      Object.entries(values).forEach(([k,v]) => { const row=el("div"); row.className="western-balance-row"; row.append(el("span",cap(k)),el("strong",String(v))); card.append(row); });
      grid.append(card);
    });
    section.append(grid); target.append(section);
  }

  function renderAspects(data,target) {
    const section = sectionBox("Natal aspects");
    const aspects = Array.isArray(data.aspects) ? data.aspects : (Array.isArray(data) ? data : []);
    if (!aspects.length) section.append(el("p","No aspects were returned."));
    else { const ul=el("ul"); aspects.forEach(a => ul.append(el("li",`${cap(a.a || "Planet")} ${cap(a.aspect || "aspect")} ${cap(a.b || "planet")} · orb ${a.orb ?? "—"}°${a.applying === true ? " · applying" : a.applying === false ? " · separating" : ""}`))); section.append(ul); }
    target.append(section);
  }

  function renderTransits(data,target) {
    const section = sectionBox("Planetary transits — next 12 months");
    const events = Array.isArray(data.events) ? data.events : [];
    section.append(el("p",`${data.from || ""} to ${data.to || ""} · ${data.count ?? events.length} events returned`));
    if (!events.length) section.append(el("p","No transit events were returned for this period."));
    else { const ul=el("ul"); events.slice(0,35).forEach(ev => {
      const when = ev.at ? new Date(ev.at).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"}) : "Date unavailable";
      const description = ev.kind === "aspect" ? `${cap(ev.planet)} ${cap(ev.aspect)} natal ${cap(ev.natal_point || "point")}` : `${cap(ev.planet)} ${ev.kind === "station" ? "station" : "enters"} ${ev.sign_name || ev.sign || ""}`;
      ul.append(el("li",`${when} — ${description}${ev.transit_house ? ` · transit house ${ev.transit_house}` : ""}`));
    }); section.append(ul); }
    target.append(section);
  }

  function renderProgressions(data,target) {
    const section = sectionBox("Secondary progressions");
    section.append(el("p",`Calculated for ${data.date || "current date"} · age ${data.age_years ?? "—"} · ${data.method || "secondary progression"}`));
    const progressed = data.chart;
    if (progressed) {
      const ul=el("ul");
      ["sun","moon"].forEach(id => { const p=progressed.planets?.find(x=>x.id===id); if(p) ul.append(el("li",`Progressed ${cap(id)}: ${p.formatted || p.sign_name}`)); });
      if(progressed.angles?.ascendant) ul.append(el("li",`Progressed Ascendant: ${progressed.angles.ascendant.formatted || progressed.angles.ascendant.sign_name}`));
      section.append(ul);
    }
    target.append(section);
  }

  function renderFailure(target,title,entry) {
    const section = sectionBox(`${title} — unavailable`);
    section.append(el("p","This calculation could not be completed. Other successful sections are still displayed."));
    if (entry?.status === 429) section.append(el("p","The provider rate limit was reached. Wait before trying again."));
    target.append(section);
  }

  function sectionBox(title) { const section=el("section"); section.className="western-life-section"; section.append(el("h4",title)); return section; }
  function el(tag,text) { const node=document.createElement(tag); if(text!==undefined && text!==null) node.textContent=String(text); return node; }
  function show(target,message) { if(!target)return; target.replaceChildren(); const p=el("p",message); p.setAttribute("role","status"); p.setAttribute("aria-live","polite"); target.append(p); }
  function cap(value) { const s=String(value || ""); return s.charAt(0).toUpperCase()+s.slice(1).replace(/_/g," "); }
  function friendly(error) {
    const m=String(error?.message || "");
    if (/429|rate.limit|rate_limited|too many requests/i.test(m)) return "The astrology provider is rate-limiting requests. Wait 30–60 seconds and try once; avoid repeated clicks.";
    if (/place_ambiguous|ambiguous/i.test(m)) return "The birthplace could not be identified uniquely. Add the district, state and country.";
    if (/401|unauthorized/i.test(m)) return "The API key was rejected. Check ASTROLOGICS_API_KEY in Netlify. Never share the secret key in chat.";
    return m || "Unable to complete this request. Please try again later.";
  }
});
