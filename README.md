# paras-Baba
# Paras Baba Vedic Astrology Dashboard Update

Replace these four files in your existing project:

1. `vedic_astrology.html` -> project root
2. `vedic_astro.js` -> project root
3. `astro_styles.css` -> project root
4. `ai-explain.js` -> `netlify/functions/ai-explain.js`

Keep the following unchanged:
- `astrology_common.js`
- `netlify/functions/astrology.js`
- `index.js`
- `styles.css`
- `assets/`
- `.env` and Netlify configuration

## What changed
- Added a dedicated report dashboard with two distinct sections.
- Section 1 shows AstroLogics technical data: chart summary, planetary positions, divisional charts, dashas, yogas, wealth indicators and Shadbala when returned.
- Section 2 presents the topic-based Kundali interpretation in a warmer Pandit-style voice.
- Added an Ask Your Astrologer question field with suggested questions.
- Custom questions are sent to the existing Groq function only after consent.
- Retained AstroLogics as the sole source of chart calculations and retained English/Hindi support.
- Added responsive plum-and-gold styling and mobile navigation to the report and Ask Pandit area.

## Test locally
1. Back up the four original files.
2. Copy the replacement files to the paths above.
3. Run `netlify dev`.
4. Generate a Kundali, then click `Generate Full Phaladesh`.
5. Check Section 1, request a topic interpretation in Section 2, and test a custom question after checking the consent box.

Do not share your `.env` file or API keys.
