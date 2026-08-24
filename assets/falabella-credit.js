/* BancoBCR English portal — the credit arithmetic.
 *
 * This file owns every derived number in the demo. Both surfaces call it and
 * neither holds a figure of its own. That is the whole point: one copy of the
 * rate, one copy of the loan-to-value, and one payment formula, here.
 *
 * The demo prices a single standard-terms mortgage — no state guarantee, no
 * dual guaranteed/standard comparison — so every figure below is the one
 * number a page shows, not a pair to choose between.
 *
 * DOM-free and dependency-free. Formatters take their locale from
 * FalabellaCopy.NUMBER_LOCALE when the copy layer is loaded and fall back to
 * en-US when it is not, so this module is testable on its own.
 */
"use strict";

(function () {
  /* ============================================================= constants */

  var PROPERTY_USD = 130000;
  var DOWN_PCT = 0.1;
  var TERM_YEARS = 30;

  var RATE = 0.04;
  var LTV = 0.9;

  /* Life and fire cover, added to principal and interest to make the payment
     the borrower actually pays. A flat monthly amount, in dollars. */
  var INSURANCE_USD = 25;

  var INCOME_USD = 3550;
  var DTI_CAP = 0.3;
  var STRESS_BP = 200;

  /* The mortgage officer's delegated approval authority. */
  var OFFICER_AUTHORITY_USD = 150000;

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
  function loanFor(propertyUSD, ltv) {
    return fallback(propertyUSD, PROPERTY_USD) * fallback(ltv, LTV);
  }

  function downPaymentUSD(propertyUSD, downPct) {
    return fallback(propertyUSD, PROPERTY_USD) * fallback(downPct, DOWN_PCT);
  }

  /* Level payment on a USD-denominated annuity, with monthly-equivalent
     compounding: i = (1+annual)^(1/12) - 1, not annual/12. Principal and
     interest only — see monthlyPaymentUSD. */
  function payment(principalUSD, annualRate, years) {
    var principal = fallback(principalUSD, loanFor());
    var rate = fallback(annualRate, RATE);
    var term = fallback(years, TERM_YEARS);
    var i = Math.pow(1 + rate, 1 / 12) - 1;
    var n = term * 12;
    return (principal * i) / (1 - Math.pow(1 + i, -n));
  }

  /* What the borrower is quoted: principal, interest, and the cover. This is
     the EMP — the Estimated Monthly Payment / Pago Mensual Estimado. */
  function monthlyPaymentUSD(principalUSD, annualRate, years, insuranceUSD) {
    return (
      payment(principalUSD, annualRate, years) + fallback(insuranceUSD, INSURANCE_USD)
    );
  }

  /* Payment to income, with the cap stated rather than applied. */
  function dti(paymentUSD, incomeUSD, cap) {
    var pay = fallback(paymentUSD, monthlyPaymentUSD());
    var income = fallback(incomeUSD, INCOME_USD);
    var limit = fallback(cap, DTI_CAP);
    var ratio = income > 0 ? pay / income : 0;
    return {
      paymentUSD: pay,
      incomeUSD: income,
      ratio: ratio,
      cap: limit,
      overCap: ratio > limit,
      headroomUSD: income * limit - pay
    };
  }

  /* The same case re-priced STRESS_BP higher. The principal does not move: a
     rate shock changes what the loan costs, not what it buys. */
  function stressedDti(input) {
    var options = input || {};
    var stressBp = fallback(options.stressBp, STRESS_BP);
    var baseRate = fallback(options.annualRate, RATE);
    var stressedRate = baseRate + stressBp / 10000;
    var paymentUSD = monthlyPaymentUSD(
      fallback(options.principalUSD, loanFor(options.propertyUSD, options.ltv)),
      stressedRate,
      options.years,
      options.insuranceUSD
    );
    var result = dti(paymentUSD, options.incomeUSD, options.cap);
    result.stressBp = stressBp;
    result.baseRate = baseRate;
    result.stressedRate = stressedRate;
    return result;
  }

  /* Every derived figure of the interactive case, in one object, so a page
     renders from it instead of recomputing. */
  function caseFigures(input) {
    var options = input || {};
    var propertyUSD = fallback(options.propertyUSD, PROPERTY_USD);
    var ltv = fallback(options.ltv, LTV);
    var annualRate = fallback(options.annualRate, RATE);
    var years = fallback(options.years, TERM_YEARS);
    var incomeUSD = fallback(options.incomeUSD, INCOME_USD);
    var loanUSD = loanFor(propertyUSD, ltv);
    var paymentUSD = monthlyPaymentUSD(loanUSD, annualRate, years, options.insuranceUSD);

    return {
      propertyUSD: propertyUSD,
      loanUSD: loanUSD,
      ltv: ltv,
      annualRate: annualRate,
      termYears: years,
      downPaymentUSD: downPaymentUSD(propertyUSD, options.downPct),
      insuranceUSD: fallback(options.insuranceUSD, INSURANCE_USD),
      paymentUSD: paymentUSD,
      incomeUSD: incomeUSD,
      dti: dti(paymentUSD, incomeUSD, options.cap),
      stressedDti: stressedDti(options)
    };
  }

  /* ============================================================ formatters */

  /* Whole dollars: the demo does not price loans to the cent. */
  function formatUSD(value, locale) {
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
    PROPERTY_USD: PROPERTY_USD,
    DOWN_PCT: DOWN_PCT,
    TERM_YEARS: TERM_YEARS,
    RATE: RATE,
    LTV: LTV,
    INSURANCE_USD: INSURANCE_USD,
    INCOME_USD: INCOME_USD,
    DTI_CAP: DTI_CAP,
    STRESS_BP: STRESS_BP,
    OFFICER_AUTHORITY_USD: OFFICER_AUTHORITY_USD,

    payment: payment,
    monthlyPaymentUSD: monthlyPaymentUSD,
    loanFor: loanFor,
    downPaymentUSD: downPaymentUSD,
    dti: dti,
    stressedDti: stressedDti,
    caseFigures: caseFigures,

    numberLocale: numberLocale,
    formatUSD: formatUSD,
    formatPct: formatPct,
    formatDate: formatDate
  };
})();
