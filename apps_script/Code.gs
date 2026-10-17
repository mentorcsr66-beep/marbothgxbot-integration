const CONFIG_KEYS = ['TELEGRAM_BOT_TOKEN','WEBHOOK_KEY','DECODER_URL','DECODER_SHARED_KEY','BARCODE_SECRET','SPREADSHEET_ID'];

function doPost(e) {
  const cfg = PropertiesService.getScriptProperties().getProperties();
  if (!e || !e.parameter || !constantTimeEquals_(e.parameter.k || '', cfg.WEBHOOK_KEY || '')) return text_('unauthorized');
  try {
    const update = JSON.parse(e.postData.contents || '{}');
    const message = update.message || {};
    const chatId = message.chat && message.chat.id;
    if (!chatId) return text_('ok');
    const text = String(message.text || '').trim();
    if (text === '/start' || text === '/help') {
      sendTelegram_(cfg, chatId, 'Kirim gambar QR sebagai foto atau file gambar. Saya akan memindai, membalas secret code, dan mencatat hasilnya di Google Sheets.');
      return text_('ok');
    }
    const fileId = photoFileId_(message);
    if (!fileId) {
      sendTelegram_(cfg, chatId, 'Silakan kirim gambar QR sebagai foto atau file gambar.');
      return text_('ok');
    }
    try {
      const payload = decodeTelegramImage_(cfg, fileId);
      if (!payload) {
        sendTelegram_(cfg, chatId, 'QR tidak ditemukan. Coba kirim gambar yang lebih jelas.');
        return text_('ok');
      }
      const code = makeSecretCode_(payload, cfg.BARCODE_SECRET);
      appendResult_(cfg.SPREADSHEET_ID, chatId, code);
      sendTelegram_(cfg, chatId, 'Secret code: ' + code);
    } catch (err) {
      sendTelegram_(cfg, chatId, 'Gambar tidak dapat diproses. Coba kirim ulang QR dengan gambar yang lebih jelas.');
    }
  } catch (err) {}
  return text_('ok');
}

function setupBot() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Buka Apps Script dari Google Sheet yang akan menyimpan hasil.');
  const ui = SpreadsheetApp.getUi();
  const props = {SPREADSHEET_ID: ss.getId()};
  [['TELEGRAM_BOT_TOKEN','Token bot dari BotFather'],['DECODER_URL','URL Cloud Run decoder, berakhiran /decode'],['DECODER_SHARED_KEY','Kunci yang sama dengan Secret Manager'],['WEBHOOK_KEY','Kunci acak untuk webhook'],['BARCODE_SECRET','Kunci rahasia pembuat secret code']].forEach(function(item) {
    const answer = ui.prompt('Konfigurasi @marbothgxbot', item[1], ui.ButtonSet.OK_CANCEL);
    if (answer.getSelectedButton() !== ui.Button.OK || !answer.getResponseText().trim()) throw new Error('Konfigurasi dibatalkan. Jalankan setupBot lagi.');
    props[item[0]] = answer.getResponseText().trim();
  });
  PropertiesService.getScriptProperties().setProperties(props, true);
  let sheet = ss.getSheetByName('Hasil QR');
  if (!sheet) sheet = ss.insertSheet('Hasil QR');
  if (sheet.getLastRow() === 0) sheet.appendRow(['Waktu','Telegram Chat ID','Secret Code']);
  ui.alert('Konfigurasi tersimpan. Deploy sebagai Web App, lalu jalankan installWebhook().');
}

function installWebhook() {
  const cfg = PropertiesService.getScriptProperties().getProperties();
  requireConfig_(cfg);
  const baseUrl = ScriptApp.getService().getUrl();
  if (!baseUrl) throw new Error('Deploy Apps Script sebagai Web App terlebih dahulu.');
  const response = UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.TELEGRAM_BOT_TOKEN + '/setWebhook', {method:'post', payload:{url:baseUrl + '?k=' + encodeURIComponent(cfg.WEBHOOK_KEY), allowed_updates:JSON.stringify(['message'])}, muteHttpExceptions:true});
  if (!JSON.parse(response.getContentText()).ok) throw new Error('Telegram menolak webhook. Periksa token dan deployment.');
  SpreadsheetApp.getActiveSpreadsheet().toast('Webhook Telegram aktif.','@marbothgxbot',5);
}

function removeWebhook() {
  const cfg = PropertiesService.getScriptProperties().getProperties();
  if (!cfg.TELEGRAM_BOT_TOKEN) throw new Error('Jalankan setupBot terlebih dahulu.');
  UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.TELEGRAM_BOT_TOKEN + '/deleteWebhook', {method:'post', payload:{drop_pending_updates:'false'}, muteHttpExceptions:true});
}

function decodeTelegramImage_(cfg, fileId) {
  const fileInfo = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.TELEGRAM_BOT_TOKEN + '/getFile?file_id=' + encodeURIComponent(fileId), {muteHttpExceptions:true}).getContentText());
  if (!fileInfo.ok || !fileInfo.result.file_path) throw new Error('Telegram file unavailable');
  const bytes = UrlFetchApp.fetch('https://api.telegram.org/file/bot' + cfg.TELEGRAM_BOT_TOKEN + '/' + fileInfo.result.file_path, {muteHttpExceptions:true}).getContent();
  if (bytes.length > 20 * 1024 * 1024) throw new Error('Image too large');
  const response = UrlFetchApp.fetch(cfg.DECODER_URL, {method:'post', contentType:'application/json', payload:JSON.stringify({image_base64:Utilities.base64Encode(bytes)}), headers:{'X-Decoder-Key':cfg.DECODER_SHARED_KEY}, muteHttpExceptions:true});
  if (response.getResponseCode() !== 200) throw new Error('Decoder unavailable');
  return JSON.parse(response.getContentText()).payload || null;
}

function makeSecretCode_(payload, secret) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload.trim(), secret)).replace(/=+$/, '').substring(0,12).toUpperCase();
}

function appendResult_(spreadsheetId, chatId, code) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    let sheet = ss.getSheetByName('Hasil QR');
    if (!sheet) sheet = ss.insertSheet('Hasil QR');
    if (sheet.getLastRow() === 0) sheet.appendRow(['Waktu','Telegram Chat ID','Secret Code']);
    sheet.appendRow([new Date(), String(chatId), code]);
  } finally { lock.releaseLock(); }
}

function sendTelegram_(cfg, chatId, text) {
  UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.TELEGRAM_BOT_TOKEN + '/sendMessage', {method:'post', payload:{chat_id:String(chatId), text:text}, muteHttpExceptions:true});
}

function photoFileId_(message) {
  if (message.photo && message.photo.length) return message.photo[message.photo.length - 1].file_id;
  if (message.document && /^image\//.test(message.document.mime_type || '')) return message.document.file_id;
  return null;
}

function requireConfig_(cfg) {
  CONFIG_KEYS.forEach(function(key) { if (!cfg[key]) throw new Error('Konfigurasi belum lengkap: ' + key); });
}

function constantTimeEquals_(a,b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function text_(value) { return ContentService.createTextOutput(value).setMimeType(ContentService.MimeType.TEXT); }
