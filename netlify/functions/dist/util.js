"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = exports.catchErr = void 0;
exports.extractImageId = extractImageId;
exports.generateShortHash = generateShortHash;
exports.getReferredBy = getReferredBy;
exports.shortIdToLong = shortIdToLong;
exports.longIdToShort = longIdToShort;
exports.timeSince = timeSince;
exports.normalizePhoneNumber = normalizePhoneNumber;
exports.loadScript = loadScript;
exports.blobToDataURL = blobToDataURL;
exports.downloadFile = downloadFile;
exports.downloadImage = downloadImage;
exports.updateQueryParams = updateQueryParams;
exports.copyToClipboard = copyToClipboard;
exports.formatTranscriptForDocs = formatTranscriptForDocs;
exports.getSpeakerName = getSpeakerName;
exports.shuffle = shuffle;
exports.throwErr = throwErr;
exports.extractAndParseJSON = extractAndParseJSON;
exports.rand = rand;
exports.toObject = toObject;
exports.toInt = toInt;
exports.pickRand = pickRand;
exports.removeDuplicates = removeDuplicates;
const date_fns_1 = require("date-fns");
const crypto_js_1 = require("crypto-js");
const quasar_1 = require("quasar");
const umami_1 = require("lib/umami");
function extractImageId(url) {
    const regex = /\/images\/([a-f0-9-]+)-/;
    const match = url.match(regex);
    return match && match[1] ? match[1] : null;
}
function generateShortHash(input) {
    // return crypto.createHash("md5").update(input).digest("base64").slice(0, 8)
    return crypto_js_1.default.HmacMD5(input, "Key").toString();
}
const catchErr = (err) => {
    console.error(err);
    umami_1.default.track("error", { message: err.message, error: err });
    quasar_1.Dialog.create({
        title: "Error",
        message: err.message,
        ok: true,
    });
};
exports.catchErr = catchErr;
function getReferredBy() {
    return quasar_1.LocalStorage.getItem("referredBy") || undefined;
}
function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
function shortIdToLong(base64url) {
    // Convert Base64 URL encoding to standard Base64
    let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    // Pad the Base64 string to make its length a multiple of 4
    const paddingNeeded = (4 - (base64.length % 4)) % 4;
    base64 += "=".repeat(paddingNeeded);
    // Decode the Base64 string to an ArrayBuffer
    const buffer = base64ToArrayBuffer(base64);
    const bytes = new Uint8Array(buffer);
    // Convert the byte array to a hex string
    let hexStr = "";
    for (let i = 0; i < bytes.length; i++) {
        //@ts-ignore
        hexStr += bytes[i].toString(16).padStart(2, "0");
    }
    // Re-insert hyphens to format it as a UUID
    const uuid = `${hexStr.substr(0, 8)}-${hexStr.substr(8, 4)}-${hexStr.substr(12, 4)}-${hexStr.substr(16, 4)}-${hexStr.substr(20)}`;
    return uuid;
}
function arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        //@ts-ignore
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
function longIdToShort(uuid) {
    // Remove hyphens from the UUID
    const hexStr = uuid.replace(/-/g, "");
    // Convert the hex string to a Uint8Array
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        bytes[i] = parseInt(hexStr.substr(i * 2, 2), 16);
    }
    // Convert the byte array to a Base64 string
    const base64 = arrayBufferToBase64(bytes.buffer);
    // Convert Base64 to Base64 URL encoding
    const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return base64url;
}
function timeSince(date) {
    return (0, date_fns_1.formatDistanceToNow)(date, { addSuffix: true });
}
function normalizePhoneNumber(phoneNumber, defaultCountryCode = "+1") {
    // Remove all non-digit characters except the plus sign
    const cleaned = phoneNumber.replace(/[^\d+]/g, "");
    // Check if the phone number starts with a plus sign, prepend default country code if not
    const formatted = cleaned.startsWith("+") ? cleaned : defaultCountryCode + cleaned;
    // Validate the formatted phone number
    const isValid = /^\+\d{10,15}$/.test(formatted);
    if (!isValid) {
        throw new Error("invalid phone number");
    }
    // Encode the phone number to be URL safe
    return encodeURIComponent(formatted);
}
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
function downloadFile(dataUrl, fileName) {
    // console.log("Downloading file...", dataUrl, fileName)
    try {
        const [metadata, base64] = dataUrl.split(",");
        const mime = metadata.match(/:(.*?);/)[1];
        const binary = atob(base64);
        const arrayBuffer = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            arrayBuffer[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([arrayBuffer], { type: mime });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
    catch (error) {
        console.error("Error downloading file:", error);
    }
}
function downloadImage(imageUrl, filename = "downloaded-image") {
    fetch(imageUrl)
        .then((response) => response.blob())
        .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    })
        .catch((error) => console.error("Image download failed:", error));
}
function updateQueryParams(params) {
    const currentParams = new URLSearchParams(window.location.search);
    // Update or add each key-value pair in `params`
    Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined) {
            currentParams.delete(key); // Remove key if value is null or undefined
        }
        else {
            currentParams.set(key, String(value)); // Convert value to string
        }
    });
    // Update the URL without reloading the page
    window.history.replaceState(null, "", `${window.location.pathname}?${currentParams.toString()}`);
}
function copyToClipboard(text) {
    navigator.clipboard
        .writeText(text)
        .then(() => {
        console.log("Text copied to clipboard");
    })
        .catch((err) => {
        console.error("Error copying text: ", err);
    });
}
function formatTranscriptForDocs(transcripts, speakerNames) {
    return transcripts
        .map((transcript) => {
        const name = speakerNames ? speakerNames[transcript.speaker] : transcript.speaker;
        if (name)
            transcript.speaker = name;
        if (transcript.text.length === 0)
            return "";
        return `
${transcript.speaker}

${transcript.text}

${transcript.startTime.toFixed(0)}s - ${transcript.endTime.toFixed(0)}s
    `;
    })
        .join("\n");
}
function getSpeakerName(speaker, speakerNames, callerName) {
    if (!speakerNames)
        return "Speaker:" + speaker;
    let newSpeaker = speakerNames[speaker];
    if (newSpeaker)
        return newSpeaker;
    const firstDigit = speaker.charAt(0);
    newSpeaker = speakerNames[firstDigit];
    if (newSpeaker)
        return newSpeaker;
    if (!newSpeaker && speaker[0] == "2")
        return callerName;
    if (!newSpeaker)
        return "Speaker:" + speaker;
    else
        return "";
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
exports.sleep = sleep;
function shuffle(array) {
    let currentIndex = array.length;
    let temporaryValue;
    let randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
}
function throwErr(...messages) {
    const strMessages = messages.map((el) => (typeof el === "object" ? JSON.stringify(el, null, 2) : el.toString()));
    const errorMessage = strMessages.join(" ");
    throw new Error(errorMessage);
}
function extractAndParseJSON(input) {
    // Regular expression to find JSON wrapped in triple backticks optionally followed by "json"
    const regex = /```json\s*([\s\S]*?)\s*```/;
    const match = input.match(regex);
    if (match && match[1]) {
        try {
            const jsonObject = JSON.parse(match[1]);
            return jsonObject;
        }
        catch (error) {
            console.error("Failed to parse JSON", error);
            return null; // or return an appropriate error/message
        }
    }
    else {
        try {
            const jsonObject = JSON.parse(input);
            return jsonObject;
        }
        catch (error) {
            console.error("Failed to parse JSON", error, input);
            return null; // or return an appropriate error/message
        }
    }
}
function rand(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function toObject(data) {
    return JSON.parse(JSON.stringify(data, (key, value) => (typeof value === "bigint" ? value.toString() : value)));
}
function toInt(num) {
    return parseInt(num.toString());
}
function pickRand(arr) {
    const randomIndex = Math.floor(Math.random() * arr.length);
    return arr[randomIndex];
}
function removeDuplicates(arr) {
    return Array.from(new Set(arr));
}
