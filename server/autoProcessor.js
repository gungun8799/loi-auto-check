import puppeteer from 'puppeteer';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv'


dotenv.config();
const { SIMPLICITY_USER, SIMPLICITY_PASS } = process.env;
// pick up your environment variable (as set in Render’s dashboard)
const PORT = process.env.PORT || 5001;
export const BASE_URL = process.env.API_URL || `http://localhost:${PORT}`;
const FOLDER_PATH = path.join(process.cwd(), 'contracts');

// === 🔁 Create dated output folders ===
const now = new Date();
const dateFolder = now.toISOString().split('T')[0]; // Only date part: 'YYYY-MM-DD'
const OUTPUT_BASE = path.join(process.cwd(), 'processed', dateFolder);
const PASSED_FOLDER = path.join(OUTPUT_BASE, 'verification_passed');
const FAILED_FOLDER = path.join(OUTPUT_BASE, 'verification_failed');
const SKIPPED_FOLDER = path.join(OUTPUT_BASE, 'skipped');

for (const folder of [PASSED_FOLDER, FAILED_FOLDER, SKIPPED_FOLDER]) {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    console.log(`[📁 Folder Created] ${folder}`);
  }
}

/*************  ✨ Windsurf Command ⭐  *************/
  /**
   * Processes all PDF files in the `contracts` folder and moves them to `processed/verification_passed` or `processed/verification_failed` based on whether the contract was confirmed.
   * Skips any files with invalid filenames (not matching the expected pattern of digits_(LO|LR)digits_digits.pdf).
   * Logs and continues if the file has already been processed (i.e. already exists in the output folders).
   * If the file is skipped due to an invalid filename or already having been processed, optionally moves it to the `skipped` folder.
   * Waits 90 seconds between processing each file.
   * @returns {Promise<void>}
   */
/*******  99d33ffb-ad84-4ce2-b05f-eda43bb739a2  *******/async function processContractsInFolder() {
  const files = fs.readdirSync(FOLDER_PATH).filter(f => f.toLowerCase().endsWith('.pdf'));

  for (const file of files) {
    // ── 0) If the base name (without “.pdf”) does NOT match digits_(LO|LR)digits_digits, skip immediately ──
    const baseName = file.replace(/\.pdf$/i, '');
    const validPattern = /^\d+_(?:LO|LR)\d+_\d+$/;
    if (!validPattern.test(baseName)) {
      console.log(`[⏭️ Skip Invalid Filename] ${file} does not match expected pattern.`);
      // Optionally, move it to SKIPPED_FOLDER or just log and continue:
      // await delayedMove(file, SKIPPED_FOLDER);
      continue;
    }

    if (alreadyProcessed) {
      console.log(`[⏭️ Skip Confirmed] ${file} – already processed and up to date.`);
    
      const filePath = path.join(FOLDER_PATH, file);
      if (fs.existsSync(filePath)) {
        console.log(`[🧪 Moving skipped file] Calling delayedMove()`);
        await delayedMove(file, SKIPPED_FOLDER);
      } else {
        console.warn(`[⚠️ Skipped file not found] ${file} already missing from contracts folder.`);
      }
    
      continue;
    }

    console.log(`[📄 Processing] ${file}`);
    const success = await processOneContract(file);

    const destFolder = success ? PASSED_FOLDER : FAILED_FOLDER;
    await delayedMove(file, destFolder);

    console.log('[⏳] Waiting for 90 seconds before processing the next file...');
    await new Promise(resolve => setTimeout(resolve, 90000));
  }

  console.log('[✅] All files processed.');
}

async function delayedMove(filename, destinationFolder) {
  const src = path.join(FOLDER_PATH, filename);
  const dest = path.join(destinationFolder, filename);

  console.log(`[🕒 Waiting 3s before moving file] ${filename}`);
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    console.log(`[🛆 Attempting rename] ${src} → ${dest}`);
    await fsPromises.rename(src, dest);
    console.log(`[✅ File Moved] ${filename} → ${destinationFolder}`);
  } catch (err) {
    console.error(`[❌ Rename failed] ${filename}: ${err.message}`);
    try {
      await fsPromises.copyFile(src, dest);
      await fsPromises.unlink(src);
      console.log(`[✅ Fallback Copy+Delete] ${filename} → ${destinationFolder}`);
    } catch (copyErr) {
      console.error(`[❌ Fallback Copy+Delete failed] ${filename}: ${copyErr.message}`);
    }
  }
}

// Single file handler with internal file move logic
async function processOneContract(filename) {
  const filePath = path.join(FOLDER_PATH, filename);
  const contractNumberRaw = path.basename(filename, '.pdf');
  if (!fs.existsSync(filePath)) {
    console.error(`[❌ File Not Found] ${filePath}`);
    return false;
  }

  try {
    // ─── Step 1: OCR & contract‐type classification ──────────────────────
    const ocrForm = new FormData();
    ocrForm.append('file', fs.createReadStream(filePath));
    ocrForm.append('pages', 'all');

    const ocrRes = await axios.post(
      `${BASE_URL}/api/extract-text-only`,
      ocrForm,
      { headers: ocrForm.getHeaders() }
    );
    const ocrText = ocrRes.data?.text;
    if (!ocrText) throw new Error('No OCR text received from /api/extract-text-only');

    const classifyRes = await axios.post(`${BASE_URL}/api/contract-classify`, { ocrText });
    const contractType = classifyRes.data?.contractType || 'unknown';
    let promptKey = 'LOI_permanent_fixed_fields';
    if (contractType === 'service_express') {
      promptKey = 'LOI_service_express_fields';
    }
    console.log(`[🔍 Contract Type Detected] ${contractType}`);
    console.log(`[📌 Prompt selected based on contract type] ${promptKey}`);

    // ─── Step 2: Direct API extract (bypass the UI entirely) ───────────────
    console.log(`[🔁 Calling ${BASE_URL}/api/extract-text for OCR & Gemini]`);
    const extractForm = new FormData();
    extractForm.append('files', fs.createReadStream(filePath), path.basename(filePath));
    extractForm.append('pages', 'all');
    extractForm.append('promptKey', promptKey);

    // 2.1) Extract text + Gemini via backend
    let extractRes;
    try {
      extractRes = await axios.post(
        `${BASE_URL}/api/extract-text`,
        extractForm,
        { headers: extractForm.getHeaders() }
      );
    } catch (err) {
      console.error('[❌ extract-text failed]', err.response?.data || err.message);
      throw err;
    }
    const extractedText = extractRes.data.text;
    const geminiOut     = extractRes.data.geminiOutput;
    console.log('[✅ Backend extract complete]');

    // 2.2) Parse out the Contract Number from Gemini output
    let parsedPdf;
    try {
      const raw = geminiOut
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/```$/, '');
      parsedPdf = JSON.parse(raw);
    } catch (e) {
      console.error('[❌ Failed to parse Gemini JSON]', e.message);
      throw e;
    }
    const extractedContractNumber = parsedPdf['Contract Number'];
    const contractId = extractedContractNumber.replace(/\//g, '_');
    console.log(`[🔖 Extracted Contract Number] ${extractedContractNumber}`);

    // ─── Step 2.2.5: Ensure we’re logged in to Simplicity ───────────────────
    try {
      console.log('[🔐 Logging in to Simplicity]');
      await axios.post(
        `${BASE_URL}/api/scrape-login`,
        { systemType: 'simplicity' },      // no creds needed in the bundle
        { withCredentials: true }
      );
      console.log('[✅ Logged in to Simplicity]');
    } catch (err) {
      console.error('[❌ Simplicity login failed]', err.response?.data || err.message);
      throw err;
    }

    // 2.3) Auto‐scrape Simplicity for the extracted contract
    console.log(`[🔐 Auto-scrape for ${extractedContractNumber}]`);
    let scrapeRes;
    try {
      scrapeRes = await axios.post(
        `${BASE_URL}/api/scrape-url`,
        {
          systemType:     'simplicity',
          promptKey,
          contractNumber: extractedContractNumber,
          username:       process.env.SIMPLICITY_USER,
          password:       process.env.SIMPLICITY_PASS,
        },
        { withCredentials: true }
      );
    } catch (err) {
      console.error('[❌ scrape-url request failed]', err.response?.data || err.message);
      throw err;
    }

    if (!scrapeRes.data.success) {
      throw new Error(`Scrape-URL failed: ${scrapeRes.data.message}`);
    }

    const webRaw       = scrapeRes.data.raw;
    const webGeminiRaw = scrapeRes.data.geminiOutput;
    const popupUrl     = scrapeRes.data.popupUrl;
    console.log('[✅ Web scrape complete]');
    console.log('[✅ Web scrape complete]');

    // 2.4) Parse the web‐scrape Gemini JSON
    let parsedWeb;
    try {
      let t = webGeminiRaw.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
      const b1 = t.indexOf('{'), b2 = t.lastIndexOf('}');
      parsedWeb = JSON.parse(t.slice(b1, b2 + 1));
    } catch (e) {
      throw new Error('Failed to parse web Gemini JSON: ' + e.message);
    }

    // 2.5) Gemini Compare
    const formattedSources = { pdf: parsedPdf, web: parsedWeb };
    const cmpRes = await axios.post(`${BASE_URL}/api/gemini-compare`, {
      formattedSources,
      promptKey,
    });
    let cmpRaw = cmpRes.data.response.trim()
      .replace(/^```json\s*/i, '')
      .replace(/```$/, '');

    // ─── Sanitize invalid escape sequences ──────────────────────────────────────
    const sanitized = cmpRaw
      .replace(/[\u0000-\u001F]+/g, '')
      .replace(/\\(?!["\\/bfnrtu])/g, '\\\\');

    let compareResult;
    try {
      compareResult = JSON.parse(sanitized);
    } catch (e) {
      console.error('[❌ Failed to parse sanitized compare JSON]', e.message);
      throw e;
    }

    // 2.7) Document Validation
    const docValRes = await axios.post(`${BASE_URL}/api/validate-document`, {
      extractedData: parsedPdf,
      promptKey,
    });
    let val = docValRes.data.validation.trim()
      .replace(/^```json\s*/i, '')
      .replace(/```$/, '');
    const validationResult = JSON.parse(val);
    await axios.post(`${BASE_URL}/api/save-validation-result`, {
      contractNumber:    contractId,
      validationResult,
    });
    console.log('[✅ Saved validation_result]');

    // 2.8) Web Validation
    const webValRes = await axios.post(`${BASE_URL}/api/web-validate`, {
      contractNumber:  extractedContractNumber,
      extractedData:   parsedWeb,
      promptKey,
    });
    const webValidation = webValRes.data.validationResult;
    if (Array.isArray(webValidation)) {
      await axios.post(`${BASE_URL}/api/save-validation-result`, {
        contractNumber:    contractId,
        validationResult:  webValidation,
      });
      console.log('[✅ Saved web_validation_result]');
    } else {
      console.warn('[⚠️ Web validation returned no array; skipping save]');
    }

    // 2.9) Finally save compare + both validations in one shot
    const fullPayload = {
      contractNumber:       contractId,
      compareResult,
      pdfGemini:            geminiOut,
      webGemini:            webGeminiRaw,
      validationResult,
      webValidationResult:  webValidation,
      popupUrl
    };
    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/save-compare-result`,
        fullPayload,
        { withCredentials: true }
      );
      if (!data.success) {
        console.error('[❌ Save failed]', data);
        return false;
      }
      console.log('[✅ Saved compare + validations together]');
      return true;
    } catch (err) {
      console.error(
        '[❌ Error during processing]',
        err.response?.data || err.message || err
      );
      try { await browser.close(); } catch {}
      return false;
    }

  } catch (outerErr) {
    // This now correctly catches *any* error* from the entire flow
    console.error('[❌ Error during processing]', outerErr.message || outerErr);
    throw outerErr;
  }
}

async function checkIfFileExistsInFirebase(file) {
  try {
    const { data } = await axios.get(
      `${BASE_URL}/api/check-file-processed`,
      { params: { filename: file }, withCredentials: true }
    );
    // data.processed is true when fully passed
    return data.success && data.processed;
  } catch (err) {
    console.error(
      '[❌ checkIfFileExistsInFirebase error]',
      err.response?.data || err.message || err
    );
    // on error assume “not processed” so we still try
    return false;
  }
}



export { processOneContract, processContractsInFolder, delayedMove };
