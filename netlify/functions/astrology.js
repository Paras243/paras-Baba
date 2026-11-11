const BASE_URL = "https://api.astrologics.in/v1";

const ALLOWED_SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"
];

const ALLOWED_LANGUAGES = ["en", "hi"];
const ALLOWED_PERIODS = ["daily", "weekly", "monthly", "yearly"];
const ALLOWED_HOUSES = ["placidus", "equal", "whole_sign", "porphyry"];

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

exports.handler = async (event) => {
  const key = process.env.ASTROLOGICS_API_KEY;

  if (!key) {
    return respond(500, {
      error: "API key is not configured in Netlify."
    });
  }

  const action = event.queryStringParameters?.action;

  try {
    // --------------------------------
    // HOROSCOPE
    // --------------------------------

    if (action === "horoscope") {
      if (event.httpMethod !== "GET") {
        return respond(405, { error: "GET method required." });
      }

      const {
        sign,
        period = "daily",
        lang = "en"
      } = event.queryStringParameters || {};

      if (!ALLOWED_SIGNS.includes(sign)) {
        return respond(400, { error: "Invalid zodiac sign." });
      }

      if (!ALLOWED_PERIODS.includes(period)) {
        return respond(400, { error: "Invalid horoscope period." });
      }

      if (!ALLOWED_LANGUAGES.includes(lang)) {
        return respond(400, { error: "Invalid language." });
      }

      return proxyRequest(
        key,
        "GET",
        `/horoscope/${sign}?${new URLSearchParams({ period, lang })}`
      );
    }

    // --------------------------------
    // POST REQUESTS
    // --------------------------------

    if (event.httpMethod !== "POST") {
      return respond(405, { error: "POST method required." });
    }

    let body;

    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return respond(400, {
        error: "Invalid JSON request body."
      });
    }

    // --------------------------------
    // FIX: NORMALIZE BIRTHPLACE
    // --------------------------------

    if (body.birth && typeof body.birth === "object") {
      if (typeof body.birth.place === "string") {
        body.birth.place = {
          query: body.birth.place.trim()
        };
      }
    }

    // --------------------------------
    // VALIDATION
    // --------------------------------

    const validation = validateBirth(
      body.birth,
      action === "western-life"
    );

    if (validation) {
      return respond(400, { error: validation });
    }

    const lang = body.options?.lang || "en";

    if (!ALLOWED_LANGUAGES.includes(lang)) {
      return respond(400, { error: "Invalid language." });
    }

    if (
      ["western", "western-life"].includes(action) &&
      body.house_system &&
      !ALLOWED_HOUSES.includes(body.house_system)
    ) {
      return respond(400, {
        error: "Invalid Western house system."
      });
    }

    // --------------------------------
    // API ACTION ROUTING
    // --------------------------------

    if (action === "kundli") {
      return proxyRequest(key, "POST", "/kundli", body);
    }

    if (action === "western") {
      return proxyRequest(key, "POST", "/western/chart", body);
    }

    if (action === "phaladesh") {
      return createPhaladesh(key, body, lang);
    }

    if (action === "western-life") {
      return createWesternLifeReading(key, body, lang);
    }

    return respond(400, { error: "Invalid API action." });

  } catch (error) {
    console.error("Astrology function error:", error);

    if (
      error.name === "TimeoutError" ||
      error.name === "AbortError"
    ) {
      return respond(504, {
        error: "Astrology request timed out. Please try again."
      });
    }

    return respond(502, {
      error: "Unable to complete the astrology request."
    });
  }
};

// --------------------------------
// VEDIC PHALADESH
// --------------------------------


async function createPhaladesh(key, body, lang) {
  const requestBody = {
    birth: body.birth,

    include: [
      "kundli",
      "divisional:D2,D9,D10",
      "dasha:2",
      "current_dasha",
      "yogas",
      "wealth",
      "shadbala"
    ],

    options: {
      lang,
      ayanamsa: "lahiri",
      house_system: "whole_sign",
      tone: "descriptive"
    }
  };

  const result = await apiPost(
    key,
    "/kundli/bundle",
    requestBody
  );

  if (!result.ok) {
    const error = result.data?.error || result.data;

    const failed = {
      success: false,
      status: result.status,
      error
    };

    return respond(200, {
      success: true,
      system: "vedic",
      reportType: "phaladesh",
      language: lang,
      calculations: {
        birthChart: failed,
        divisionalCharts: failed,
        vimshottariDasha: failed,
        currentDasha: failed,
        yogas: failed,
        wealthAnalysis: failed,
        planetaryStrength: failed
      }
    });
  }

  const reportData = result.data?.data ?? result.data;

  const meta = result.data?.meta;
  const warnings = result.data?.warnings || [];

  const wrapCalculation = (data) => {
    if (data == null) {
      return {
        success: false,
        data: null,
        error: "Calculation data was not returned by AstroLogics."
      };
    }

    return {
      success: true,
      data,
      meta,
      warnings
    };
  };

  const calculations = {
    birthChart: wrapCalculation(reportData.kundli),
    divisionalCharts: wrapCalculation(reportData.divisional),
    vimshottariDasha: wrapCalculation(reportData.dasha),
    currentDasha: wrapCalculation(reportData.current_dasha),
    yogas: wrapCalculation(reportData.yogas),
    wealthAnalysis: wrapCalculation(reportData.wealth),
    planetaryStrength: wrapCalculation(reportData.shadbala)
  };

  return respond(200, {
    success: true,
    system: "vedic",
    reportType: "phaladesh",
    language: lang,
    calculations,
    meta,
    warnings
  });
}


// --------------------------------
// WESTERN LIFE READING
// --------------------------------

async function createWesternLifeReading(key, body, lang) {
  const birth = { ...body.birth };

  if (birth.time_accuracy === "unknown") {
    delete birth.time;
  }

  const houseSystem = body.house_system || "placidus";

  const today = new Date();
  const from = today.toISOString().slice(0, 10);

  const future = new Date(today);
  future.setUTCDate(future.getUTCDate() + 365);

  const to = future.toISOString().slice(0, 10);

  const natalBody = {
    birth,
    house_system: houseSystem,
    options: { lang }
  };

  const calculations = {
    natalChart: () =>
      apiPost(key, "/western/chart", natalBody),

    natalAspects: () =>
      apiPost(key, "/western/aspects", {
        birth,
        house_system: houseSystem
      }),

    planetaryTransits: () =>
      apiPost(key, "/western/transits", {
        birth,
        from,
        to,
        planets: [
          "jupiter",
          "saturn",
          "uranus",
          "neptune",
          "pluto"
        ],
        include_moon: false,
        house_system: houseSystem,
        options: { lang }
      }),

    secondaryProgressions: () =>
      apiPost(key, "/western/progressions", {
        ...natalBody,
        date: from
      })
  };

  const results = await runCalculations(calculations);

  return respond(200, {
    success: true,
    system: "western",
    reportType: "life-reading",
    language: lang,
    transitPeriod: {
      from,
      to
    },
    calculations: results,
    note: "Themes are traditional astrological interpretations, not guaranteed life events."
  });
}

// --------------------------------
// CALCULATION RUNNER
// --------------------------------

async function runCalculations(calculations) {
  const results = {};

  // Sequential execution helps reduce burst traffic
  // and potential provider rate-limit issues.

  for (const [name, calculate] of Object.entries(calculations)) {
    try {
      const result = await calculate();

      if (!result.ok) {
        results[name] = {
          success: false,
          status: result.status,
          error: result.data?.error || result.data
        };
      } else {
        results[name] = {
          success: true,
          data: result.data?.data ?? result.data,
          meta: result.data?.meta,
          warnings: result.data?.warnings || []
        };
      }

    } catch (error) {
      console.error(`Calculation failed: ${name}`, error);

      results[name] = {
        success: false,
        error: "This calculation could not be completed."
      };
    }
  }

  return results;
}

// --------------------------------
// API REQUEST HELPERS
// --------------------------------

async function apiPost(key, path, body) {
  return apiRequest(key, "POST", path, body);
}

async function apiRequest(key, method, path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(25000)
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      error: "The provider returned a non-JSON response."
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

async function proxyRequest(key, method, path, body) {
  const result = await apiRequest(key, method, path, body);

  return respond(result.status, result.data);
}

// --------------------------------
// BIRTH VALIDATION
// --------------------------------

function validateBirth(birth, allowUnknownTime = false) {
  if (!birth || !birth.date || !birth.place) {
    return "Birth date and birthplace are required.";
  }

  // Strict YYYY-MM-DD validation
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth.date)) {
    return "Invalid birth date. Use YYYY-MM-DD.";
  }

  const [year, month, day] = birth.date.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return "Invalid birth date. Please enter a real calendar date.";
  }

  // Birth-time validation
  const accuracy = birth.time_accuracy || "exact";

  if (!["exact", "approximate", "unknown"].includes(accuracy)) {
    return "Invalid birth-time accuracy.";
  }

  if (
    accuracy !== "unknown" &&
    (
      !birth.time ||
      !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(birth.time)
    )
  ) {
    return "Invalid birth time. Use HH:MM, or select unknown birth time.";
  }

  if (accuracy === "unknown" && !allowUnknownTime) {
    return "Birth time is required for this calculation.";
  }

  // Birthplace validation
  const place = birth.place;

  const validPlace =
    place &&
    typeof place === "object" &&
    (
      (
        typeof place.query === "string" &&
        place.query.trim().length >= 2 &&
        place.query.trim().length <= 120
      ) ||
      (
        typeof place.place_id === "string" &&
        place.place_id.trim().length > 0
      ) ||
      (
        Number.isFinite(place.latitude) &&
        Number.isFinite(place.longitude) &&
        place.latitude >= -90 &&
        place.latitude <= 90 &&
        place.longitude >= -180 &&
        place.longitude <= 180
      )
    );

  if (!validPlace) {
    return "Invalid birthplace. Use a place query, place ID or coordinates.";
  }

  return null;
}

// --------------------------------
// RESPONSE HELPER
// --------------------------------

function respond(statusCode, data) {
  return {
    statusCode,
    headers: HEADERS,
    body: JSON.stringify(data)
  };
}