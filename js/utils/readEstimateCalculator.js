// utils/readEstimateCalculator.js

import { TIME_CONSTANTS } from '../constants/timeConstants';

const { ESTIMATE_PADDING_MULTIPLIER, DEFAULT_WPM, MIN_SPEED, MAX_SPEED } = TIME_CONSTANTS;


function getAdjustedWPM(wordsPerMinute, speed) {
    let baseWPM = parseFloat(wordsPerMinute);
    if (isNaN(baseWPM) || baseWPM <= 0) {
        baseWPM = DEFAULT_WPM;
    }

    let voiceSpeed = parseFloat(speed);
    if (isNaN(voiceSpeed)) {
        voiceSpeed = 1;
    }
    
    const normalizedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, voiceSpeed));
    
    return baseWPM * normalizedSpeed;
}




/**
 * Calculate estimated reading time based on text length, voice WPM, and speed
 * @param {string} text - The text to be read
 * @param {number} wordsPerMinute - Base words per minute for the voice
 * @param {number} speed - Voice speed multiplier (0.5 to 2, default 1)
 * @returns {string} - Formatted time string in mm:ss format
 */
export function calculateReadTime(text, wordsPerMinute, speed = 1) {
    if (!text || text.trim().length === 0) {
        return "00:00";
    }

    // ✅ Use the robust helper function to prevent NaN
    const adjustedWPM = getAdjustedWPM(wordsPerMinute, speed);
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    const timeInMinutes = words / adjustedWPM;
    
    // ✅ Add conservative padding
    const totalSeconds = Math.ceil((timeInMinutes * 60) * ESTIMATE_PADDING_MULTIPLIER);
    
    return formatTimeMMSS(totalSeconds);
}

/**
 * Calculate total reading time in seconds
 * @param {string} text - The text to be read
 * @param {number} wordsPerMinute - Base words per minute for the voice
 * @param {number} speed - Voice speed multiplier (0.5 to 2, default 1)
 * @returns {number} - Total seconds
 */
export function calculateReadTimeInSeconds(text, wordsPerMinute, speed = 1) {
    if (!text || text.trim().length === 0) {
        return 0;
    }

    // ✅ Use the robust helper function
    const adjustedWPM = getAdjustedWPM(wordsPerMinute, speed);
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    const timeInMinutes = words / adjustedWPM;
    
    // ✅ Add conservative padding
    return Math.ceil((timeInMinutes * 60) * ESTIMATE_PADDING_MULTIPLIER);
}

/**
 * Format seconds into mm:ss format
 * @param {number} totalSeconds - Total seconds
 * @returns {string} - Formatted string in mm:ss
 */
export function formatTimeMMSS(totalSeconds) {
    // Ensure we don't format NaN
    if (isNaN(totalSeconds) || totalSeconds < 0) {
        return "00:00";
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    
    return `${mm}:${ss}`;
}

/**
 * Calculate read time from VR_Reader global settings
 * @param {string} text - The text to be read
 * @returns {string} - Formatted time string in mm:ss format
 */
export function calculateReadTimeFromGlobal(text) {
    try {
        const wordsPerMinute = VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_WORDS_PER_MINUTE'];
        const speed = VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_SPEED'];
        
        return calculateReadTime(text, wordsPerMinute, speed);
    } catch (error) {
        console.error('Error calculating read time from global settings:', error);
        return "00:00";
    }
}

/**
 * Calculate remaining time for a queue starting from a specific index
 * @param {Array} replayQueue - Array of sentence objects with .text property
 * @param {number} currentIndex - Current playing index
 * @param {number} currentAudioTime - Current time in ms for the playing sentence
 * @param {number} wordsPerMinute - Base words per minute for the voice
 * @param {number} speed - Voice speed multiplier
 * @returns {Object} - { remainingSeconds, formattedTime, totalSeconds, elapsedSeconds }
 */
export function calculateRemainingTime(replayQueue, currentIndex, currentAudioTime, wordsPerMinute, speed = 1) {
    if (!replayQueue || replayQueue.length === 0 || currentIndex < 0) {
        return {
            remainingSeconds: 0,
            formattedTime: "00:00",
            totalSeconds: 0,
            elapsedSeconds: 0
        };
    }

    // ✅ Use the robust helper function
    const adjustedWPM = getAdjustedWPM(wordsPerMinute, speed);
    
    // Calculate total padded time for all sentences
    let totalSeconds = 0;
    for (let i = 0; i < replayQueue.length; i++) {
        const sentence = replayQueue[i];
        if (!sentence || !sentence.text) continue;
        
        const words = sentence.text.trim().split(/\s+/).filter(word => word.length > 0).length;
        const timeInMinutes = words / adjustedWPM;
        totalSeconds += (timeInMinutes * 60) * ESTIMATE_PADDING_MULTIPLIER;
    }
    
    // Calculate elapsed time (all completed sentences + current progress)
    let elapsedSeconds = 0;
    
    // Add padded time for all completed sentences before current index
    for (let i = 0; i < currentIndex; i++) {
        const sentence = replayQueue[i];
        if (!sentence || !sentence.text) continue;
        
        const words = sentence.text.trim().split(/\s+/).filter(word => word.length > 0).length;
        const timeInMinutes = words / adjustedWPM;
        elapsedSeconds += (timeInMinutes * 60) * ESTIMATE_PADDING_MULTIPLIER;
    }
    
    // Add current sentence progress (currentAudioTime is in ms, convert to seconds)
    elapsedSeconds += (currentAudioTime / 1000);
    
    // Calculate remaining time
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
    
    return {
        remainingSeconds: Math.ceil(remainingSeconds),
        formattedTime: formatTimeMMSS(Math.ceil(remainingSeconds)),
        totalSeconds: Math.ceil(totalSeconds),
        elapsedSeconds: Math.ceil(elapsedSeconds),
        totalFormatted: formatTimeMMSS(Math.ceil(totalSeconds)),
        elapsedFormatted: formatTimeMMSS(Math.ceil(elapsedSeconds))
    };
}

/**
 * Calculate remaining time using global settings
 * @param {Array} replayQueue - Array of sentence objects
 * @param {number} currentIndex - Current playing index
 * @param {number} currentAudioTime - Current time in ms
 * @returns {Object} - Time breakdown object
 */
export function calculateRemainingTimeFromGlobal(replayQueue, currentIndex, currentAudioTime) {
    try {
        const wordsPerMinute = VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_WORDS_PER_MINUTE'];
        const speed = VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_SPEED'];
        
        const result = calculateRemainingTime(replayQueue, currentIndex, currentAudioTime, wordsPerMinute, speed);
        
        return result;
    } catch (error) {
        console.error('Error calculating remaining time from global settings:', error);
        return {
            remainingSeconds: 0,
            formattedTime: "00:00",
            totalSeconds: 0,
            elapsedSeconds: 0
        };
    }
}

/**
 * Get detailed reading statistics
 * @param {string} text - The text to be read
 * @param {number} wordsPerMinute - Base words per minute for the voice
 * @param {number} speed - Voice speed multiplier
 * @returns {object} - Detailed statistics object
 */
export function getReadingStats(text, wordsPerMinute, speed = 1) {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    const characters = text.length;
    
    // ✅ Use the robust helper function
    const adjustedWPM = getAdjustedWPM(wordsPerMinute, speed);
    const timeInMinutes = words / adjustedWPM;
    
    // ✅ Add conservative padding
    const totalSeconds = Math.ceil((timeInMinutes * 60) * ESTIMATE_PADDING_MULTIPLIER);
    
    return {
        words,
        characters,
        baseWPM: parseFloat(wordsPerMinute) || 150, // Show the base WPM
        speed: parseFloat(speed) || 1, // Show the speed
        adjustedWPM,
        timeInMinutes,
        totalSeconds,
        formattedTime: formatTimeMMSS(totalSeconds)
    };
}