/* BancoWeston English portal — the credit arithmetic.
 *
 * This file owns every derived number in the demo. Both surfaces call it and
 * neither holds a figure of its own. That is the whole point: one copy of the
 * rate, one copy of the loan-to-value, and one payment formula, here.
 *
 * The demo prices a single standard-terms mortgage — no state guarantee, no
 * dual guaranteed/standard comparison — so every figure below is the one
 * number a page shows, not a pair to choose between.
 *
 * Chilean mortgages are written in UF, the inflation-indexed unit of account,
 * and paid in pesos. So the property, the loan and the payment are UF figures;
 * income, which is earned in pesos, is a peso figure; and UF_VALUE below is
 * the one place the two units meet.
 *
 * DOM-free and dependency-free. Formatters take their locale from
 * FalabellaCopy.NUMBER_LOCALE when the copy layer is loaded and fall back to
 * en-US when it is not, so this module is testable on its own.
 */
"use strict";

(function () {
  /* ============================================================= constants */

  /* A fixed demo UF, not a live one: what is being shown is "what does this
     come to in pesos", not a real-time feed. Banco Central de Chile. */
  var UF_VALUE = 40844.79;
  var UF_DATE = "2026-08-05";

  var PROPERTY_UF = 3500;
  var DOWN_PCT = 0.1;
  var TERM_YEARS = 30;

  var RATE = 0.04;
  var LTV = 0.9;

  /* Life and fire cover, added to principal and interest to make the payment
     the borrower actually pays. A flat monthly amount, in UF like the rest of
     the loan. */
  var INSURANCE_UF = 0.62;

  /* Earned and verified in pesos, which is why this one is not a UF figure. */
  var INCOME_CLP = 2400000;
  var DTI_CAP = 0.3;
  var STRESS_BP = 200;

  /* The mortgage officer's delegated approval authority. */
  var OFFICER_AUTHORITY_UF = 4000;

  var DEFAULT_NUMBER_LOCALE = "en-US";

  /* ============================================================== helpers */

  function fallback(value, whenMissing) {
    return value === undefined || value === null ? whenMissing : value;
  }

  /* Read at call time, not at load time: the copy layer may load after this
     one, and a locale switch must be picked up without a reload. */
  function numberLocale(locale) {
    var copy = globalThis.FalabellaCopy;
    if (!copy) return DEFAULT_NUMBER_LOCALE;
    var key = locale || (copy.locale ? copy.locale() : copy.DEFAULT_LOCALE);
    var table = copy.NUMBER_LOCALE || {};
    return table[key] || table[copy.DEFAULT_LOCALE] || DEFAULT_NUMBER_LOCALE;
  }

  /* ========================================================== arithmetic */

  /* The loan amount at a given loan-to-value. */
  function loanFor(propertyUF, ltv) {
    return fallback(propertyUF, PROPERTY_UF) * fallback(ltv, LTV);
  }

  function downPaymentUF(propertyUF, downPct) {
    return fallback(propertyUF, PROPERTY_UF) * fallback(downPct, DOWN_PCT);
  }

  /* Level payment on a UF-denominated annuity, with monthly-equivalent
     compounding: i = (1+annual)^(1/12) - 1, not annual/12. Principal and
     interest only — see monthlyPaymentUF. */
  function payment(principalUF, annualRate, years) {
    var principal = fallback(principalUF, loanFor());
    var rate = fallback(annualRate, RATE);
    var term = fallback(years, TERM_YEARS);
    var i = Math.pow(1 + rate, 1 / 12) - 1;
    var n = term * 12;
    return (principal * i) / (1 - Math.pow(1 + i, -n));
  }

  /* What the borrower is quoted: principal, interest, and the cover. This is
     the EMP — the Estimated Monthly Payment / Pago Mensual Estimado. */
  function monthlyPaymentUF(principalUF, annualRate, years, insuranceUF) {
    return (
      payment(principalUF, annualRate, years) + fallback(insuranceUF, INSURANCE_UF)
    );
  }

  /* The one crossing between the two units: UF in, pesos out. */
  function toCLP(uf, ufValue) {
    return fallback(uf, 0) * fallback(ufValue, UF_VALUE);
  }

  /* Payment to income, with the cap stated rather than applied. Both sides are
     in pesos, because pesos is what the income is earned in. */
  function dti(paymentCLP, incomeCLP, cap) {
    var pay = fallback(paymentCLP, toCLP(monthlyPaymentUF()));
    var income = fallback(incomeCLP, INCOME_CLP);
    var limit = fallback(cap, DTI_CAP);
    var ratio = income > 0 ? pay / income : 0;
    return {
      paymentCLP: pay,
      incomeCLP: income,
      ratio: ratio,
      cap: limit,
      overCap: ratio > limit,
      headroomCLP: income * limit - pay
    };
  }

  /* The same case re-priced STRESS_BP higher. The principal does not move: a
     rate shock changes what the loan costs, not what it buys. */
  function stressedDti(input) {
    var options = input || {};
    var stressBp = fallback(options.stressBp, STRESS_BP);
    var baseRate = fallback(options.annualRate, RATE);
    var stressedRate = baseRate + stressBp / 10000;
    var paymentUF = monthlyPaymentUF(
      fallback(options.principalUF, loanFor(options.propertyUF, options.ltv)),
      stressedRate,
      options.years,
      options.insuranceUF
    );
    var paymentCLP = toCLP(paymentUF, options.ufValue);
    var result = dti(paymentCLP, options.incomeCLP, options.cap);
    result.stressBp = stressBp;
    result.baseRate = baseRate;
    result.stressedRate = stressedRate;
    result.paymentUF = paymentUF;
    return result;
  }

  /* Every derived figure of the interactive case, in one object, so a page
     renders from it instead of recomputing. */
  function caseFigures(input) {
    var options = input || {};
    var propertyUF = fallback(options.propertyUF, PROPERTY_UF);
    var ltv = fallback(options.ltv, LTV);
    var annualRate = fallback(options.annualRate, RATE);
    var years = fallback(options.years, TERM_YEARS);
    var incomeCLP = fallback(options.incomeCLP, INCOME_CLP);
    var loanUF = loanFor(propertyUF, ltv);
    var paymentUF = monthlyPaymentUF(loanUF, annualRate, years, options.insuranceUF);
    var paymentCLP = toCLP(paymentUF, options.ufValue);

    return {
      propertyUF: propertyUF,
      loanUF: loanUF,
      ltv: ltv,
      annualRate: annualRate,
      termYears: years,
      downPaymentUF: downPaymentUF(propertyUF, options.downPct),
      insuranceUF: fallback(options.insuranceUF, INSURANCE_UF),
      paymentUF: paymentUF,
      paymentCLP: paymentCLP,
      incomeCLP: incomeCLP,
      dti: dti(paymentCLP, incomeCLP, options.cap),
      stressedDti: stressedDti(options),
      ufValue: fallback(options.ufValue, UF_VALUE),
      ufDate: UF_DATE
    };
  }

  /* ============================================================ formatters */

  /* Whole UF by default; the payment asks for two places, because one UF is
     worth enough that the fraction of it is a real amount of money. */
  function formatUF(value, decimals, locale) {
    var places = fallback(decimals, 0);
    return (
      "UF " +
      Number(fallback(value, 0)).toLocaleString(numberLocale(locale), {
        minimumFractionDigits: places,
        maximumFractionDigits: places
      })
    );
  }

  /* Pesos are always whole: Chile does not price in cents. */
  function formatCLP(value, locale) {
    return (
      "$" + Math.round(fallback(value, 0)).toLocaleString(numberLocale(locale))
    );
  }

  /* Takes a percentage, not a ratio: formatPct(24.676) is "24.7%". */
  function formatPct(value, decimals, locale) {
    var places = fallback(decimals, 1);
    return (
      Number(fallback(value, 0)).toLocaleString(numberLocale(locale), {
        minimumFractionDigits: places,
        maximumFractionDigits: places
      }) + "%"
    );
  }

  /* An ISO date in, an English date out. Parsed and rendered in UTC so the
     demo reads the same in every time zone. Anything unparseable is returned
     untouched rather than shown as "Invalid Date". */
  function formatDate(isoDate, locale) {
    if (!isoDate) return "";
    var parsed = new Date(isoDate);
    if (isNaN(parsed.getTime())) return String(isoDate);
    return new Intl.DateTimeFormat(numberLocale(locale), {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    }).format(parsed);
  }

  /* =================================================================== api */

  globalThis.FalabellaCredit = {
    UF_VALUE: UF_VALUE,
    UF_DATE: UF_DATE,
    PROPERTY_UF: PROPERTY_UF,
    DOWN_PCT: DOWN_PCT,
    TERM_YEARS: TERM_YEARS,
    RATE: RATE,
    LTV: LTV,
    INSURANCE_UF: INSURANCE_UF,
    INCOME_CLP: INCOME_CLP,
    DTI_CAP: DTI_CAP,
    STRESS_BP: STRESS_BP,
    OFFICER_AUTHORITY_UF: OFFICER_AUTHORITY_UF,

    payment: payment,
    monthlyPaymentUF: monthlyPaymentUF,
    toCLP: toCLP,
    loanFor: loanFor,
    downPaymentUF: downPaymentUF,
    dti: dti,
    stressedDti: stressedDti,
    caseFigures: caseFigures,

    numberLocale: numberLocale,
    formatUF: formatUF,
    formatCLP: formatCLP,
    formatPct: formatPct,
    formatDate: formatDate
  };
})();
