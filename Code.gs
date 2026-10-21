/** TheraGrid static-site form receiver. Run setupTheraGrid() once, then deploy as a web app. */
const NOTIFY_EMAIL = 'thecodemunk@gmail.com';
const PROPERTY_KEY = 'THERAGRID_SHEET_ID';
const APPOINTMENT_HEADERS = ['Reference','Timestamp','Full name','Mobile','Email','City','Service','Preferred date','Preferred time','Visit preference','Reserved (not collected)','Privacy consent','Marketing consent','UTM source','UTM medium','UTM campaign','Status','Reserved (not collected) 2'];
const PARTNER_HEADERS = ['Reference','Timestamp','Contact name','Mobile','Email','City','Organization','Provider type','Introduction','Privacy consent','Status'];

function setupTheraGrid() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty(PROPERTY_KEY);
  let ss = null;

  // Reuse the spreadsheet on later runs so setup cannot create accidental duplicates.
  if (savedId) {
    try { ss = SpreadsheetApp.openById(savedId); } catch (err) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('TheraGrid Enquiries');
    properties.setProperty(PROPERTY_KEY, ss.getId());
  }

  let appointments = ss.getSheetByName('Appointments');
  if (!appointments && ss.getSheets().length === 1 && ss.getSheets()[0].getLastRow() === 0) {
    appointments = ss.getSheets()[0];
    appointments.setName('Appointments');
  }
  if (!appointments) appointments = ss.insertSheet('Appointments');
  configureSheet_(appointments, APPOINTMENT_HEADERS);

  let partners = ss.getSheetByName('Partners');
  if (!partners) partners = ss.insertSheet('Partners');
  configureSheet_(partners, PARTNER_HEADERS);

  Logger.log('TheraGrid spreadsheet: ' + ss.getUrl());
  return ss.getUrl();
}

function configureSheet_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#eaf5f5');
  if (!sheet.getFilter()) sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 2), headers.length).createFilter();
}

// Run this whenever you need to retrieve the spreadsheet URL from Apps Script logs.
function getTheraGridSheetUrl() {
  const id = PropertiesService.getScriptProperties().getProperty(PROPERTY_KEY);
  if (!id) throw new Error('Run setupTheraGrid() first.');
  const url = SpreadsheetApp.openById(id).getUrl();
  Logger.log('TheraGrid spreadsheet: ' + url);
  return url;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const p = (e && e.parameter) || {};
    if (String(p.website || '').trim()) return page_('Unable to accept this request', 'Please check your form details and try again.', false);
    const type = String(p.formType || '');
    if (type !== 'appointment' && type !== 'partner') throw new Error('Invalid form type.');
    const data = normalize_(p);
    validate_(type, data);
    const cache = CacheService.getScriptCache();
    const duplicateKey = 'ref:' + data.reference;
    if (cache.get(duplicateKey)) throw new Error('This request has already been received.');
    if (!lock.tryLock(10000)) throw new Error('Please wait a moment and try again.');
    try {
      if (cache.get(duplicateKey)) throw new Error('This request has already been received.');
      const sheetId = PropertiesService.getScriptProperties().getProperty(PROPERTY_KEY);
      if (!sheetId) throw new Error('The form receiver has not been configured yet.');
      const ss = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheetByName(type === 'appointment' ? 'Appointments' : 'Partners');
      if (!sheet) throw new Error('The enquiry sheet is unavailable.');
      const row = type === 'appointment' ? appointmentRow_(data) : partnerRow_(data);
      sheet.appendRow(row);
      cache.put(duplicateKey, '1', 21600);
      try {
        MailApp.sendEmail({to: NOTIFY_EMAIL, subject: 'New TheraGrid ' + (type === 'appointment' ? 'appointment' : 'partner') + ' enquiry', body: 'A new request has been saved to the TheraGrid Enquiries spreadsheet.\nReference: ' + data.reference + '\nType: ' + type + '\nPlease review it in the spreadsheet.'});
      } catch (mailError) {
        console.error('Notification email failed for ' + data.reference + ': ' + mailError);
      }
    } finally {
      lock.releaseLock();
    }
    return page_('Request received', 'Thank you. Your request has been saved. The TheraGrid team will contact you using the details you provided.', true, data.reference);
  } catch (err) {
    console.error(err);
    return page_('Request not sent', err && err.message ? err.message : 'Please try again later or contact the TheraGrid team.', false);
  }
}

function normalize_(p) {
  const take = k => String(p[k] || '').trim().slice(0, limits_[k] || 500);
  return {
    reference: take('reference') || Utilities.getUuid(), fullName: take('fullName'), mobile: take('mobile'),
    email: take('email').toLowerCase(), city: take('city'), service: take('service'),
    preferredDate: take('preferredDate'), preferredTime: take('preferredTime'), visitPreference: take('visitPreference'),
    privacyConsent: take('privacyConsent'), marketingConsent: take('marketingConsent') === 'yes' ? 'Yes' : 'No',
    utmSource: take('utm_source'), utmMedium: take('utm_medium'), utmCampaign: take('utm_campaign'),
    organization: take('organization'), providerType: take('providerType'), message: take('message')
  };
}
const limits_ = {reference:80,fullName:100,mobile:20,email:150,city:80,service:100,preferredDate:20,preferredTime:30,visitPreference:40,utm_source:120,utm_medium:120,utm_campaign:120,organization:150,providerType:80,message:500};
function validate_(type, d) {
  const required = type === 'appointment' ? [d.fullName,d.mobile,d.email,d.city,d.service,d.preferredDate,d.preferredTime,d.visitPreference] : [d.fullName,d.mobile,d.email,d.city,d.organization,d.providerType];
  if (required.some(v => !v)) throw new Error('Please complete all required fields.');
  if (d.privacyConsent !== 'yes') throw new Error('Please agree to the privacy notice before sending.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw new Error('Please enter a valid email address.');
  if (!/^[+()\d .-]{7,20}$/.test(d.mobile)) throw new Error('Please enter a valid phone number.');
  if (type === 'appointment' && !/^\d{4}-\d{2}-\d{2}$/.test(d.preferredDate)) throw new Error('Please choose a valid preferred date.');
  if (type === 'appointment' && d.preferredDate < Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')) throw new Error('Please choose today or a future date.');
}
function safeCell_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') return value;
  const text = String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return /^[=+@\-]/.test(text) ? "'" + text : text;
}
function appointmentRow_(d) {
  return [d.reference,new Date(),d.fullName,d.mobile,d.email,d.city,d.service,d.preferredDate,d.preferredTime,d.visitPreference,'','Yes',d.marketingConsent,d.utmSource,d.utmMedium,d.utmCampaign,'New Enquiry',''].map(safeCell_);
}
function partnerRow_(d) {
  return [d.reference,new Date(),d.fullName,d.mobile,d.email,d.city,d.organization,d.providerType,d.message,'Yes','New Enquiry'].map(safeCell_);
}
function page_(title, message, success, reference) {
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + ' | TheraGrid</title><style>body{margin:0;background:#f3f8f9;color:#193e52;font:16px Arial,sans-serif;display:grid;place-items:center;min-height:100vh}.card{background:#fff;border:1px solid #d5e3e7;border-top:4px solid ' + (success ? '#00a6a6' : '#b66') + ';padding:36px;max-width:520px;margin:20px}.tag{font:11px monospace;letter-spacing:.1em;color:#00a6a6}h1{font-size:28px;margin:12px 0}p{line-height:1.65;color:#627d8b}.ref{font:12px monospace;background:#f3f8f9;padding:12px}</style></head><body><main class="card"><span class="tag">THERAGRID / CARE TEAM</span><h1>' + esc(title) + '</h1><p>' + esc(message) + '</p>' + (reference ? '<p class="ref">Reference: ' + esc(reference) + '</p>' : '') + '<p>You may close this tab and return to the TheraGrid website.</p></main></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(title);
}



